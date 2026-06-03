from datetime import datetime
from enum import Enum
from typing import Literal
from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"


class Evidence(BaseModel):
    """A timestamped pointer back into the source video, with the direct proof."""
    t_start: float = Field(ge=0, description="Start timestamp in seconds.")
    t_end: float | None = Field(default=None, ge=0)
    source: Literal["visual", "voiceover", "both"] = Field(
        default="visual", description="Which modality this evidence comes from."
    )
    quote: str | None = Field(
        default=None, description="Verbatim voiceover excerpt, when the proof is spoken."
    )
    note: str | None = Field(
        default=None, description="What is shown on screen / why this supports the claim."
    )


class AtomicFact(BaseModel):
    """A single, indivisible fact about the vehicle, with metadata and direct proof.

    Example: "Has a 12.3-inch digital instrument cluster." No fixed taxonomy.
    """
    fact: str = Field(description="One atomic, self-contained statement.")
    vehicle_model: str | None = Field(
        default=None, description="The car model this fact pertains to."
    )
    evidence: list[Evidence] = []


class Feature(BaseModel):
    """A recognized feature/behaviour that is not necessarily an atomic fact.

    Example: "Display brightness adapts when driving through a tunnel." The label
    is free-form on purpose: the model decides what to call it. No fixed taxonomy.
    """
    label: str
    description: str | None = None
    evidence: list[Evidence] = []


class TranscriptSegment(BaseModel):
    """One timestamped line of the voiceover transcript."""
    t_start: float = Field(ge=0)
    t_end: float | None = Field(default=None, ge=0)
    text: str


class Transcript(BaseModel):
    """The voiceover transcript, always produced, optionally translated."""
    language: str | None = Field(default=None, description="Detected source language.")
    text: str = Field(default="", description="Original full transcript text.")
    target_language: str | None = Field(default=None, description="Requested target language.")
    translated_text: str | None = Field(
        default=None, description="Translation into target_language (None if same language)."
    )
    segments: list[TranscriptSegment] = []


class FactSheet(BaseModel):
    """The analysis output: a vehicle fact-sheet of atomic facts + recognized features."""
    vehicle_model: str | None = Field(
        default=None, description="Primary vehicle model identified in the video, if any."
    )
    summary: str
    atomic_facts: list[AtomicFact] = []
    features: list[Feature] = []
    notes: list[str] = []
    transcript: Transcript | None = None


class JobProgress(BaseModel):
    """Live progress of a running job: which stage, and an optional X-of-Y counter."""
    stage: str = Field(description="Machine key, e.g. 'vision'.")
    message: str = Field(description="Human-readable status line.")
    current: int | None = Field(default=None, description="Current item (e.g. batch number).")
    total: int | None = Field(default=None, description="Total items, if known.")


class Job(BaseModel):
    id: str
    filename: str
    size_bytes: int
    status: JobStatus = JobStatus.queued
    progress: JobProgress | None = None
    created_at: datetime
    updated_at: datetime
    provider: str
    # Run configuration (overrides server defaults; logged for reproducibility).
    model: str | None = None
    sample_fps: float | None = None
    vision_detail: str | None = None
    use_audio: bool | None = None
    target_lang: str | None = None
    error: str | None = None
    result: FactSheet | None = None
    report_path: str | None = None


class JobCreated(BaseModel):
    id: str
    status: JobStatus
