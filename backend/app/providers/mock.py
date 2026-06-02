from __future__ import annotations

import asyncio
from pathlib import Path

from ..schemas import AnalysisResult, Evidence, Feature, UIFlow, UIScreen
from .base import VideoAnalysisProvider


class MockProvider(VideoAnalysisProvider):
    name = "mock"

    async def analyze(self, video_path: Path) -> AnalysisResult:
        await asyncio.sleep(1.5)
        return AnalysisResult(
            summary=(
                f"Mock analysis of {video_path.name}. Replace PROVIDER with a real "
                "implementation to get actual results."
            ),
            features=[
                Feature(
                    label="Wireless smartphone projection",
                    kind="connectivity",
                    description="Phone screen mirrored without a cable.",
                    evidence=[Evidence(t_start=12.0, t_end=18.0, note="Pairing dialog shown.")],
                ),
                Feature(
                    label="Voice assistant wake word",
                    kind="digital_feature",
                    description="Hands-free invocation observed.",
                    evidence=[Evidence(t_start=42.5, note="Assistant responds to spoken prompt.")],
                ),
            ],
            screens=[
                UIScreen(id="home", name="Home", description="Top-level dashboard."),
                UIScreen(id="settings", name="Settings", description="Configuration root."),
                UIScreen(id="connectivity", name="Connectivity"),
            ],
            flows=[
                UIFlow(
                    from_screen="home",
                    to_screen="connectivity",
                    steps=3,
                    interactions=["Open menu", "Tap Settings", "Tap Connectivity"],
                    evidence=[Evidence(t_start=8.0, t_end=14.0)],
                ),
            ],
            notes=["Mock provider: numbers and labels are illustrative only."],
        )
