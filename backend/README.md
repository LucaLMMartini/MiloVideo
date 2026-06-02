# Backend

FastAPI service. Handles video uploads, runs analysis jobs in the background,
and serves results as JSON + rendered Markdown.

## Run

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
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
