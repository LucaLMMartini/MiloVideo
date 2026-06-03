from __future__ import annotations

from .schemas import Evidence, FactSheet, Job


def _fmt_ts(t: float) -> str:
    m, s = divmod(int(t), 60)
    h, m = divmod(m, 60)
    return f"{h:02d}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def _fmt_evidence(ev: list[Evidence]) -> str:
    if not ev:
        return ""
    parts = []
    for e in ev:
        span = _fmt_ts(e.t_start) + (f"–{_fmt_ts(e.t_end)}" if e.t_end else "")
        detail_bits = [f"_{e.source}_"]
        if e.note:
            detail_bits.append(e.note)
        if e.quote:
            detail_bits.append(f"“{e.quote}”")
        parts.append(f"{span} ({', '.join(detail_bits)})")
    return " · ".join(parts)


def render_markdown(job: Job, r: FactSheet) -> str:
    lines: list[str] = []
    lines.append(f"# Vehicle Fact-Sheet — {job.filename}")
    lines.append("")
    if r.vehicle_model:
        lines.append(f"**Vehicle model:** {r.vehicle_model}")
        lines.append("")
    lines.append(f"- **Job:** `{job.id}`")
    lines.append(f"- **Provider:** `{job.provider}`")
    if job.model:
        lines.append(f"- **Model:** `{job.model}`")
    if job.sample_fps is not None:
        lines.append(f"- **Frame sampling:** {job.sample_fps}/s")
    if job.vision_detail:
        lines.append(f"- **Vision detail:** `{job.vision_detail}`")
    if job.use_audio is not None:
        lines.append(f"- **Multimodal (voiceover):** {'on' if job.use_audio else 'off'}")
    lines.append(f"- **Size:** {job.size_bytes / (1024 * 1024):.1f} MB")
    lines.append("")

    lines.append("## Summary")
    lines.append("")
    lines.append(r.summary.strip() or "_No summary provided._")
    lines.append("")

    lines.append("## Atomic facts")
    lines.append("")
    if not r.atomic_facts:
        lines.append("_None reported._")
        lines.append("")
    else:
        for f in r.atomic_facts:
            lines.append(f"### {f.fact}")
            if f.vehicle_model:
                lines.append("")
                lines.append(f"**Model:** {f.vehicle_model}")
            ev = _fmt_evidence(f.evidence)
            if ev:
                lines.append("")
                lines.append(f"**Evidence:** {ev}")
            lines.append("")

    lines.append("## Recognized features")
    lines.append("")
    if not r.features:
        lines.append("_None reported._")
        lines.append("")
    else:
        for f in r.features:
            lines.append(f"### {f.label}")
            if f.description:
                lines.append("")
                lines.append(f.description)
            ev = _fmt_evidence(f.evidence)
            if ev:
                lines.append("")
                lines.append(f"**Evidence:** {ev}")
            lines.append("")

    if r.notes:
        lines.append("## Notes")
        lines.append("")
        for n in r.notes:
            lines.append(f"- {n}")
        lines.append("")

    return "\n".join(lines)
