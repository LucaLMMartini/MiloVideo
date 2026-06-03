from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from .config import settings
from .schemas import Job, JobStatus


def _now() -> datetime:
    return datetime.now(timezone.utc)


def upload_path(job_id: str, filename: str) -> Path:
    d = settings.uploads_dir / job_id
    d.mkdir(parents=True, exist_ok=True)
    return d / filename


def job_path(job_id: str) -> Path:
    return settings.jobs_dir / f"{job_id}.json"


def report_path(job_id: str) -> Path:
    return settings.reports_dir / f"{job_id}.md"


def save_job(job: Job) -> None:
    job.updated_at = _now()
    job_path(job.id).write_text(job.model_dump_json(indent=2))


def load_job(job_id: str) -> Job | None:
    p = job_path(job_id)
    if not p.exists():
        return None
    return Job.model_validate_json(p.read_text())


def list_jobs() -> list[Job]:
    jobs: list[Job] = []
    for p in sorted(settings.jobs_dir.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            jobs.append(Job.model_validate_json(p.read_text()))
        except Exception:
            continue
    return jobs


def recover_orphaned_jobs() -> int:
    """Mark jobs stuck in running/queued as failed.

    A server restart (e.g. uvicorn --reload) kills the in-flight background task,
    leaving its job 'running' forever. On boot we fail those so the UI is honest.
    """
    n = 0
    for job in list_jobs():
        if job.status in (JobStatus.running, JobStatus.queued):
            job.status = JobStatus.failed
            job.error = "Interrupted by a server restart (e.g. --reload). Please re-run."
            job.progress = None
            save_job(job)
            n += 1
    return n


def new_job(
    job_id: str,
    filename: str,
    size_bytes: int,
    provider: str,
    *,
    model: str | None = None,
    sample_fps: float | None = None,
    vision_detail: str | None = None,
    use_audio: bool | None = None,
    target_lang: str | None = None,
    brand: str | None = None,
    model_name: str | None = None,
    trim: str | None = None,
) -> Job:
    now = _now()
    job = Job(
        id=job_id,
        filename=filename,
        size_bytes=size_bytes,
        status=JobStatus.queued,
        created_at=now,
        updated_at=now,
        provider=provider,
        model=model,
        sample_fps=sample_fps,
        vision_detail=vision_detail,
        use_audio=use_audio,
        target_lang=target_lang,
        brand=brand,
        model_name=model_name,
        trim=trim,
    )
    save_job(job)
    return job
