# Frontend

Next.js (App Router, TypeScript, Tailwind). Talks to the FastAPI backend.

## Run

```bash
cd frontend
npm install
NEXT_PUBLIC_API_BASE=http://localhost:8000 npm run dev
```

Open http://localhost:3000.

## Pages

- `/` — upload a video, see all jobs.
- `/jobs/[id]` — job status, rendered Markdown report, link to source video.
