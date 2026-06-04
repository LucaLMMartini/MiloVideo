from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import aiofiles
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse, Response

from .config import settings
from .jobs import schedule
from .report import render_markdown
from .schemas import FactItemUpdate, Job, JobCreated, JobMetaUpdate
from .storage import (
    list_jobs,
    load_job,
    new_job,
    recover_orphaned_jobs,
    report_path,
    save_job,
    upload_path,
)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    n = recover_orphaned_jobs()
    if n:
        log.warning("Recovered %d orphaned job(s) left 'running' by a previous restart.", n)
    yield


app = FastAPI(title="video-feature-extractor", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "provider": settings.provider}


@app.post("/jobs", response_model=JobCreated)
async def create_job(
    video: UploadFile = File(...),
    provider: str | None = Form(default=None),
    model: str | None = Form(default=None),
    sample_fps: float | None = Form(default=None),
    vision_detail: str | None = Form(default=None),
    use_audio: bool | None = Form(default=None),
    target_lang: str | None = Form(default=None),
    brand: str | None = Form(default=None),
    model_name: str | None = Form(default=None),
    trim: str | None = Form(default=None),
) -> JobCreated:
    if not video.filename:
        raise HTTPException(400, "Missing filename.")

    job_id = uuid.uuid4().hex[:12]
    dest = upload_path(job_id, video.filename)

    max_bytes = settings.max_upload_mb * 1024 * 1024
    written = 0
    async with aiofiles.open(dest, "wb") as out:
        while chunk := await video.read(1024 * 1024):
            written += len(chunk)
            if written > max_bytes:
                await out.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(413, f"File exceeds {settings.max_upload_mb} MB limit.")
            await out.write(chunk)

    job = new_job(
        job_id,
        video.filename,
        written,
        provider or settings.provider,
        model=model,
        sample_fps=sample_fps,
        vision_detail=vision_detail,
        use_audio=use_audio,
        target_lang=target_lang,
        brand=brand,
        model_name=model_name,
        trim=trim,
    )
    schedule(job.id, dest)
    return JobCreated(id=job.id, status=job.status)


@app.get("/jobs", response_model=list[Job])
def get_jobs() -> list[Job]:
    return list_jobs()


@app.get("/jobs/{job_id}", response_model=Job)
def get_job(job_id: str) -> Job:
    job = load_job(job_id)
    if job is None:
        raise HTTPException(404, "Job not found.")
    return job


@app.patch("/jobs/{job_id}", response_model=Job)
def update_job_meta(job_id: str, meta: JobMetaUpdate) -> Job:
    job = load_job(job_id)
    if job is None:
        raise HTTPException(404, "Job not found.")
    job.brand = meta.brand
    job.model_name = meta.model_name
    job.trim = meta.trim
    save_job(job)
    return job


@app.patch("/jobs/{job_id}/items", response_model=Job)
def update_fact_item(job_id: str, upd: FactItemUpdate) -> Job:
    """Review a single fact/feature: set its status and/or edit its text."""
    job = load_job(job_id)
    if job is None:
        raise HTTPException(404, "Job not found.")
    if job.result is None:
        raise HTTPException(409, "Analysis is not finished yet.")

    items = job.result.atomic_facts if upd.kind == "fact" else job.result.features
    if not (0 <= upd.index < len(items)):
        raise HTTPException(404, "Item index out of range.")
    item = items[upd.index]

    if upd.status is not None:
        item.status = upd.status
    if upd.kind == "fact" and upd.fact is not None:
        item.fact = upd.fact
    if upd.kind == "feature":
        if upd.label is not None:
            item.label = upd.label
        if upd.description is not None:
            item.description = upd.description

    save_job(job)
    report_path(job.id).write_text(render_markdown(job, job.result))
    return job


@app.get("/jobs/{job_id}/report", response_class=PlainTextResponse)
def get_report(job_id: str) -> str:
    p = report_path(job_id)
    if not p.exists():
        raise HTTPException(404, "Report not ready.")
    return p.read_text()


@app.get("/jobs/{job_id}/video")
def get_video(job_id: str):
    job = load_job(job_id)
    if job is None:
        raise HTTPException(404, "Job not found.")
    video = upload_path(job.id, job.filename)
    if not video.exists():
        raise HTTPException(404, "Video missing on disk.")
    return FileResponse(video, media_type="video/mp4", filename=job.filename)


@app.get("/jobs/{job_id}/frame")
def get_frame(job_id: str, t: float = Query(0.0, ge=0, description="Timestamp in seconds.")):
    """Extract a single JPEG frame at timestamp `t` — used as evidence screenshots."""
    job = load_job(job_id)
    if job is None:
        raise HTTPException(404, "Job not found.")
    video = upload_path(job.id, job.filename)
    if not video.exists():
        raise HTTPException(404, "Video missing on disk.")
    try:
        import cv2
    except ImportError:
        raise HTTPException(503, "OpenCV is not installed; cannot extract frames.")

    cap = cv2.VideoCapture(str(video))
    try:
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000.0)
        ok, frame = cap.read()
        if not ok or frame is None:
            raise HTTPException(404, "Could not read a frame at that timestamp.")
        ok_enc, buf = cv2.imencode(".jpg", frame)
        if not ok_enc:
            raise HTTPException(500, "Could not encode the frame.")
    finally:
        cap.release()

    return Response(
        content=buf.tobytes(),
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@app.get("/jobs/{job_id}/pptx")
def get_pptx(job_id: str):
    """Generate a management-ready PowerPoint report from the fact-sheet."""
    job = load_job(job_id)
    if job is None:
        raise HTTPException(404, "Job not found.")
    if job.result is None:
        raise HTTPException(409, "Analysis is not finished yet.")

    from .report_pptx import generate_pptx

    video = upload_path(job.id, job.filename)
    data = generate_pptx(job, job.result, video if video.exists() else None)

    stem = Path(job.filename).stem
    safe = "".join(c for c in stem if c.isalnum() or c in " _-").strip() or "report"
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{safe}_Bericht.pptx"'},
    )


_SEARCH_EXPAND_PROMPT = (
    "You expand a search query into closely related terms for matching text in an automotive "
    "infotainment UI fact-sheet. Given the user's term (in any language), return JSON "
    '{"terms": [...]} with 5-12 lowercase terms: synonyms, common abbreviations, and BOTH the '
    "German and English equivalents. Keep them specific and relevant; no explanations."
)


@app.get("/search-terms")
def search_terms(q: str = Query(..., min_length=1)):
    """Expand a search query into synonyms + DE/EN equivalents (falls back to the raw term)."""
    import json as _json

    base = q.strip().lower()
    terms = {base}
    if settings.openai_api_key:
        try:
            from openai import OpenAI

            client = OpenAI(api_key=settings.openai_api_key)
            resp = client.chat.completions.create(
                model=settings.openai_report_model,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": _SEARCH_EXPAND_PROMPT},
                    {"role": "user", "content": q.strip()},
                ],
            )
            data = _json.loads(resp.choices[0].message.content or "{}")
            for t in data.get("terms", []):
                if isinstance(t, str) and t.strip():
                    terms.add(t.strip().lower())
        except Exception as e:
            log.warning("search-terms expansion failed: %s", e)
    return {"terms": sorted(terms)}
