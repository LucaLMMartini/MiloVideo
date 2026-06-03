from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import aiofiles
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse

from .config import settings
from .jobs import schedule
from .schemas import Job, JobCreated
from .storage import (
    list_jobs,
    load_job,
    new_job,
    recover_orphaned_jobs,
    report_path,
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
