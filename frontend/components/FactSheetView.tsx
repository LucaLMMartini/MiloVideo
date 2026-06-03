"use client";

import type { AtomicFact, Evidence, FactSheet, Feature } from "@/lib/api";

function fmtTs(t: number): string {
  const total = Math.floor(t);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const mm = `${m}:${String(s).padStart(2, "0")}`;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : mm;
}

function evidenceTitle(e: Evidence): string {
  const bits: string[] = [e.source];
  if (e.note) bits.push(e.note);
  if (e.quote) bits.push(`“${e.quote}”`);
  return bits.join(" — ");
}

function EvidenceChips({
  evidence,
  onSeek,
}: {
  evidence: Evidence[];
  onSeek: (t: number) => void;
}) {
  if (!evidence?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {evidence.map((e, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSeek(e.t_start)}
          title={evidenceTitle(e)}
          className="inline-flex items-center gap-1 rounded border border-neutral-300 dark:border-neutral-700 px-1.5 py-0.5 text-xs font-mono hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          ▶ {fmtTs(e.t_start)}
          {e.t_end != null ? `–${fmtTs(e.t_end)}` : ""}
          <span className="text-[10px] text-neutral-500 not-italic">{e.source}</span>
        </button>
      ))}
    </div>
  );
}

export function FactSheetView({
  sheet,
  onSeek,
}: {
  sheet: FactSheet;
  onSeek: (t: number) => void;
}) {
  return (
    <div className="space-y-6">
      {sheet.vehicle_model && (
        <p className="text-sm">
          <span className="font-semibold">Vehicle model:</span> {sheet.vehicle_model}
        </p>
      )}

      {sheet.summary && (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-2">
            Summary
          </h3>
          <p className="text-sm leading-relaxed">{sheet.summary}</p>
        </section>
      )}

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-2">
          Atomic facts ({sheet.atomic_facts.length})
        </h3>
        {sheet.atomic_facts.length === 0 ? (
          <p className="text-sm text-neutral-500">None reported.</p>
        ) : (
          <ul className="space-y-3">
            {sheet.atomic_facts.map((f: AtomicFact, i) => (
              <li
                key={i}
                className="border border-neutral-200 dark:border-neutral-800 rounded p-3"
              >
                <p className="text-sm font-medium">{f.fact}</p>
                {f.vehicle_model && (
                  <p className="text-xs text-neutral-500 mt-0.5">{f.vehicle_model}</p>
                )}
                <EvidenceChips evidence={f.evidence} onSeek={onSeek} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-2">
          Recognized features ({sheet.features.length})
        </h3>
        {sheet.features.length === 0 ? (
          <p className="text-sm text-neutral-500">None reported.</p>
        ) : (
          <ul className="space-y-3">
            {sheet.features.map((f: Feature, i) => (
              <li
                key={i}
                className="border border-neutral-200 dark:border-neutral-800 rounded p-3"
              >
                <p className="text-sm font-medium">{f.label}</p>
                {f.description && (
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">
                    {f.description}
                  </p>
                )}
                <EvidenceChips evidence={f.evidence} onSeek={onSeek} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {sheet.notes.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-2">
            Notes
          </h3>
          <ul className="list-disc list-inside text-sm space-y-1">
            {sheet.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
