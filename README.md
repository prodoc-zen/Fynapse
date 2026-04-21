# Fynapse Resume Compatibility Platform

AI-assisted resume analysis and job compatibility matching with a React frontend and Laravel API backend.

## Full Tech Stack

### Frontend

- React 19
- Vite 8
- JavaScript (ES Modules)
- Tailwind CSS 4 (plus custom CSS)
- Lucide React icons

### Backend

- Laravel 12 (PHP 8.2+)
- OpenRouter Chat Completions API
- Symfony HTTP client via Laravel `Http` facade
- Symfony Process (available in backend dependencies)
- `smalot/pdfparser` for PDF text extraction

### AI and Data

- OpenRouter model routing
- Default general model: `openai/gpt-4o-mini`
- Default quiz video model: `google/gemini-2.5-flash`
- JSON-driven job catalog and quiz seed data

### Storage and Runtime

- Laravel local filesystem for generated quiz cache
- File-based session/cache and sync queue runtime recommended for local development

### Testing and Tooling

- PHPUnit (Laravel feature tests)
- ESLint for frontend linting
- Vite production build pipeline

## Project Structure

- `Client/` React dashboard UI and local JSON datasets
- `Server/` Laravel API, services, and tests
- `Client/src/data/jobs.json` role requirements, learning resources, and YouTube links
- `Client/src/data/proficiency_quizzes.json` optional provided quiz JSON

## Core Features

- Resume text and PDF upload analysis
- Applicant name extraction
- Background summary generation
- Strict skill extraction with anti-assumption guardrails
- Job compatibility scoring and visualization
- Proficiency quiz generation from YouTube input through OpenRouter
- 20-question quiz sessions with timer-style UX
- Default 20-question fallback quiz when AI quiz data is unavailable
- AI-generated quiz caching and reuse by skill
- Resume update and downloadable HTML resume after passing proficiency tests with verified skill changes

## API Endpoints

Base path: `/api/v1/resume`

- `POST /make`
- `POST /profile`
- `POST /name`
- `POST /summary`
- `POST /skills`
- `POST /proficiency-quiz`

## Environment Variables

Set these in `Server/.env`:

```env
OPENROUTER_API_KEY=your_key_here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_VIDEO_MODEL=google/gemini-2.5-flash

SESSION_DRIVER=file
CACHE_STORE=file
QUEUE_CONNECTION=sync
```

Optional frontend env in `Client/.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## Local Setup

### 1) Backend

```powershell
Set-Location "C:\Users\JC'S laptop\HACKATHON\Server"
composer install
Copy-Item .env.example .env -ErrorAction SilentlyContinue
php artisan key:generate
php artisan config:clear
php artisan serve --host=127.0.0.1 --port=8000
```

### 2) Frontend

```powershell
Set-Location "C:\Users\JC'S laptop\HACKATHON\Client"
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173`.

## Proficiency Quiz Video Behavior

The quiz endpoint uses OpenRouter with YouTube URL reference input (text payload), not direct `video_url` multimodal payload. This avoids provider-level video endpoint limitations while keeping quiz generation tied to the supplied video link.

Response behavior:

- If AI returns valid quiz JSON, backend stores it in cache and marks it `ai_generated=true`.
- If captions/transcript are unavailable or AI output is invalid, backend serves a default fallback quiz and marks it `ai_generated=false`.
- Cached quiz is reused on next request for the same skill to avoid unnecessary regeneration.

Quiz size requirement:

- Quiz payload is normalized to 20 questions.

## Verification Commands

Backend feature tests:

```powershell
Set-Location "C:\Users\JC'S laptop\HACKATHON\Server"
php artisan test --filter=ResumeMakerTest
```

Frontend production build:

```powershell
Set-Location "C:\Users\JC'S laptop\HACKATHON\Client"
npm run build
```
