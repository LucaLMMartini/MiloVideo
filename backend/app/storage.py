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


def new_job(job_id: str, filename: str, size_bytes: int, provider: str) -> Job:
    now = _now()
    job = Job(
        id=job_id,
        filename=filename,
        size_bytes=size_bytes,
        status=JobStatus.queued,
        created_at=now,
        updated_at=now,
        provider=provider,
    )
    save_job(job)
    return job
