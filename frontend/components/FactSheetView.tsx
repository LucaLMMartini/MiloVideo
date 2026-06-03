"use client";

import { useEffect, useState } from "react";
import {
  frameUrl,
  searchTerms,
  type AtomicFact,
  type Evidence,
  type FactSheet,
  type Feature,
} from "@/lib/api";
import { Lightbox } from "@/components/Lightbox";

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

function evidenceText(ev: Evidence[]): string {
  return ev.map((e) => `${e.note ?? ""} ${e.quote ?? ""}`).join(" ");
}

// One evidence entry: timestamp chip (seek) + a screenshot toggle that lazily
// loads a small thumbnail only when clicked (so we don't render every frame).
function EvidenceItem({
  e,
  jobId,
  onSeek,
  onOpenImage,
}: {
  e: Evidence;
  jobId: string;
  onSeek: (t: number) => void;
  onOpenImage: (src: string, alt: string) => void;
}) {
  const [show, setShow] = useState(false);
  const src = frameUrl(jobId, e.t_start);
  const alt = `Frame at ${fmtTs(e.t_start)}`;
  return (
    <div className="inline-flex flex-col gap-1">
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => onSeek(e.t_start)}
          title={evidenceTitle(e)}
          className="inline-flex items-center gap-1 rounded border border-neutral-300 dark:border-neutral-700 px-1.5 py-0.5 text-xs font-mono hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          ▶ {fmtTs(e.t_start)}
          {e.t_end != null ? `–${fmtTs(e.t_end)}` : ""}
          <span className="text-[10px] text-neutral-500 not-italic">{e.source}</span>
        </button>
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          title={show ? "Screenshot ausblenden" : "Screenshot anzeigen"}
          aria-pressed={show}
          className={`rounded border px-1.5 py-0.5 text-xs transition-colors ${
            show
              ? "border-neutral-400 dark:border-neutral-500 bg-neutral-100 dark:bg-neutral-800"
              : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          }`}
        >
          📷
        </button>
      </div>
      {show && (
        <button
          type="button"
          onClick={() => onOpenImage(src, alt)}
          title="Screenshot vergrößern"
          className="block"
        >
          <img
            src={src}
            alt={alt}
            loading="lazy"
            className="w-44 aspect-video object-cover rounded border border-neutral-200 dark:border-neutral-800 bg-black cursor-zoom-in"
          />
        </button>
      )}
    </div>
  );
}

function EvidenceList({
  evidence,
  jobId,
  onSeek,
  onOpenImage,
}: {
  evidence: Evidence[];
  jobId: string;
  onSeek: (t: number) => void;
  onOpenImage: (src: string, alt: string) => void;
}) {
  if (!evidence?.length) return null;
  return (
    <div className="flex flex-wrap gap-3 mt-2">
      {evidence.map((e, i) => (
        <EvidenceItem key={i} e={e} jobId={jobId} onSeek={onSeek} onOpenImage={onOpenImage} />
      ))}
    </div>
  );
}

export function FactSheetView({
  sheet,
  jobId,
  onSeek,
}: {
  sheet: FactSheet;
  jobId: string;
  onSeek: (t: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [terms, setTerms] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  // Expand the query into synonyms + DE/EN equivalents (debounced).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setTerms([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const t = await searchTerms(q);
        if (!cancelled) setTerms(t.length ? t : [q.toLowerCase()]);
      } catch {
        if (!cancelled) setTerms([q.toLowerCase()]); // fall back to plain substring
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query]);

  const active = query.trim().length >= 2 && terms.length > 0;
  const matches = (text: string) => {
    const h = text.toLowerCase();
    return terms.some((t) => h.includes(t));
  };

  const facts = active
    ? sheet.atomic_facts.filter((f) =>
        matches(`${f.fact} ${f.vehicle_model ?? ""} ${evidenceText(f.evidence)}`),
      )
    : sheet.atomic_facts;
  const features = active
    ? sheet.features.filter((f) =>
        matches(`${f.label} ${f.description ?? ""} ${evidenceText(f.evidence)}`),
      )
    : sheet.features;

  return (
    <div className="space-y-6">
      {lightbox && (
        <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      )}
      {sheet.vehicle_model && (
        <p className="text-sm">
          <span className="font-semibold">Vehicle model:</span> {sheet.vehicle_model}
        </p>
      )}

      {/* Search across facts & features — matches synonyms + DE/EN equivalents. */}
      <div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Suche in Fakten & Features (z. B. „Nachrichten“ findet auch „messages“, „sms“)…"
          className="w-full border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-3 py-2 text-sm"
        />
        {query.trim().length >= 2 && (
          <p className="text-xs text-neutral-500 mt-1">
            {searching
              ? "Suche…"
              : active
                ? `Treffer: ${facts.length} Fakten, ${features.length} Features · auch: ${terms
                    .slice(0, 8)
                    .join(", ")}`
                : "Keine verwandten Begriffe gefunden."}
          </p>
        )}
      </div>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-2">
          Atomic facts ({facts.length}
          {active ? ` / ${sheet.atomic_facts.length}` : ""})
        </h3>
        {facts.length === 0 ? (
          <p className="text-sm text-neutral-500">
            {active ? "Keine Treffer." : "None reported."}
          </p>
        ) : (
          <ul className="space-y-3">
            {facts.map((f: AtomicFact, i) => (
              <li
                key={i}
                className="border border-neutral-200 dark:border-neutral-800 rounded p-3"
              >
                <p className="text-sm font-medium">{f.fact}</p>
                {f.vehicle_model && (
                  <p className="text-xs text-neutral-500 mt-0.5">{f.vehicle_model}</p>
                )}
                <EvidenceList
                  evidence={f.evidence}
                  jobId={jobId}
                  onSeek={onSeek}
                  onOpenImage={(src, alt) => setLightbox({ src, alt })}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-2">
          Recognized features ({features.length}
          {active ? ` / ${sheet.features.length}` : ""})
        </h3>
        {features.length === 0 ? (
          <p className="text-sm text-neutral-500">
            {active ? "Keine Treffer." : "None reported."}
          </p>
        ) : (
          <ul className="space-y-3">
            {features.map((f: Feature, i) => (
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
                <EvidenceList
                  evidence={f.evidence}
                  jobId={jobId}
                  onSeek={onSeek}
                  onOpenImage={(src, alt) => setLightbox({ src, alt })}
                />
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
