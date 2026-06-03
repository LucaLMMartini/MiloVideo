from __future__ import annotations

import asyncio
from pathlib import Path

from ..schemas import AtomicFact, Evidence, FactSheet, Feature
from .base import ProgressFn, VideoAnalysisProvider


class MockProvider(VideoAnalysisProvider):
    name = "mock"

    async def analyze(self, video_path: Path, progress: ProgressFn | None = None) -> FactSheet:
        # Walk through fake stages so the live status UI can be tested without an API key.
        stages = [
            ("transcribe", "Transkript wird erstellt…", None, None),
            ("prestructure", "Voiceover wird vorstrukturiert…", None, None),
            ("sample", "Frames werden extrahiert…", None, None),
            ("vision", "Bilder werden analysiert", 1, 3),
            ("vision", "Bilder werden analysiert", 2, 3),
            ("vision", "Bilder werden analysiert", 3, 3),
            ("consolidate", "Ergebnisse werden konsolidiert…", None, None),
        ]
        for stage, message, current, total in stages:
            if progress:
                progress(stage, message, current, total)
            await asyncio.sleep(0.6)
        return FactSheet(
            vehicle_model="Example Motors EX (demo)",
            summary=(
                f"Mock analysis of {video_path.name}. Replace PROVIDER with a real "
                "implementation to get actual results."
            ),
            atomic_facts=[
                AtomicFact(
                    fact="Has a 12.3-inch digital instrument cluster.",
                    vehicle_model="Example Motors EX (demo)",
                    evidence=[
                        Evidence(
                            t_start=12.0,
                            t_end=18.0,
                            source="both",
                            quote="…the fully digital 12.3-inch cluster…",
                            note="Cluster shown behind the steering wheel.",
                        )
                    ],
                ),
                AtomicFact(
                    fact="Supports wireless smartphone projection.",
                    vehicle_model="Example Motors EX (demo)",
                    evidence=[
                        Evidence(t_start=42.5, source="visual", note="Pairing dialog shown.")
                    ],
                ),
            ],
            features=[
                Feature(
                    label="Adaptive display brightness",
                    description="Center display dims when driving through a tunnel.",
                    evidence=[
                        Evidence(t_start=88.0, t_end=95.0, source="visual",
                                 note="Screen visibly dims as the car enters a tunnel.")
                    ],
                ),
            ],
            notes=["Mock provider: labels and values are illustrative only."],
        )
