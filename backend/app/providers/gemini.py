from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from ..config import settings
from ..schemas import FactSheet
from .base import ProgressFn, VideoAnalysisProvider
from ._shared import SYSTEM_PROMPT, extract_json

log = logging.getLogger(__name__)


class GeminiProvider(VideoAnalysisProvider):
    name = "gemini"
    model_id = "gemini-2.0-flash-exp"

    async def analyze(self, video_path: Path, progress: ProgressFn | None = None) -> FactSheet:
        if not settings.google_api_key:
            raise RuntimeError(
                "GOOGLE_API_KEY is not set. Add it to backend/.env or switch PROVIDER=mock."
            )

        try:
            from google import genai
            from google.genai import types
        except ImportError as e:
            raise RuntimeError(
                "google-genai is not installed. Run `pip install -e '.[gemini]'` in backend/."
            ) from e

        client = genai.Client(api_key=settings.google_api_key)

        def _run() -> str:
            if progress:
                progress("upload", "Video wird hochgeladen…")
            log.info("gemini: uploading %s", video_path)
            uploaded = client.files.upload(file=str(video_path))
            while uploaded.state and uploaded.state.name == "PROCESSING":
                log.info("gemini: waiting for file processing")
                import time
                time.sleep(2)
                uploaded = client.files.get(name=uploaded.name)

            if uploaded.state and uploaded.state.name == "FAILED":
                raise RuntimeError(f"Gemini file upload failed: {uploaded.state}")

            if progress:
                progress("vision", "Video wird analysiert…")
            log.info("gemini: generating analysis")
            response = client.models.generate_content(
                model=self.model_id,
                contents=[uploaded, "Analyze this video per the instructions."],
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    temperature=0.2,
                ),
            )
            return response.text or ""

        raw = await asyncio.to_thread(_run)
        data = extract_json(raw)
        return FactSheet.model_validate(data)
