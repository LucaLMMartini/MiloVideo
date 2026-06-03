"use client";

import { useEffect, useState } from "react";
import { formatDuration, type Job } from "@/lib/api";

// Ordered pipeline stages with human labels. The audio stages are skipped when a
// run is vision-only; they simply never become the active stage.
const STAGES: { key: string; label: string }[] = [
  { key: "transcribe", label: "Transkript wird erstellt" },
  { key: "translate", label: "Transkript wird übersetzt" },
  { key: "prestructure", label: "Voiceover wird vorstrukturiert" },
  { key: "sample", label: "Frames werden extrahiert" },
  { key: "vision", label: "Bilder werden analysiert" },
  { key: "transcript_facts", label: "Fakten aus Transkript" },
  { key: "consolidate", label: "Ergebnisse werden konsolidiert" },
];

export function ProgressView({ job }: { job: Job }) {
  const p = job.progress;
  const activeIndex = p ? STAGES.findIndex((s) => s.key === p.stage) : -1;
  const hasCounter = p?.current != null && p?.total != null;
  const pct = hasCounter ? Math.round((p!.current! / p!.total!) * 100) : null;

  // Tick once a second so the elapsed time counts up live.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = (now - Date.parse(job.created_at)) / 1000;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">
          {p ? p.message : "Warten auf Start…"}
          {hasCounter && (
            <span className="text-neutral-500">
              {" "}
              (Batch {p!.current} von {p!.total})
            </span>
          )}
        </p>
        <p className="text-xs text-neutral-500 mt-0.5">Läuft seit {formatDuration(elapsed)}</p>
        {pct != null && (
          <div className="mt-2 h-1.5 w-full rounded bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
            <div
              className="h-full bg-neutral-900 dark:bg-neutral-100 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      <ol className="space-y-1.5">
        {STAGES.map((s, i) => {
          const done = activeIndex > i;
          const active = activeIndex === i;
          return (
            <li
              key={s.key}
              className={`flex items-center gap-2 text-sm ${
                active
                  ? "text-neutral-900 dark:text-neutral-100 font-medium"
                  : done
                    ? "text-neutral-500"
                    : "text-neutral-400 dark:text-neutral-600"
              }`}
            >
              <span className="inline-flex h-4 w-4 items-center justify-center">
                {done ? "✓" : active ? "●" : "○"}
              </span>
              {s.label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
