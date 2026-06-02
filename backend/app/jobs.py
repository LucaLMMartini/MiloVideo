from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from .providers import get_provider
from .report import render_markdown
from .schemas import JobStatus
from .storage import load_job, report_path, save_job

log = logging.getLogger(__name__)


async def run_job(job_id: str, video_path: Path) -> None:
    job = load_job(job_id)
    if job is None:
        log.error("run_job: job %s not found", job_id)
        return

    job.status = JobStatus.running
    save_job(job)

    try:
        provider = get_provider(job.provider)
        result = await provider.analyze(video_path)

        report = render_markdown(job, result)
        rp = report_path(job.id)
        rp.write_text(report)

        job.result = result
        job.report_path = str(rp)
        job.status = JobStatus.succeeded
    except Exception as e:
        log.exception("Job %s failed", job_id)
        job.status = JobStatus.failed
        job.error = f"{type(e).__name__}: {e}"
    finally:
        save_job(job)


def schedule(job_id: str, video_path: Path) -> asyncio.Task:
    return asyncio.create_task(run_job(job_id, video_path))
