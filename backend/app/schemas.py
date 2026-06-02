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
    """A timestamped pointer back into the source video."""
    t_start: float = Field(ge=0, description="Start timestamp in seconds.")
    t_end: float | None = Field(default=None, ge=0)
    note: str | None = None


class Feature(BaseModel):
    """A digital/connectivity capability observed in the video.

    The label is free-form on purpose: the model decides what to call it.
    No fixed taxonomy.
    """
    label: str
    kind: Literal["digital_feature", "connectivity", "ui_element", "other"] = "other"
    description: str | None = None
    evidence: list[Evidence] = []


class UIScreen(BaseModel):
    """A distinguishable UI state/screen identified in the video."""
    id: str
    name: str
    description: str | None = None
    evidence: list[Evidence] = []


class UIFlow(BaseModel):
    """A path between two UI screens, with the number of interaction steps it took."""
    from_screen: str
    to_screen: str
    steps: int = Field(ge=1, description="Number of discrete interactions (taps, swipes, voice commands, ...).")
    interactions: list[str] = []
    evidence: list[Evidence] = []


class AnalysisResult(BaseModel):
    summary: str
    features: list[Feature] = []
    screens: list[UIScreen] = []
    flows: list[UIFlow] = []
    notes: list[str] = []


class Job(BaseModel):
    id: str
    filename: str
    size_bytes: int
    status: JobStatus = JobStatus.queued
    created_at: datetime
    updated_at: datetime
    provider: str
    error: str | None = None
    result: AnalysisResult | None = None
    report_path: str | None = None


class JobCreated(BaseModel):
    id: str
    status: JobStatus
