# Fynapse Client

Fynapse helps you check your resume, see how well it matches jobs, test your skills, and generate a cleaner updated resume.

## Tech Stack

- React 19 (Vite)
- JavaScript (ES modules)
- Tailwind-style utility classes for UI styling
- Lucide React icons
- Native Fetch API for backend communication

## Connected Backend Technologies

- Laravel 12 API
- OpenRouter chat completions API
- PDF parsing via OpenRouter file parser + local extraction fallback

## Skill Level Model (Dreyfus)

The dashboard uses this level system for match scores:

- 0-20: Novice
- 21-40: Advanced Beginner
- 41-60: Competent
- 61-80: Proficient
- 81-100: Expert

## Core Features

- Resume source intake:
	- Paste resume text or upload a local PDF.
	- Optional context notes can be merged into analysis input.
- Staged analysis pipeline:
	- Name extraction
	- Background summary extraction
	- Skills extraction and job compatibility scoring
- Job-fit dashboard:
	- Ranked job list by compatibility score
	- Matched skills and gaps per selected job
	- Learning resource links for each skill gap
- Mixed proficiency testing:
	- Multiple choice questions (human/rule graded)
	- Short query prompts, code problems, and essays (AI graded)
	- Combined final score from human + AI grading
- Resume upgrading:
	- Uses structured profile extraction from resume source
	- Generates a polished ATS-style HTML resume draft
	- Download-ready updated resume file

## How It Works (Start To End)

This is the full cycle in simple terms.

1. You upload or paste your resume
- You can paste text or upload a PDF file.

2. The app sends your data to the API
- The client sends form data to the Laravel backend.
- If you uploaded a PDF, the file is included in that request.

3. PDF is prepared in 2 ways
- The backend reads the PDF file as binary and converts it to base64 so the AI endpoint can read it.
- The backend also tries local text extraction from the same PDF using a parser.

4. AI and rule-based checks run together
- The app asks AI for name, summary, and skills.
- It also runs keyword matching from the extracted text.
- AI skills are filtered so only skills with evidence in your source text are kept.

5. Skills are matched against job requirements
- Each job has required skills.
- The app computes matched skills, missing skills, and a match percent.
- The Dreyfus level is assigned from that score.

6. You take proficiency tests
- Questions include multiple-choice plus a few AI-graded open questions.
- Final score combines rule grading + AI grading.

7. Resume update is generated
- The app requests structured profile data (name, title, skills, education, experience).
- It builds a cleaner resume HTML draft and enables download.

8. What gets stored
- Resume analysis itself is handled per request.
- Generated proficiency quizzes may be cached on the server for faster reuse.

## Code Map (Exact Files And Functions)

This section tells you exactly where each step is implemented.

### A) User input and analyze trigger (Client)

- File: `Client/src/components/HomeRoute.jsx`
	- UI input field and analyze button live here.
- File: `Client/src/main.jsx`
	- `handleAnalyze()`
		- Main analysis pipeline trigger.
	- `appendSourceFields(formData)`
		- Merges pasted text, optional context, and uploaded PDF into request payload.
	- `handlePdfFileChange(file)`
		- Handles local PDF selection status.

### B) API route entry (Server)

- File: `Server/routes/api.php`
	- `POST /api/v1/resume/name`
	- `POST /api/v1/resume/summary`
	- `POST /api/v1/resume/skills`
	- `POST /api/v1/resume/profile`
	- `POST /api/v1/resume/proficiency-quiz`
	- `POST /api/v1/resume/proficiency-grade`

### C) Name extraction (Server)

- File: `Server/app/Http/Controllers/ResumeMakerController.php`
	- `name(Request $request)`
		- Calls OpenRouter and extracts applicant name.
	- `extractApplicantNameFromModelContent()`
		- Parses name from AI output.
	- `extractApplicantName()`
		- Fallback heuristic from source text if AI output is weak.

### D) Summary extraction (Server)

- File: `Server/app/Http/Controllers/ResumeMakerController.php`
	- `summary(Request $request)`
		- Calls OpenRouter to generate short background summary.
	- `extractBackgroundSummaryFromModelContent()`
		- Parses summary JSON.
	- `fallbackBackgroundSummary()`
		- Safe fallback when summary is missing.

### E) Skills extraction (Server)

- File: `Server/app/Http/Controllers/ResumeMakerController.php`
	- `skills(Request $request)`
		- Main hybrid logic: keyword match + AI match + guardrails.
	- `FIXED_SKILL_PROMPT`
		- Strict prompt that constrains allowed skill output.
	- `keywordMatchSkills(text)`
		- Rule-based matching from source text.
	- `extractSkillsFromModelContent(content)`
		- Parses skills from AI output (JSON-first parsing).
	- `normalizeSkills(items)`
		- Cleans aliases and keeps only allowlisted skills.
	- `guardAiSkillsAgainstSource(skills, sourceText)`
		- Keeps only AI skills that have evidence in source text.
	- `hasSkillEvidenceInText(skill, text)`
		- Evidence checker (exact + fuzzy matching).

### F) PDF processing details (Server)

- File: `Server/app/Http/Controllers/ResumeMakerController.php`
	- In `skills()`, `name()`, `summary()`, `profile()`, and `make()`:
		- Reads uploaded PDF bytes.
		- Converts to base64 string (`data:application/pdf;base64,...`) for AI file input.
		- Adds file-parser plugin payload when calling OpenRouter.
- File: `Server/app/Services/PdfTextExtractorService.php`
	- `extractFromUpload(UploadedFile $file)`
		- Local parser path to extract plain text from PDF.

### G) OpenRouter request layer (Server)

- File: `Server/app/Services/OpenRouterService.php`
	- `chatWithPayload(array $payload)`
		- Sends request to OpenRouter `/chat/completions`.
	- `model()`
		- Resolves active model (with fallback).
	- `normalizeContent(mixed $message)`
		- Normalizes returned model message into a clean text string.

### H) Job scoring and Dreyfus level (Client)

- File: `Client/src/main.jsx`
	- `compatibilityBand(score)`
		- Dreyfus mapping:
			- 0-20 Novice
			- 21-40 Advanced Beginner
			- 41-60 Competent
			- 61-80 Proficient
			- 81-100 Expert
	- `evaluatedJobs` (`useMemo` block)
		- Calculates matched skills, missing skills, and percent score.
- File: `Client/src/components/DashboardRoute.jsx`
	- Renders top role, compatibility, level, matched skills, and gaps.

### I) Quiz generation and grading (Server + Client)

- File: `Server/app/Http/Controllers/ResumeMakerController.php`
	- `proficiencyQuiz(Request $request)`
		- Builds mixed quiz (MCQ + limited open-ended).
	- `normalizeQuizQuestions(...)`
		- Validates and normalizes incoming/generated questions.
	- `enforceQuizMix(...)`
		- Enforces final composition (MCQ + 2 open-ended).
	- `proficiencyGrade(Request $request)`
		- Grades open-ended answers with AI and MCQ with deterministic rule path.
- File: `Client/src/main.jsx`
	- `startProficiencyTest(...)`
		- Calls quiz endpoint and opens quiz modal.
	- `handleQuizAnswer(...)`
		- Handles MCQ selection flow.
	- `submitOpenEndedAnswer(...)`
		- Sends open-ended response for AI grading.
	- `finishQuiz(...)`
		- Combines human + AI scores into final result.

### J) Resume update generation (Client + Server)

- File: `Server/app/Http/Controllers/ResumeMakerController.php`
	- `profile(Request $request)`
		- Extracts structured profile JSON (name, contact, skills, education, experience).
- File: `Client/src/main.jsx`
	- `generateUpdatedResume()`
		- Calls `/api/v1/resume/profile`, merges verified skills, builds final resume HTML.
	- `buildResumeHtml(...)`
		- Creates downloadable HTML resume layout.
	- `downloadResume()`
		- Downloads generated HTML resume file.

## Unique Value

- Combines deterministic scoring and AI grading in one assessment flow.
- Keeps resume generation tied to extracted source profile rather than generic template text.
- Uses one continuous UX from intake to role match to skill validation to resume update.

## Roadmap

Below are planned improvements, with where they will be implemented.

1. Better PDF reliability for complex formats
- Why: Some resumes have multi-column layouts and parser noise.
- Main code targets:
	- `Server/app/Services/PdfTextExtractorService.php`
	- `Server/app/Http/Controllers/ResumeMakerController.php` (PDF handling blocks)

2. Stronger name detection
- Why: Some resumes hide or stylize names.
- Main code targets:
	- `ResumeMakerController::name()`
	- `extractApplicantNameFromModelContent()`
	- `extractApplicantName()` fallback logic

3. Per-question AI feedback in quiz result screen
- Why: Users need to know why they got a score.
- Main code targets:
	- `Client/src/main.jsx` (`submitOpenEndedAnswer`, quiz result modal rendering)
	- `Server/app/Http/Controllers/ResumeMakerController.php` (`proficiencyGrade` response fields)

4. Export direct PDF (not only HTML)
- Why: Easier to share and upload resume.
- Main code targets:
	- `Client/src/main.jsx` (`downloadResume`)
	- Add backend document export endpoint if needed.

5. Personalized learning roadmap for missing skills
- Why: Turn skill gaps into next-step actions.
- Main code targets:
	- `Client/src/components/DashboardRoute.jsx`
	- `Client/src/data/jobs.json`
	- Optional AI roadmap endpoint in `ResumeMakerController`.

6. User history and progress tracking
- Why: Track score growth across attempts.
- Main code targets:
	- New database tables + models in `Server/database/migrations` and `Server/app/Models`
	- New API endpoints in `Server/routes/api.php`
	- Client history UI in `Client/src`.

## Local Development

From the Client folder:

```bash
npm install
npm run dev
```

By default, the client calls the API at:

```bash
http://127.0.0.1:8000
```

Set `VITE_API_BASE_URL` in `.env` if your Laravel API runs on a different host/port.
