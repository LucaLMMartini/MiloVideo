# video-feature-extractor

Extracts information about **digital features, connectivity, and UI behavior** from (long) videos.
Focus: how a UI is structured, how many steps it takes to get from one UI point to another,
which features are visible/used, and what connectivity capabilities show up on screen.

This project is intentionally **taxonomy-free** — there is no fixed list of categories.
The model is asked to discover features and UI flows; the schema only fixes their *shape*,
not their content.

## Stack

- **Backend:** FastAPI (Python 3.11+), async job processing, pluggable model providers.
- **Frontend:** Next.js (App Router, TypeScript, Tailwind).
- **Storage:** local filesystem under `backend/data/` (videos, reports, job state).

## Layout

```
backend/    FastAPI app + provider abstraction
frontend/   Next.js UI
```

See `backend/README.md` and `frontend/README.md` for run instructions.

## Status

Scaffold. Provider implementations (Gemini video-native, Claude frame-sampling)
are stubs that return mock results so the end-to-end flow runs without API keys.
Wire a real provider by filling in the corresponding module under
`backend/app/providers/` and setting the matching env vars.
