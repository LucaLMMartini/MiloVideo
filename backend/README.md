# Backend

FastAPI service. Handles video uploads, runs analysis jobs in the background,
and serves results as JSON + rendered Markdown.

## Requirements

Python **3.10+**. On this machine only Python 3.9 is available — install a newer
version first, e.g. via Homebrew:

```bash
brew install python@3.12
```

## Run

```bash
cd backend
python3.12 -m venv .venv     # or any Python >=3.10
source .venv/bin/activate
pip install -U pip
pip install -e .
uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/docs for the OpenAPI explorer.

## Providers

A "provider" is anything that turns a video file into an `AnalysisResult`.
The interface lives in `app/providers/base.py`. Two stubs ship out of the box:

- `mock` — returns canned data, no network calls. Default.
- `gemini` — placeholder for a video-native model (not implemented).
- `claude_frames` — placeholder for frame-sampling + LLM (not implemented).

Select with `PROVIDER=mock|gemini|claude_frames` in `.env`.

## Storage layout

```
backend/data/
├── uploads/<job_id>/<filename>       original video
├── jobs/<job_id>.json                job state + result
└── reports/<job_id>.md               rendered Markdown report
```
