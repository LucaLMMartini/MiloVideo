from __future__ import annotations

from .schemas import AnalysisResult, Evidence, Job


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
        parts.append(f"{span}" + (f" ({e.note})" if e.note else ""))
    return " · ".join(parts)


def render_markdown(job: Job, r: AnalysisResult) -> str:
    lines: list[str] = []
    lines.append(f"# Video Analysis — {job.filename}")
    lines.append("")
    lines.append(f"- **Job:** `{job.id}`")
    lines.append(f"- **Provider:** `{job.provider}`")
    lines.append(f"- **Size:** {job.size_bytes / (1024 * 1024):.1f} MB")
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append(r.summary.strip() or "_No summary provided._")
    lines.append("")

    lines.append("## Digital features & connectivity")
    lines.append("")
    if not r.features:
        lines.append("_None reported._")
    else:
        for f in r.features:
            lines.append(f"### {f.label}  _( {f.kind} )_")
            if f.description:
                lines.append("")
                lines.append(f.description)
            ev = _fmt_evidence(f.evidence)
            if ev:
                lines.append("")
                lines.append(f"**Evidence:** {ev}")
            lines.append("")

    lines.append("## UI screens")
    lines.append("")
    if not r.screens:
        lines.append("_None reported._")
    else:
        lines.append("| ID | Name | Description |")
        lines.append("| --- | --- | --- |")
        for s in r.screens:
            lines.append(f"| `{s.id}` | {s.name} | {s.description or ''} |")
        lines.append("")

    lines.append("## UI flows (steps between screens)")
    lines.append("")
    if not r.flows:
        lines.append("_None reported._")
    else:
        for f in r.flows:
            lines.append(f"### `{f.from_screen}` → `{f.to_screen}` — **{f.steps} step(s)**")
            if f.interactions:
                lines.append("")
                for i, step in enumerate(f.interactions, 1):
                    lines.append(f"{i}. {step}")
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
