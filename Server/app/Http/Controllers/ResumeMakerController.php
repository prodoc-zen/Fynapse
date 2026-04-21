<?php

namespace App\Http\Controllers;

use App\Services\OpenRouterService;
use App\Services\PdfTextExtractorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class ResumeMakerController extends Controller
{
    private const QUIZ_VIDEO_MODEL_FALLBACK = 'google/gemini-2.5-flash';
    private const QUIZ_QUESTION_COUNT = 20;
    private const QUIZ_OPEN_ENDED_COUNT = 2;

    private const SKILL_CATALOG = [
        'Python', 'SQL', 'Excel', 'Data Visualization', 'React', 'Node.js',
        'TypeScript', 'AWS', 'Docker', 'Machine Learning', 'Figma', 'UI/UX',
        'Agile', 'Java', 'Spring Boot', 'C++', 'System Design', 'HTML', 'CSS', 'JavaScript',
    ];

    private const SKILL_ALIASES = [
        'JavaScript' => ['js', 'javascript', 'ecmascript'],
        'TypeScript' => ['ts', 'typescript'],
        'Node.js' => ['node', 'nodejs', 'node.js'],
        'UI/UX' => ['ui/ux', 'ui ux', 'user interface', 'user experience', 'ux', 'ui'],
        'C++' => ['c++', 'cpp'],
        'Data Visualization' => ['data visualization', 'data viz', 'tableau', 'power bi'],
        'Machine Learning' => ['machine learning', 'ml'],
        'System Design' => ['system design', 'distributed systems'],
        'Spring Boot' => ['spring boot', 'springboot'],
        'AWS' => ['aws', 'amazon web services'],
    ];

    private const FIXED_SKILL_PROMPT = 'Reconfirm skills from the provided resume content. Rules: 1) Return strict JSON only in shape {"skills":["..."]}. 2) Use only skills from this allowlist: Python, SQL, Excel, Data Visualization, React, Node.js, TypeScript, AWS, Docker, Machine Learning, Figma, UI/UX, Agile, Java, Spring Boot, C++, System Design, HTML, CSS, JavaScript. 3) Do not infer or assume unstated skills. 4) Only normalize misspellings or close synonyms explicitly present in the text/PDF (examples: javscript->JavaScript, structured query language->SQL, amazon web services->AWS). 5) If unsure, exclude it.';

    private const FIXED_NAME_PROMPT = 'Extract the applicant full name from the provided resume content. Return strict JSON only in shape {"applicant_name":"..."}. If not confidently present, return {"applicant_name":"Not detected"}. Do not invent names.';

    private const FIXED_BACKGROUND_SUMMARY_PROMPT = 'Summarize the applicant background from the provided resume content. Return strict JSON only in shape {"background_summary":"..."}. Use one concise sentence, max 28 words, neutral tone, and do not invent details.';

    private const FIXED_PROFILE_PROMPT = 'Extract structured profile data from the provided resume content. Return strict JSON only with this shape: {"applicant_name":"...","title":"...","email":"...","phone":"...","location":"...","summary":"...","skills":["..."],"education":[{"school":"...","period":"...","degree":"...","description":"..."}],"experience":[{"company":"...","period":"...","role":"...","description":"..."}]}. Rules: 1) Use only information found in source text/PDF. 2) If missing, return empty string or empty array. 3) Do not invent details.';

    private const FIXED_QUIZ_PROMPT = 'Generate a mixed proficiency quiz from the provided YouTube video for the given skill. Return strict JSON only in one of these shapes: {"questions":[{"question":"...","question_type":"multiple_choice","options":["A","B","C","D"],"answer":"A"},{"question":"...","question_type":"short_query","rubric":"...","answer":"..."},{"question":"...","question_type":"code_problem","rubric":"...","answer":"..."},{"question":"...","question_type":"essay","rubric":"...","answer":"..."}]} OR {"no_captions":true}. Rules: 1) If captions/transcript are unavailable, return only {"no_captions":true}. 2) Return exactly 20 questions total: 18 multiple_choice and 2 open-ended split across short_query, code_problem, or essay. 3) For multiple_choice, options must be exactly 4 strings and answer must match one option exactly. 4) For open-ended, include rubric and a concise reference answer (under 350 chars). 5) Questions must be grounded in the video captions/transcript content.';

    private const FIXED_QUIZ_GRADING_PROMPT = 'You are grading a single quiz response. Return strict JSON only in this shape: {"score":0-100,"feedback":"..."}. Scoring rules: 1) Evaluate against rubric and reference answer. 2) Reward correctness, depth, and practical relevance. 3) Penalize factual errors and missing key points. 4) feedback must be concise (max 45 words).';

    public function __construct(
        private readonly OpenRouterService $openRouter,
        private readonly PdfTextExtractorService $pdfTextExtractor,
    ) {
    }

    public function make(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'prompt' => ['required', 'string', 'min:5', 'max:4000'],
            'resume_text' => ['nullable', 'string', 'max:20000'],
            'pdf_url' => ['nullable', 'url', 'max:2048'],
            'pdf' => ['nullable', 'file', 'mimetypes:application/pdf', 'max:15360'],
            'model' => ['nullable', 'string', 'max:120'],
        ]);

        $content = [
            [
                'type' => 'text',
                'text' => $validated['prompt'],
            ],
        ];

        $sourceMeta = [
            'used_resume_text' => false,
            'used_pdf_url' => false,
            'used_pdf_upload' => false,
            'pdf_text_preview' => null,
        ];

        if (! empty($validated['resume_text'])) {
            $sourceMeta['used_resume_text'] = true;
            $content[] = [
                'type' => 'text',
                'text' => "Candidate resume text:\n".$validated['resume_text'],
            ];
        }

        if (! empty($validated['pdf_url'])) {
            $sourceMeta['used_pdf_url'] = true;
            $content[] = [
                'type' => 'file',
                'file' => [
                    'filename' => $this->filenameFromUrl($validated['pdf_url']),
                    'file_data' => $validated['pdf_url'],
                ],
            ];
        }

        $uploadedPdf = $request->file('pdf');

        if ($uploadedPdf instanceof UploadedFile) {
            $sourceMeta['used_pdf_upload'] = true;

            $binary = file_get_contents($uploadedPdf->getRealPath());
            $content[] = [
                'type' => 'file',
                'file' => [
                    'filename' => $uploadedPdf->getClientOriginalName() ?: 'resume.pdf',
                    'file_data' => 'data:application/pdf;base64,'.base64_encode($binary ?: ''),
                ],
            ];

            $extracted = $this->pdfTextExtractor->extractFromUpload($uploadedPdf);
            if ($extracted !== '') {
                $sourceMeta['pdf_text_preview'] = Str::limit($extracted, 300);
                $content[] = [
                    'type' => 'text',
                    'text' => "Extracted PDF text:\n".$extracted,
                ];
            }
        }

        $payload = [
            'model' => $validated['model'] ?? null,
            'messages' => [
                [
                    'role' => 'user',
                    'content' => $content,
                ],
            ],
            'plugins' => [
                [
                    'id' => 'file-parser',
                    'pdf' => [
                        'engine' => 'mistral-ocr',
                    ],
                ],
            ],
        ];

        try {
            $result = $this->openRouter->chatWithPayload($payload);
        } catch (Throwable $throwable) {
            return response()->json([
                'message' => 'Resume maker request failed.',
                'error' => $throwable->getMessage(),
            ], 503);
        }

        return response()->json([
            'message' => 'Resume generated successfully.',
            'data' => [
                'id' => $result['id'],
                'model' => $result['model'],
                'content' => $result['content'],
                'source' => $sourceMeta,
            ],
        ]);
    }

    public function skills(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'resume_text' => ['nullable', 'string', 'max:20000'],
            'pdf_url' => ['nullable', 'url', 'max:2048'],
            'pdf' => ['nullable', 'file', 'mimetypes:application/pdf', 'max:15360'],
            'model' => ['nullable', 'string', 'max:120'],
        ]);

        $content = [
            [
                'type' => 'text',
                'text' => self::FIXED_SKILL_PROMPT,
            ],
        ];

        $plainTextSource = [];

        if (! empty($validated['resume_text'])) {
            $plainTextSource[] = $validated['resume_text'];
            $content[] = [
                'type' => 'text',
                'text' => "Resume text:\n".$validated['resume_text'],
            ];
        }

        if (! empty($validated['pdf_url'])) {
            $content[] = [
                'type' => 'file',
                'file' => [
                    'filename' => $this->filenameFromUrl($validated['pdf_url']),
                    'file_data' => $validated['pdf_url'],
                ],
            ];
        }

        $uploadedPdf = $request->file('pdf');

        if ($uploadedPdf instanceof UploadedFile) {
            $binary = file_get_contents($uploadedPdf->getRealPath());
            $content[] = [
                'type' => 'file',
                'file' => [
                    'filename' => $uploadedPdf->getClientOriginalName() ?: 'resume.pdf',
                    'file_data' => 'data:application/pdf;base64,'.base64_encode($binary ?: ''),
                ],
            ];

            $extracted = $this->pdfTextExtractor->extractFromUpload($uploadedPdf);
            if ($extracted !== '') {
                $plainTextSource[] = $extracted;
                $content[] = [
                    'type' => 'text',
                    'text' => "Extracted PDF text:\n".$extracted,
                ];
            }
        }

        $sourceText = implode("\n", $plainTextSource);
        $keywordSkills = $this->keywordMatchSkills($sourceText);

        $content[] = [
            'type' => 'text',
            'text' => 'Keyword pre-match (for reconfirmation): '.json_encode($keywordSkills, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ];

        try {
            $result = $this->openRouter->chatWithPayload([
                'model' => $validated['model'] ?? null,
                'messages' => [
                    [
                        'role' => 'user',
                        'content' => $content,
                    ],
                ],
                'plugins' => [
                    [
                        'id' => 'file-parser',
                        'pdf' => [
                            'engine' => 'mistral-ocr',
                        ],
                    ],
                ],
            ]);
        } catch (Throwable $throwable) {
            return response()->json([
                'message' => 'Skill analysis failed after keyword matching.',
                'error' => $throwable->getMessage(),
                'data' => [
                    'model' => 'keyword-matcher',
                    'analysis_path' => 'keyword-match-openrouter-failed',
                    'skills' => $keywordSkills,
                    'keyword_skills' => $keywordSkills,
                    'ai_skills' => [],
                ],
            ], 503);
        }

        $aiSkills = $this->extractSkillsFromModelContent($result['content']);
        $guardedAiSkills = $this->guardAiSkillsAgainstSource($aiSkills, $sourceText);

        if ($sourceText === '') {
            $skills = $guardedAiSkills;
            $analysisPath = 'keyword-match-plus-openrouter-pdf-only';
        } else {
            $skills = array_values(array_unique(array_merge($keywordSkills, $guardedAiSkills)));
            $analysisPath = 'keyword-match-plus-openrouter-reconfirm';
        }

        $summary = [
            'applicant_name' => $this->extractApplicantName($sourceText),
            'found_skills' => $skills,
            'provided_skills' => self::SKILL_CATALOG,
            'missing_from_provided' => array_values(array_diff(self::SKILL_CATALOG, $skills)),
        ];

        return response()->json([
            'message' => 'Skill analysis succeeded.',
            'data' => [
                'model' => $result['model'],
                'analysis_path' => $analysisPath,
                'skills' => $skills,
                'keyword_skills' => $keywordSkills,
                'ai_skills' => $guardedAiSkills,
                'summary' => $summary,
            ],
        ]);
    }

    public function name(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'resume_text' => ['nullable', 'string', 'max:20000'],
            'pdf_url' => ['nullable', 'url', 'max:2048'],
            'pdf' => ['nullable', 'file', 'mimetypes:application/pdf', 'max:15360'],
            'model' => ['nullable', 'string', 'max:120'],
        ]);

        [$content, $sourceText] = $this->buildSkillInputs($request, $validated, self::FIXED_NAME_PROMPT);

        try {
            $result = $this->openRouter->chatWithPayload([
                'model' => $validated['model'] ?? null,
                'messages' => [
                    [
                        'role' => 'user',
                        'content' => $content,
                    ],
                ],
                'plugins' => [
                    [
                        'id' => 'file-parser',
                        'pdf' => [
                            'engine' => 'mistral-ocr',
                        ],
                    ],
                ],
            ]);
        } catch (Throwable $throwable) {
            return response()->json([
                'message' => 'Applicant name extraction failed.',
                'error' => $throwable->getMessage(),
                'data' => [
                    'applicant_name' => $this->extractApplicantName($sourceText),
                    'model' => 'heuristic-fallback',
                    'analysis_path' => 'name-openrouter-failed',
                ],
            ], 503);
        }

        $name = $this->extractApplicantNameFromModelContent($result['content']);

        if ($name === 'Not detected') {
            $name = $this->extractApplicantName($sourceText);
        }

        return response()->json([
            'message' => 'Applicant name extracted.',
            'data' => [
                'applicant_name' => $name,
                'model' => $result['model'],
                'analysis_path' => 'name-openrouter-first',
            ],
        ]);
    }

    public function summary(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'resume_text' => ['nullable', 'string', 'max:20000'],
            'pdf_url' => ['nullable', 'url', 'max:2048'],
            'pdf' => ['nullable', 'file', 'mimetypes:application/pdf', 'max:15360'],
            'model' => ['nullable', 'string', 'max:120'],
        ]);

        [$content, $sourceText] = $this->buildSkillInputs($request, $validated, self::FIXED_BACKGROUND_SUMMARY_PROMPT);

        try {
            $result = $this->openRouter->chatWithPayload([
                'model' => $validated['model'] ?? null,
                'messages' => [
                    [
                        'role' => 'user',
                        'content' => $content,
                    ],
                ],
                'plugins' => [
                    [
                        'id' => 'file-parser',
                        'pdf' => [
                            'engine' => 'mistral-ocr',
                        ],
                    ],
                ],
            ]);
        } catch (Throwable $throwable) {
            return response()->json([
                'message' => 'Background summary extraction failed.',
                'error' => $throwable->getMessage(),
                'data' => [
                    'background_summary' => $this->fallbackBackgroundSummary($sourceText),
                    'model' => 'heuristic-fallback',
                    'analysis_path' => 'summary-openrouter-failed',
                ],
            ], 503);
        }

        $summary = $this->extractBackgroundSummaryFromModelContent($result['content']);

        if ($summary === '') {
            $summary = $this->fallbackBackgroundSummary($sourceText);
        }

        return response()->json([
            'message' => 'Background summary extracted.',
            'data' => [
                'background_summary' => $summary,
                'model' => $result['model'],
                'analysis_path' => 'summary-openrouter-second',
            ],
        ]);
    }

    public function profile(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'resume_text' => ['nullable', 'string', 'max:20000'],
            'pdf_url' => ['nullable', 'url', 'max:2048'],
            'pdf' => ['nullable', 'file', 'mimetypes:application/pdf', 'max:15360'],
            'model' => ['nullable', 'string', 'max:120'],
        ]);

        [$content, $sourceText] = $this->buildSkillInputs($request, $validated, self::FIXED_PROFILE_PROMPT);

        try {
            $result = $this->openRouter->chatWithPayload([
                'model' => $validated['model'] ?? null,
                'messages' => [
                    [
                        'role' => 'user',
                        'content' => $content,
                    ],
                ],
                'plugins' => [
                    [
                        'id' => 'file-parser',
                        'pdf' => [
                            'engine' => 'mistral-ocr',
                        ],
                    ],
                ],
            ]);

            $profile = $this->extractProfileFromModelContent($result['content']);
            $fallback = $this->fallbackProfileFromSource($sourceText);

            $merged = [
                'applicant_name' => $profile['applicant_name'] !== '' ? $profile['applicant_name'] : $fallback['applicant_name'],
                'title' => $profile['title'] !== '' ? $profile['title'] : $fallback['title'],
                'email' => $profile['email'] !== '' ? $profile['email'] : $fallback['email'],
                'phone' => $profile['phone'] !== '' ? $profile['phone'] : $fallback['phone'],
                'location' => $profile['location'] !== '' ? $profile['location'] : $fallback['location'],
                'summary' => $profile['summary'] !== '' ? $profile['summary'] : $fallback['summary'],
                'skills' => array_values(array_unique(array_merge($fallback['skills'], $profile['skills']))),
                'education' => ! empty($profile['education']) ? $profile['education'] : $fallback['education'],
                'experience' => ! empty($profile['experience']) ? $profile['experience'] : $fallback['experience'],
            ];

            return response()->json([
                'message' => 'Profile extracted successfully.',
                'data' => [
                    'profile' => $merged,
                    'analysis_path' => 'profile-openrouter-pdf-reread',
                    'model' => $result['model'],
                ],
            ]);
        } catch (Throwable $throwable) {
            return response()->json([
                'message' => 'Profile extraction failed. Returning fallback profile.',
                'error' => $throwable->getMessage(),
                'data' => [
                    'profile' => $this->fallbackProfileFromSource($sourceText),
                    'analysis_path' => 'profile-fallback-from-source',
                    'model' => 'heuristic-fallback',
                ],
            ], 200);
        }
    }

    public function proficiencyQuiz(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'skill' => ['required', 'string', 'max:120'],
            'youtube_url' => ['nullable', 'string', 'max:2048'],
            'provided_quiz' => ['nullable', 'array'],
            'provided_quiz.*.question' => ['required_with:provided_quiz', 'string', 'max:500'],
            'provided_quiz.*.question_type' => ['nullable', 'string', 'in:multiple_choice,short_query,code_problem,essay'],
            'provided_quiz.*.options' => ['nullable', 'array', 'size:4'],
            'provided_quiz.*.options.*' => ['nullable', 'string', 'max:300'],
            'provided_quiz.*.answer' => ['nullable', 'string', 'max:600'],
            'provided_quiz.*.rubric' => ['nullable', 'string', 'max:1000'],
            'model' => ['nullable', 'string', 'max:120'],
        ]);

        $skill = trim($validated['skill']);

        if (! empty($validated['provided_quiz'])) {
            $providedQuestions = $this->normalizeQuizQuestions(array_values($validated['provided_quiz']), $skill, true);

            return response()->json([
                'message' => 'Using provided quiz JSON.',
                'data' => [
                    'skill' => $skill,
                    'source' => 'provided-json',
                    'ai_generated' => false,
                    'questions' => $providedQuestions,
                ],
            ]);
        }

        $cachePath = 'proficiency_quizzes/'.Str::slug($skill, '_').'.json';
        if (Storage::disk('local')->exists($cachePath)) {
            $cached = json_decode((string) Storage::disk('local')->get($cachePath), true);
            if (is_array($cached) && is_array($cached['questions'] ?? null) && ! empty($cached['questions'])) {
                $cachedQuestions = $this->normalizeQuizQuestions(array_values($cached['questions']), $skill, true);
                return response()->json([
                    'message' => 'Using cached proficiency quiz.',
                    'data' => [
                        'skill' => $skill,
                        'source' => 'generated-cache',
                        'ai_generated' => (bool) ($cached['ai_generated'] ?? false),
                        'questions' => $cachedQuestions,
                    ],
                ]);
            }
        }

        if (empty($validated['youtube_url'])) {
            return response()->json([
                'message' => 'YouTube URL is required when provided quiz JSON is missing.',
            ], 422);
        }

        $quizModel = $validated['model'] ?? (string) Config::get('services.openrouter.video_model', self::QUIZ_VIDEO_MODEL_FALLBACK);

        try {
            $result = $this->openRouter->chatWithPayload([
                'model' => $quizModel,
                'messages' => [
                    [
                        'role' => 'user',
                        'content' => [
                            [
                                'type' => 'text',
                                'text' => self::FIXED_QUIZ_PROMPT,
                            ],
                            [
                                'type' => 'text',
                                'text' => 'Skill: '.$skill,
                            ],
                            [
                                'type' => 'text',
                                'text' => 'YouTube URL: '.$validated['youtube_url'],
                            ],
                            [
                                'type' => 'text',
                                'text' => 'Use only video-caption/transcript-grounded information. If captions/transcript cannot be accessed from this URL, return exactly {"no_captions":true}.',
                            ],
                        ],
                    ],
                ],
            ]);
        } catch (Throwable $throwable) {
            return response()->json([
                'message' => 'Quiz generation failed.',
                'error' => $throwable->getMessage(),
            ], 503);
        }

        $modelContent = (string) ($result['content'] ?? '');

        $questions = $this->extractQuizQuestionsFromModelContent($modelContent);

        if ($this->modelIndicatesNoCaptions($modelContent) || empty($questions)) {
            $questions = $this->buildDefaultQuizQuestions($skill);

            Storage::disk('local')->put($cachePath, json_encode([
                'skill' => $skill,
                'ai_generated' => false,
                'questions' => $questions,
            ], JSON_PRETTY_PRINT));

            return response()->json([
                'message' => 'No captions available for this video. Using default quiz.',
                'data' => [
                    'skill' => $skill,
                    'source' => 'default-fallback',
                    'generation_mode' => 'url-reference',
                    'ai_generated' => false,
                    'questions' => $questions,
                    'model' => $result['model'],
                ],
            ]);
        }

        $questions = $this->normalizeQuizQuestions($questions, $skill, true);

        Storage::disk('local')->put($cachePath, json_encode([
            'skill' => $skill,
            'ai_generated' => true,
            'questions' => $questions,
        ], JSON_PRETTY_PRINT));

        return response()->json([
            'message' => 'Proficiency quiz generated.',
            'data' => [
                'skill' => $skill,
                'source' => 'generated-openrouter',
                'generation_mode' => 'url-reference',
                'ai_generated' => true,
                'questions' => $questions,
                'model' => $result['model'],
            ],
        ]);
    }

    public function proficiencyGrade(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'skill' => ['required', 'string', 'max:120'],
            'question_type' => ['required', 'string', 'in:multiple_choice,short_query,code_problem,essay'],
            'question' => ['required', 'string', 'max:2000'],
            'response' => ['required', 'string', 'max:4000'],
            'rubric' => ['nullable', 'string', 'max:3000'],
            'expected_answer' => ['nullable', 'string', 'max:5000'],
            'selected_option' => ['nullable', 'string', 'max:600'],
        ]);

        $questionType = $validated['question_type'];

        if ($questionType === 'multiple_choice') {
            $selected = trim((string) ($validated['selected_option'] ?? $validated['response']));
            $expected = trim((string) ($validated['expected_answer'] ?? ''));
            $isCorrect = $selected !== '' && $expected !== '' && $selected === $expected;

            return response()->json([
                'message' => 'Response graded.',
                'data' => [
                    'question_type' => $questionType,
                    'score' => $isCorrect ? 100 : 0,
                    'feedback' => $isCorrect ? 'Correct answer.' : 'Answer does not match the expected choice.',
                    'passed' => $isCorrect,
                    'graded_by' => 'rule',
                ],
            ]);
        }

        $gradingPrompt = implode("\n\n", [
            self::FIXED_QUIZ_GRADING_PROMPT,
            'Skill: '.$validated['skill'],
            'Question type: '.$questionType,
            'Question: '.$validated['question'],
            'Rubric: '.trim((string) ($validated['rubric'] ?? 'Evaluate for conceptual correctness and practical clarity.')),
            'Reference answer: '.trim((string) ($validated['expected_answer'] ?? '')),
            'Candidate response: '.$validated['response'],
        ]);

        try {
            $result = $this->openRouter->chatWithPayload([
                'messages' => [
                    [
                        'role' => 'user',
                        'content' => [
                            [
                                'type' => 'text',
                                'text' => $gradingPrompt,
                            ],
                        ],
                    ],
                ],
            ]);
        } catch (Throwable $throwable) {
            return response()->json([
                'message' => 'AI grading failed.',
                'error' => $throwable->getMessage(),
            ], 503);
        }

        $grade = $this->extractQuizGradeFromModelContent((string) ($result['content'] ?? ''));

        return response()->json([
            'message' => 'Response graded.',
            'data' => [
                'question_type' => $questionType,
                'score' => $grade['score'],
                'feedback' => $grade['feedback'],
                'passed' => $grade['score'] >= 60,
                'graded_by' => 'ai',
                'model' => $result['model'] ?? null,
            ],
        ]);
    }

    private function filenameFromUrl(string $url): string
    {
        $path = parse_url($url, PHP_URL_PATH);
        $filename = is_string($path) ? basename($path) : '';

        if ($filename === '' || $filename === '/') {
            return 'document.pdf';
        }

        return $filename;
    }

    private function extractSkillsFromModelContent(string $content): array
    {
        $decoded = json_decode($content, true);

        if (is_array($decoded) && is_array($decoded['skills'] ?? null)) {
            return $this->normalizeSkills($decoded['skills']);
        }

        if (preg_match('/\{[\s\S]*\}/', $content, $matches) === 1) {
            $candidate = json_decode($matches[0], true);
            if (is_array($candidate) && is_array($candidate['skills'] ?? null)) {
                return $this->normalizeSkills($candidate['skills']);
            }
        }

        $parts = preg_split('/[\n,]+/', $content) ?: [];

        return $this->normalizeSkills($parts);
    }

    private function normalizeSkills(array $items): array
    {
        $normalized = [];

        foreach ($items as $item) {
            if (! is_string($item)) {
                continue;
            }

            $skill = trim(Str::of($item)->replaceMatches('/^[\-\*\d\.\)\s]+/', '')->value());

            if ($skill === '') {
                continue;
            }

            foreach (self::SKILL_ALIASES as $canonical => $aliases) {
                foreach ($aliases as $alias) {
                    if (Str::lower($skill) === Str::lower($alias)) {
                        $skill = $canonical;
                        break 2;
                    }
                }
            }

            if (! in_array($skill, self::SKILL_CATALOG, true)) {
                continue;
            }

            $normalized[] = $skill;
        }

        return array_values(array_unique($normalized));
    }

    private function keywordMatchSkills(string $text): array
    {
        if (trim($text) === '') {
            return [];
        }

        $normalized = Str::lower($text);
        $matched = [];

        foreach (self::SKILL_CATALOG as $skill) {
            $patterns = [Str::lower($skill)];

            if (isset(self::SKILL_ALIASES[$skill])) {
                $patterns = array_merge($patterns, array_map(static fn (string $alias): string => Str::lower($alias), self::SKILL_ALIASES[$skill]));
            }

            foreach ($patterns as $pattern) {
                $escaped = preg_quote($pattern, '/');

                if (preg_match('/(?<!\w)'.$escaped.'(?!\w)/i', $normalized) === 1) {
                    $matched[] = $skill;
                    break;
                }
            }
        }

        return array_values(array_unique($matched));
    }

    private function guardAiSkillsAgainstSource(array $skills, string $sourceText): array
    {
        if ($sourceText === '') {
            return $skills;
        }

        $guarded = [];

        foreach ($skills as $skill) {
            if ($this->hasSkillEvidenceInText($skill, $sourceText)) {
                $guarded[] = $skill;
            }
        }

        return array_values(array_unique($guarded));
    }

    private function hasSkillEvidenceInText(string $skill, string $text): bool
    {
        $normalizedText = Str::lower((string) Str::of($text)
            ->replaceMatches('/[^a-z0-9\+\s]/i', ' ')
            ->squish());

        $variants = [Str::lower($skill)];
        if (isset(self::SKILL_ALIASES[$skill])) {
            $variants = array_merge($variants, array_map(static fn (string $alias): string => Str::lower($alias), self::SKILL_ALIASES[$skill]));
        }

        foreach ($variants as $variant) {
            $escaped = preg_quote($variant, '/');
            if (preg_match('/(?<!\w)'.$escaped.'(?!\w)/i', $normalizedText) === 1) {
                return true;
            }
        }

        $tokens = preg_split('/\s+/', $normalizedText) ?: [];

        foreach ($variants as $variant) {
            $variantTokens = preg_split('/\s+/', (string) Str::of($variant)->squish()) ?: [];
            if ($variantTokens === []) {
                continue;
            }

            $allTokenMatches = true;

            foreach ($variantTokens as $variantToken) {
                if ($variantToken === '') {
                    continue;
                }

                $targetDistance = strlen($variantToken) >= 8 ? 2 : 1;
                $tokenMatched = false;

                foreach ($tokens as $sourceToken) {
                    if ($sourceToken === '') {
                        continue;
                    }

                    if (levenshtein($variantToken, $sourceToken) <= $targetDistance) {
                        $tokenMatched = true;
                        break;
                    }
                }

                if (! $tokenMatched) {
                    $allTokenMatches = false;
                    break;
                }
            }

            if ($allTokenMatches) {
                return true;
            }
        }

        return false;
    }

    private function extractApplicantName(string $sourceText): string
    {
        if (trim($sourceText) === '') {
            return 'Not detected';
        }

        $lines = preg_split('/\R+/', $sourceText) ?: [];

        foreach ($lines as $line) {
            $cleanLine = trim((string) Str::of($line)
                ->replaceMatches('/\s+/', ' ')
                ->replaceMatches('/[^A-Za-z\s\-\.]/', ' ')
                ->squish());

            if ($cleanLine === '' || strlen($cleanLine) < 4 || strlen($cleanLine) > 60) {
                continue;
            }

            if (preg_match('/\b(email|phone|linkedin|github|resume|cv|experience|skills|summary)\b/i', $cleanLine) === 1) {
                continue;
            }

            if (preg_match('/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/', $cleanLine) === 1) {
                return $cleanLine;
            }
        }

        return 'Not detected';
    }

    private function extractApplicantNameFromModelContent(string $content): string
    {
        $decoded = json_decode($content, true);

        if (is_array($decoded) && is_string($decoded['applicant_name'] ?? null)) {
            $name = trim($decoded['applicant_name']);
            return $name !== '' ? $name : 'Not detected';
        }

        if (preg_match('/\{[\s\S]*\}/', $content, $matches) === 1) {
            $candidate = json_decode($matches[0], true);
            if (is_array($candidate) && is_string($candidate['applicant_name'] ?? null)) {
                $name = trim($candidate['applicant_name']);
                return $name !== '' ? $name : 'Not detected';
            }
        }

        return 'Not detected';
    }

    private function extractBackgroundSummaryFromModelContent(string $content): string
    {
        $decoded = json_decode($content, true);

        if (is_array($decoded) && is_string($decoded['background_summary'] ?? null)) {
            return trim($decoded['background_summary']);
        }

        if (preg_match('/\{[\s\S]*\}/', $content, $matches) === 1) {
            $candidate = json_decode($matches[0], true);
            if (is_array($candidate) && is_string($candidate['background_summary'] ?? null)) {
                return trim($candidate['background_summary']);
            }
        }

        return '';
    }

    private function fallbackBackgroundSummary(string $sourceText): string
    {
        $clean = trim((string) Str::of($sourceText)->replaceMatches('/\s+/', ' '));

        if ($clean === '') {
            return 'No resume text detected yet. Upload or paste resume content to produce a background summary.';
        }

        return Str::limit($clean, 180);
    }

    private function extractQuizQuestionsFromModelContent(string $content): array
    {
        $decoded = json_decode($content, true);

        if (! is_array($decoded) || ! is_array($decoded['questions'] ?? null)) {
            if (preg_match('/\{[\s\S]*\}/', $content, $matches) === 1) {
                $decoded = json_decode($matches[0], true);
            }
        }

        if (! is_array($decoded) || ! is_array($decoded['questions'] ?? null)) {
            return [];
        }

        return $this->normalizeQuizQuestions(array_values($decoded['questions']), '', false);
    }

    private function normalizeQuizQuestions(array $questions, string $skill, bool $fillToCount = true): array
    {
        $validated = [];

        foreach ($questions as $row) {
            if (! is_array($row)) {
                continue;
            }

            $question = trim((string) ($row['question'] ?? ''));
            $type = trim((string) ($row['question_type'] ?? ''));
            if ($type === '') {
                $type = is_array($row['options'] ?? null) ? 'multiple_choice' : 'essay';
            }

            if (! in_array($type, ['multiple_choice', 'short_query', 'code_problem', 'essay'], true)) {
                continue;
            }

            if ($question === '') {
                continue;
            }

            if ($type !== 'multiple_choice') {
                $validated[] = [
                    'question' => $question,
                    'question_type' => $type,
                    'rubric' => trim((string) ($row['rubric'] ?? 'Assess technical correctness, clarity, and relevance to the question.')),
                    'answer' => trim((string) ($row['answer'] ?? '')),
                ];
                continue;
            }

            $options = $row['options'] ?? [];
            $answer = trim((string) ($row['answer'] ?? ''));

            if ($question === '' || ! is_array($options) || count($options) !== 4 || $answer === '') {
                continue;
            }

            $normalizedOptions = array_values(array_map(static fn ($option) => trim((string) $option), $options));
            if (! in_array($answer, $normalizedOptions, true)) {
                continue;
            }

            $validated[] = [
                'question' => $question,
                'question_type' => 'multiple_choice',
                'options' => $normalizedOptions,
                'answer' => $answer,
            ];
        }

        if ($fillToCount) {
            return $this->enforceQuizMix($validated, $skill);
        }

        return $validated;
    }

    private function enforceQuizMix(array $questions, string $skill): array
    {
        $mcq = [];
        $openEnded = [];

        foreach ($questions as $question) {
            $type = (string) ($question['question_type'] ?? 'multiple_choice');
            if ($type === 'multiple_choice') {
                $mcq[] = $question;
            } else {
                $openEnded[] = $question;
            }
        }

        $openEnded = array_slice($openEnded, 0, self::QUIZ_OPEN_ENDED_COUNT);

        $defaultOpen = array_values(array_filter(
            $this->buildDefaultQuizQuestions($skill),
            static fn (array $item): bool => ($item['question_type'] ?? '') !== 'multiple_choice'
        ));

        foreach ($defaultOpen as $fallbackQuestion) {
            if (count($openEnded) >= self::QUIZ_OPEN_ENDED_COUNT) {
                break;
            }
            $openEnded[] = $fallbackQuestion;
        }

        $mcqTarget = self::QUIZ_QUESTION_COUNT - self::QUIZ_OPEN_ENDED_COUNT;

        $defaultMcq = array_values(array_filter(
            $this->buildDefaultQuizQuestions($skill),
            static fn (array $item): bool => ($item['question_type'] ?? '') === 'multiple_choice'
        ));

        foreach ($defaultMcq as $fallbackQuestion) {
            if (count($mcq) >= $mcqTarget) {
                break;
            }
            $mcq[] = $fallbackQuestion;
        }

        $mcq = array_slice($mcq, 0, $mcqTarget);

        return array_slice(array_merge($mcq, $openEnded), 0, self::QUIZ_QUESTION_COUNT);
    }

    private function buildDefaultQuizQuestions(string $skill): array
    {
        $topic = trim($skill) !== '' ? trim($skill) : 'General Skill';

        $templates = [
            ['Which statement best describes the core goal of %s in product work?', ['Improve user outcomes', 'Reduce monitor brightness', 'Increase compile time', 'Eliminate testing'], 'Improve user outcomes'],
            ['When applying %s, what should be validated first?', ['User needs and context', 'Logo color only', 'Office seating plan', 'Keyboard brand'], 'User needs and context'],
            ['A strong %s decision is usually supported by:', ['Evidence from behavior and feedback', 'Guesswork only', 'Random preference', 'No documentation'], 'Evidence from behavior and feedback'],
            ['What is a practical indicator of %s quality?', ['Users complete tasks with less friction', 'Code has more files', 'Meetings are longer', 'Buttons are brighter'], 'Users complete tasks with less friction'],
            ['In %s improvement cycles, teams should:', ['Iterate using measurable outcomes', 'Avoid any measurement', 'Ship once and stop', 'Ignore edge cases'], 'Iterate using measurable outcomes'],
            ['Which practice strengthens %s decisions most?', ['Testing alternatives with users', 'Skipping discovery', 'Copying competitors blindly', 'Avoiding feedback'], 'Testing alternatives with users'],
            ['What risk appears when %s is treated as purely visual?', ['Usability and clarity decline', 'Servers overheat instantly', 'Browsers uninstall', 'Databases vanish'], 'Usability and clarity decline'],
            ['A balanced %s approach combines:', ['Business goals, user goals, and feasibility', 'Only aesthetics', 'Only deadlines', 'Only tool preference'], 'Business goals, user goals, and feasibility'],
            ['Which output reflects mature %s communication?', ['Clear rationale and trade-offs', 'Unexplained decisions', 'Ambiguous acceptance criteria', 'No success metrics'], 'Clear rationale and trade-offs'],
            ['For %s prioritization, highest value items are those that:', ['Deliver meaningful impact with acceptable effort', 'Look trendy only', 'Require most meetings', 'Use newest framework'], 'Deliver meaningful impact with acceptable effort'],
            ['A useful %s metric should be:', ['Specific, observable, and actionable', 'Vague and emotional', 'Unrelated to users', 'Impossible to track'], 'Specific, observable, and actionable'],
            ['What is the best response when %s assumptions fail?', ['Revise using new evidence', 'Ignore outcomes', 'Blame users', 'Freeze the roadmap'], 'Revise using new evidence'],
            ['Which behavior supports scalable %s execution?', ['Documenting patterns and decisions', 'Keeping knowledge siloed', 'Changing standards daily', 'Skipping retrospectives'], 'Documenting patterns and decisions'],
            ['In collaborative %s reviews, feedback should be:', ['Concrete and tied to outcomes', 'Personal and vague', 'Delayed indefinitely', 'Ignored by default'], 'Concrete and tied to outcomes'],
            ['What does healthy %s iteration look like?', ['Small improvements over multiple cycles', 'One giant rewrite each week', 'No follow-up', 'Only cosmetic updates'], 'Small improvements over multiple cycles'],
            ['A common %s anti-pattern is:', ['Optimizing for assumptions without validation', 'Checking constraints early', 'Aligning stakeholders', 'Tracking outcomes'], 'Optimizing for assumptions without validation'],
            ['When conflicts arise in %s priorities, teams should:', ['Use data and agreed goals to decide', 'Pick randomly', 'Always choose fastest option', 'Delay all decisions'], 'Use data and agreed goals to decide'],
            ['Sustainable %s improvements usually require:', ['Cross-functional collaboration', 'Solo decision-making only', 'Zero communication', 'Ignoring technical constraints'], 'Cross-functional collaboration'],
            ['What makes a %s solution maintainable?', ['Consistent patterns and clear ownership', 'Frequent ad-hoc exceptions', 'No conventions', 'Undocumented shortcuts'], 'Consistent patterns and clear ownership'],
            ['Before finalizing %s changes, teams should confirm:', ['The change improves target outcomes', 'It looks different', 'It uses more libraries', 'It increases complexity'], 'The change improves target outcomes'],
        ];

        $questions = [];
        $mcqTemplates = array_slice($templates, 0, self::QUIZ_QUESTION_COUNT - self::QUIZ_OPEN_ENDED_COUNT);

        foreach ($mcqTemplates as [$questionTemplate, $options, $answer]) {
            $questions[] = [
                'question' => sprintf($questionTemplate, $topic),
                'question_type' => 'multiple_choice',
                'options' => $options,
                'answer' => $answer,
            ];
        }

        $questions[] = [
            'question' => sprintf('Explain one high-impact workflow where %s improves product or engineering outcomes.', $topic),
            'question_type' => 'essay',
            'rubric' => 'Strong answer explains context, action, and measurable impact.',
            'answer' => 'Should include a realistic scenario, the applied practice, and clear impact.',
        ];
        $questions[] = [
            'question' => sprintf('Write a short query or pseudo-query to track a core %s outcome over time.', $topic),
            'question_type' => 'short_query',
            'rubric' => 'Includes a metric, grouping or filtering logic, and readable structure.',
            'answer' => 'Any valid query-like response that tracks a meaningful metric with clear logic.',
        ];

        return $questions;
    }

    private function extractQuizGradeFromModelContent(string $content): array
    {
        $decoded = json_decode($content, true);

        if (! is_array($decoded) && preg_match('/\{[\s\S]*\}/', $content, $matches) === 1) {
            $decoded = json_decode($matches[0], true);
        }

        if (! is_array($decoded)) {
            return [
                'score' => 50,
                'feedback' => 'Unable to parse grading response. Partial credit applied.',
            ];
        }

        $score = (int) ($decoded['score'] ?? 50);
        $feedback = trim((string) ($decoded['feedback'] ?? 'Grading completed.'));

        if ($feedback === '') {
            $feedback = 'Grading completed.';
        }

        return [
            'score' => max(0, min(100, $score)),
            'feedback' => $feedback,
        ];
    }

    private function extractProfileFromModelContent(string $content): array
    {
        $decoded = json_decode($content, true);

        if (! is_array($decoded) && preg_match('/\{[\s\S]*\}/', $content, $matches) === 1) {
            $decoded = json_decode($matches[0], true);
        }

        if (! is_array($decoded)) {
            return $this->emptyProfile();
        }

        $normalizeRows = static function (mixed $rows, string $a, string $b, string $c, string $d): array {
            if (! is_array($rows)) {
                return [];
            }

            $result = [];
            foreach ($rows as $row) {
                if (! is_array($row)) {
                    continue;
                }

                $result[] = [
                    $a => trim((string) ($row[$a] ?? '')),
                    $b => trim((string) ($row[$b] ?? '')),
                    $c => trim((string) ($row[$c] ?? '')),
                    $d => trim((string) ($row[$d] ?? '')),
                ];
            }

            return array_values(array_filter($result, static fn (array $row): bool => implode('', $row) !== ''));
        };

        $skills = [];
        if (is_array($decoded['skills'] ?? null)) {
            foreach ($decoded['skills'] as $item) {
                if (is_string($item) && trim($item) !== '') {
                    $skills[] = trim($item);
                }
            }
        }

        return [
            'applicant_name' => trim((string) ($decoded['applicant_name'] ?? '')),
            'title' => trim((string) ($decoded['title'] ?? '')),
            'email' => trim((string) ($decoded['email'] ?? '')),
            'phone' => trim((string) ($decoded['phone'] ?? '')),
            'location' => trim((string) ($decoded['location'] ?? '')),
            'summary' => trim((string) ($decoded['summary'] ?? '')),
            'skills' => array_values(array_unique($skills)),
            'education' => $normalizeRows($decoded['education'] ?? [], 'school', 'period', 'degree', 'description'),
            'experience' => $normalizeRows($decoded['experience'] ?? [], 'company', 'period', 'role', 'description'),
        ];
    }

    private function fallbackProfileFromSource(string $sourceText): array
    {
        $profile = $this->emptyProfile();

        $profile['applicant_name'] = $this->extractApplicantName($sourceText);
        $profile['summary'] = $this->fallbackBackgroundSummary($sourceText);
        $profile['skills'] = $this->keywordMatchSkills($sourceText);

        if (preg_match('/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i', $sourceText, $emailMatch) === 1) {
            $profile['email'] = trim($emailMatch[0]);
        }

        if (preg_match('/(?:\+?\d[\d\s\-\(\)]{7,}\d)/', $sourceText, $phoneMatch) === 1) {
            $profile['phone'] = trim($phoneMatch[0]);
        }

        $lines = preg_split('/\R+/', $sourceText) ?: [];
        foreach ($lines as $line) {
            $clean = trim((string) Str::of($line)->squish());

            if ($profile['location'] === '' && preg_match('/\b(city|street|st\.|avenue|ave|road|rd|philippines|usa|uk|remote)\b/i', $clean) === 1) {
                $profile['location'] = Str::limit($clean, 80, '');
            }

            if ($profile['title'] === '' && preg_match('/\b(developer|engineer|designer|manager|analyst|accountant|specialist)\b/i', $clean) === 1) {
                $profile['title'] = Str::limit($clean, 80, '');
            }
        }

        return $profile;
    }

    private function emptyProfile(): array
    {
        return [
            'applicant_name' => '',
            'title' => '',
            'email' => '',
            'phone' => '',
            'location' => '',
            'summary' => '',
            'skills' => [],
            'education' => [],
            'experience' => [],
        ];
    }

    private function modelIndicatesNoCaptions(string $content): bool
    {
        $decoded = json_decode($content, true);

        if (is_array($decoded) && ($decoded['no_captions'] ?? false) === true) {
            return true;
        }

        if (preg_match('/\{[\s\S]*\}/', $content, $matches) === 1) {
            $candidate = json_decode($matches[0], true);
            if (is_array($candidate) && ($candidate['no_captions'] ?? false) === true) {
                return true;
            }
        }

        return Str::contains(Str::lower($content), 'no captions');
    }

    private function buildSkillInputs(Request $request, array $validated, string $prompt): array
    {
        $content = [
            [
                'type' => 'text',
                'text' => $prompt,
            ],
        ];

        $plainTextSource = [];

        if (! empty($validated['resume_text'])) {
            $plainTextSource[] = $validated['resume_text'];
            $content[] = [
                'type' => 'text',
                'text' => "Resume text:\n".$validated['resume_text'],
            ];
        }

        if (! empty($validated['pdf_url'])) {
            $content[] = [
                'type' => 'file',
                'file' => [
                    'filename' => $this->filenameFromUrl($validated['pdf_url']),
                    'file_data' => $validated['pdf_url'],
                ],
            ];
        }

        $uploadedPdf = $request->file('pdf');
        if ($uploadedPdf instanceof UploadedFile) {
            $binary = file_get_contents($uploadedPdf->getRealPath());
            $content[] = [
                'type' => 'file',
                'file' => [
                    'filename' => $uploadedPdf->getClientOriginalName() ?: 'resume.pdf',
                    'file_data' => 'data:application/pdf;base64,'.base64_encode($binary ?: ''),
                ],
            ];

            $extracted = $this->pdfTextExtractor->extractFromUpload($uploadedPdf);
            if ($extracted !== '') {
                $plainTextSource[] = $extracted;
                $content[] = [
                    'type' => 'text',
                    'text' => "Extracted PDF text:\n".$extracted,
                ];
            }
        }

        return [$content, implode("\n", $plainTextSource)];
    }
}