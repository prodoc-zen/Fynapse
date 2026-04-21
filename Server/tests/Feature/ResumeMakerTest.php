<?php

namespace Tests\Feature;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ResumeMakerTest extends TestCase
{
    protected function tearDown(): void
    {
        putenv('OPENROUTER_API_KEY');
        putenv('OPENROUTER_BASE_URL');
        putenv('OPENROUTER_MODEL');

        parent::tearDown();
    }

    public function test_resume_maker_endpoint_sends_multimodal_payload(): void
    {
        putenv('OPENROUTER_API_KEY=test-key');
        putenv('OPENROUTER_BASE_URL=https://openrouter.ai/api/v1');
        putenv('OPENROUTER_MODEL=anthropic/claude-sonnet-4');
        $_ENV['OPENROUTER_API_KEY'] = 'test-key';
        $_ENV['OPENROUTER_BASE_URL'] = 'https://openrouter.ai/api/v1';
        $_ENV['OPENROUTER_MODEL'] = 'anthropic/claude-sonnet-4';

        Http::fake([
            'https://openrouter.ai/api/v1/chat/completions' => Http::response([
                'id' => 'chatcmpl-resume-1',
                'model' => 'anthropic/claude-sonnet-4',
                'choices' => [
                    [
                        'message' => [
                            'role' => 'assistant',
                            'content' => 'Generated resume output.',
                        ],
                    ],
                ],
            ], 200),
        ]);

        $response = $this->postJson('/api/v1/resume/make', [
            'prompt' => 'Generate an ATS-friendly resume from this data.',
            'resume_text' => 'Frontend developer with React and TypeScript experience.',
            'pdf_url' => 'https://bitcoin.org/bitcoin.pdf',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('message', 'Resume generated successfully.')
            ->assertJsonPath('data.model', 'anthropic/claude-sonnet-4')
            ->assertJsonPath('data.content', 'Generated resume output.')
            ->assertJsonPath('data.source.used_resume_text', true)
            ->assertJsonPath('data.source.used_pdf_url', true);

        Http::assertSent(function ($request) {
            $payload = $request->data();

            return $request->url() === 'https://openrouter.ai/api/v1/chat/completions'
                && $request->hasHeader('Authorization', 'Bearer test-key')
                && data_get($payload, 'plugins.0.id') === 'file-parser'
                && data_get($payload, 'plugins.0.pdf.engine') === 'mistral-ocr'
                && data_get($payload, 'messages.0.content.0.type') === 'text'
                && data_get($payload, 'messages.0.content.2.type') === 'file'
                && data_get($payload, 'messages.0.content.2.file.file_data') === 'https://bitcoin.org/bitcoin.pdf';
        });
    }

    public function test_resume_maker_endpoint_accepts_uploaded_pdf(): void
    {
        putenv('OPENROUTER_API_KEY=test-key');
        putenv('OPENROUTER_BASE_URL=https://openrouter.ai/api/v1');
        $_ENV['OPENROUTER_API_KEY'] = 'test-key';
        $_ENV['OPENROUTER_BASE_URL'] = 'https://openrouter.ai/api/v1';

        Http::fake([
            'https://openrouter.ai/api/v1/chat/completions' => Http::response([
                'id' => 'chatcmpl-resume-2',
                'model' => 'anthropic/claude-sonnet-4',
                'choices' => [
                    [
                        'message' => [
                            'role' => 'assistant',
                            'content' => 'Resume generated from uploaded PDF.',
                        ],
                    ],
                ],
            ], 200),
        ]);

        $pdfFile = UploadedFile::fake()->create('resume.pdf', 100, 'application/pdf');

        $response = $this->post('/api/v1/resume/make', [
            'prompt' => 'Generate a resume summary.',
            'pdf' => $pdfFile,
        ], [
            'Accept' => 'application/json',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.source.used_pdf_upload', true);

        Http::assertSent(function ($request) {
            $fileData = data_get($request->data(), 'messages.0.content.1.file.file_data');

            return is_string($fileData) && str_starts_with($fileData, 'data:application/pdf;base64,');
        });
    }

    public function test_skills_endpoint_filters_ai_assumptions_and_keeps_text_backed_normalization(): void
    {
        putenv('OPENROUTER_API_KEY=test-key');
        putenv('OPENROUTER_BASE_URL=https://openrouter.ai/api/v1');
        $_ENV['OPENROUTER_API_KEY'] = 'test-key';
        $_ENV['OPENROUTER_BASE_URL'] = 'https://openrouter.ai/api/v1';

        Http::fake([
            'https://openrouter.ai/api/v1/chat/completions' => Http::response([
                'id' => 'chatcmpl-skills-1',
                'model' => 'openai/gpt-4o-mini',
                'choices' => [
                    [
                        'message' => [
                            'role' => 'assistant',
                            'content' => '{"skills":["JavaScript","AWS"]}',
                        ],
                    ],
                ],
            ], 200),
        ]);

        $response = $this->postJson('/api/v1/resume/skills', [
            'resume_text' => 'Built UI features with Javscript and css in previous role.',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('message', 'Skill analysis succeeded.')
            ->assertJsonPath('data.analysis_path', 'keyword-match-plus-openrouter-reconfirm');

        $skills = $response->json('data.skills');
        $aiSkills = $response->json('data.ai_skills');

        $this->assertContains('JavaScript', $skills);
        $this->assertContains('CSS', $skills);
        $this->assertNotContains('AWS', $skills);
        $this->assertContains('JavaScript', $aiSkills);
        $this->assertNotContains('AWS', $aiSkills);
    }

    public function test_summary_endpoint_returns_background_summary(): void
    {
        putenv('OPENROUTER_API_KEY=test-key');
        putenv('OPENROUTER_BASE_URL=https://openrouter.ai/api/v1');
        $_ENV['OPENROUTER_API_KEY'] = 'test-key';
        $_ENV['OPENROUTER_BASE_URL'] = 'https://openrouter.ai/api/v1';

        Http::fake([
            'https://openrouter.ai/api/v1/chat/completions' => Http::response([
                'id' => 'chatcmpl-summary-1',
                'model' => 'openai/gpt-4o-mini',
                'choices' => [
                    [
                        'message' => [
                            'role' => 'assistant',
                            'content' => '{"background_summary":"Frontend-focused applicant with React and TypeScript project experience."}',
                        ],
                    ],
                ],
            ], 200),
        ]);

        $response = $this->postJson('/api/v1/resume/summary', [
            'resume_text' => 'Built reusable React components and shipped TypeScript features.',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('message', 'Background summary extracted.')
            ->assertJsonPath('data.background_summary', 'Frontend-focused applicant with React and TypeScript project experience.');
    }

    public function test_profile_endpoint_returns_structured_profile(): void
    {
        putenv('OPENROUTER_API_KEY=test-key');
        putenv('OPENROUTER_BASE_URL=https://openrouter.ai/api/v1');
        $_ENV['OPENROUTER_API_KEY'] = 'test-key';
        $_ENV['OPENROUTER_BASE_URL'] = 'https://openrouter.ai/api/v1';

        Http::fake([
            'https://openrouter.ai/api/v1/chat/completions' => Http::response([
                'id' => 'chatcmpl-profile-1',
                'model' => 'openai/gpt-4o-mini',
                'choices' => [
                    [
                        'message' => [
                            'role' => 'assistant',
                            'content' => '{"applicant_name":"Jane Doe","title":"Frontend Developer","email":"jane@example.com","phone":"+123-456-7890","location":"Any City","summary":"Frontend developer focused on React and UI quality.","skills":["React","JavaScript"],"education":[{"school":"Borcelle University","period":"2022-2026","degree":"BS Computer Science","description":"Graduated with honors."}],"experience":[{"company":"Acme Inc","period":"2026-2028","role":"Frontend Engineer","description":"Built reusable UI systems."}]}'
                        ],
                    ],
                ],
            ], 200),
        ]);

        $response = $this->postJson('/api/v1/resume/profile', [
            'resume_text' => 'Jane Doe Frontend Developer jane@example.com +123-456-7890 Any City React JavaScript',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('message', 'Profile extracted successfully.')
            ->assertJsonPath('data.profile.applicant_name', 'Jane Doe')
            ->assertJsonPath('data.profile.education.0.school', 'Borcelle University')
            ->assertJsonPath('data.profile.experience.0.company', 'Acme Inc');
    }

    public function test_proficiency_quiz_uses_provided_json_when_present(): void
    {
        Storage::fake('local');

        $providedQuiz = [
            [
                'question' => 'What does UI stand for?',
                'options' => ['User Interface', 'Unified Input', 'User Integration', 'Universal Interaction'],
                'answer' => 'User Interface',
            ],
        ];

        Http::fake();

        $response = $this->postJson('/api/v1/resume/proficiency-quiz', [
            'skill' => 'UI/UX',
            'provided_quiz' => $providedQuiz,
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('message', 'Using provided quiz JSON.')
            ->assertJsonPath('data.source', 'provided-json')
            ->assertJsonPath('data.questions.0.question', 'What does UI stand for?');

        Http::assertNothingSent();
    }

    public function test_proficiency_quiz_uses_openrouter_url_reference_input(): void
    {
        Storage::fake('local');

        putenv('OPENROUTER_API_KEY=test-key');
        putenv('OPENROUTER_BASE_URL=https://openrouter.ai/api/v1');
        $_ENV['OPENROUTER_API_KEY'] = 'test-key';
        $_ENV['OPENROUTER_BASE_URL'] = 'https://openrouter.ai/api/v1';

        Http::fake([
            'https://openrouter.ai/api/v1/chat/completions' => Http::response([
                'id' => 'chatcmpl-quiz-1',
                'model' => 'google/gemini-2.5-flash',
                'choices' => [
                    [
                        'message' => [
                            'role' => 'assistant',
                            'content' => '{"questions":[{"question":"What principle is emphasized?","options":["Consistency","Latency","Compression","Scraping"],"answer":"Consistency"},{"question":"Which design action is shown?","options":["A/B testing","Wireframing","CI pipeline setup","Schema migration"],"answer":"Wireframing"},{"question":"What user outcome is targeted?","options":["Clarity","Obfuscation","Vendor lock-in","Overfitting"],"answer":"Clarity"},{"question":"Which collaboration pattern appears?","options":["Peer review","Monolithic ownership","No feedback","Silent deploy"],"answer":"Peer review"},{"question":"What delivery focus is highlighted?","options":["Iterative improvement","Big-bang rewrite","Manual rollback","Code golf"],"answer":"Iterative improvement"}]}'
                        ],
                    ],
                ],
            ], 200),
        ]);

        $url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

        $response = $this->postJson('/api/v1/resume/proficiency-quiz', [
            'skill' => 'UI/UX',
            'youtube_url' => $url,
            'model' => 'google/gemini-2.5-flash',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('message', 'Proficiency quiz generated.')
            ->assertJsonPath('data.source', 'generated-openrouter')
            ->assertJsonPath('data.generation_mode', 'url-reference')
            ->assertJsonPath('data.questions.0.answer', 'Consistency');

        Http::assertSent(function ($request) use ($url) {
            $payload = $request->data();

            return $request->url() === 'https://openrouter.ai/api/v1/chat/completions'
                && $request->hasHeader('Authorization', 'Bearer test-key')
                && data_get($payload, 'messages.0.content.2.type') === 'text'
                && data_get($payload, 'messages.0.content.2.text') === 'YouTube URL: '.$url;
        });
    }
}
