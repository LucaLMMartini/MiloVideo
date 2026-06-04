"use client";

import { useEffect, useState } from "react";
import {
  frameUrl,
  searchTerms,
  updateFactItem,
  type AtomicFact,
  type Evidence,
  type FactSheet,
  type Feature,
  type Job,
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
        <button type="button" onClick={() => onOpenImage(src, alt)} title="Screenshot vergrößern" className="block">
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

type Entry =
  | { kind: "fact"; index: number; item: AtomicFact }
  | { kind: "feature"; index: number; item: Feature };

function ItemCard({
  entry,
  jobId,
  onSeek,
  onOpenImage,
  onJobUpdate,
}: {
  entry: Entry;
  jobId: string;
  onSeek: (t: number) => void;
  onOpenImage: (src: string, alt: string) => void;
  onJobUpdate: (job: Job) => void;
}) {
  const title = entry.kind === "fact" ? entry.item.fact : entry.item.label;
  const desc = entry.kind === "feature" ? entry.item.description ?? "" : "";
  const status = entry.item.status;

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [editDesc, setEditDesc] = useState(desc);
  const [saving, setSaving] = useState(false);

  async function apply(patch: Partial<{ status: typeof status; fact: string; label: string; description: string }>) {
    setSaving(true);
    try {
      const job = await updateFactItem(jobId, { kind: entry.kind, index: entry.index, ...patch });
      onJobUpdate(job);
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (entry.kind === "fact") await apply({ fact: editTitle });
    else await apply({ label: editTitle, description: editDesc });
    setEditing(false);
  }

  const rejected = status === "rejected";
  const verified = status === "verified";

  return (
    <li
      className={`border rounded p-3 ${
        rejected
          ? "border-neutral-200 dark:border-neutral-800 opacity-60"
          : verified
            ? "border-green-500/50 bg-green-50/40 dark:bg-green-950/20"
            : "border-neutral-200 dark:border-neutral-800"
      }`}
    >
      {editing ? (
        <div className="space-y-2">
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-2 py-1 text-sm"
          />
          {entry.kind === "feature" && (
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={2}
              placeholder="Beschreibung"
              className="w-full border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-2 py-1 text-sm"
            />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={saveEdit} disabled={saving}
              className="rounded bg-neutral-900 dark:bg-neutral-100 text-neutral-50 dark:text-neutral-900 px-3 py-1 text-xs font-medium disabled:opacity-50">
              Speichern
            </button>
            <button type="button" onClick={() => { setEditing(false); setEditTitle(title); setEditDesc(desc); }}
              className="rounded border border-neutral-300 dark:border-neutral-700 px-3 py-1 text-xs">
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-medium ${rejected ? "line-through" : ""}`}>{title}</p>
            {verified && <span className="shrink-0 text-xs text-green-600">✓ geprüft</span>}
            {rejected && <span className="shrink-0 text-xs text-red-600">✕ nicht im Bericht</span>}
          </div>
          {entry.kind === "feature" && desc && (
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">{desc}</p>
          )}
          {entry.kind === "fact" && entry.item.vehicle_model && (
            <p className="text-xs text-neutral-500 mt-0.5">{entry.item.vehicle_model}</p>
          )}
          <EvidenceList evidence={entry.item.evidence} jobId={jobId} onSeek={onSeek} onOpenImage={onOpenImage} />

          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" disabled={saving}
              onClick={() => apply({ status: verified ? "unreviewed" : "verified" })}
              className={`rounded border px-2 py-0.5 text-xs disabled:opacity-50 ${
                verified
                  ? "border-green-500 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30"
                  : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}>
              ✓ Geprüft
            </button>
            <button type="button" disabled={saving} onClick={() => setEditing(true)}
              className="rounded border border-neutral-300 dark:border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50">
              ✎ Bearbeiten
            </button>
            {rejected ? (
              <button type="button" disabled={saving} onClick={() => apply({ status: "unreviewed" })}
                className="rounded border border-neutral-300 dark:border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50">
                ↩ Wiederherstellen
              </button>
            ) : (
              <button type="button" disabled={saving} onClick={() => apply({ status: "rejected" })}
                className="rounded border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 px-2 py-0.5 text-xs hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50">
                ✕ Falsch
              </button>
            )}
          </div>
        </>
      )}
    </li>
  );
}

export function FactSheetView({
  sheet,
  jobId,
  onSeek,
  onJobUpdate,
}: {
  sheet: FactSheet;
  jobId: string;
  onSeek: (t: number) => void;
  onJobUpdate: (job: Job) => void;
}) {
  const [query, setQuery] = useState("");
  const [terms, setTerms] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

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
        if (!cancelled) setTerms([q.toLowerCase()]);
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

  const factEntries: Entry[] = sheet.atomic_facts
    .map((item, index) => ({ kind: "fact" as const, index, item }))
    .filter(({ item }) =>
      !active || matches(`${item.fact} ${item.vehicle_model ?? ""} ${evidenceText(item.evidence)}`),
    );
  const featureEntries: Entry[] = sheet.features
    .map((item, index) => ({ kind: "feature" as const, index, item }))
    .filter(({ item }) =>
      !active || matches(`${item.label} ${item.description ?? ""} ${evidenceText(item.evidence)}`),
    );

  const onOpenImage = (src: string, alt: string) => setLightbox({ src, alt });

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
                ? `Treffer: ${factEntries.length} Fakten, ${featureEntries.length} Features · auch: ${terms.slice(0, 8).join(", ")}`
                : "Keine verwandten Begriffe gefunden."}
          </p>
        )}
      </div>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-2">
          Atomic facts ({factEntries.length}
          {active ? ` / ${sheet.atomic_facts.length}` : ""})
        </h3>
        {factEntries.length === 0 ? (
          <p className="text-sm text-neutral-500">{active ? "Keine Treffer." : "None reported."}</p>
        ) : (
          <ul className="space-y-3">
            {factEntries.map((entry) => (
              <ItemCard key={entry.index} entry={entry} jobId={jobId} onSeek={onSeek}
                onOpenImage={onOpenImage} onJobUpdate={onJobUpdate} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-2">
          Recognized features ({featureEntries.length}
          {active ? ` / ${sheet.features.length}` : ""})
        </h3>
        {featureEntries.length === 0 ? (
          <p className="text-sm text-neutral-500">{active ? "Keine Treffer." : "None reported."}</p>
        ) : (
          <ul className="space-y-3">
            {featureEntries.map((entry) => (
              <ItemCard key={entry.index} entry={entry} jobId={jobId} onSeek={onSeek}
                onOpenImage={onOpenImage} onJobUpdate={onJobUpdate} />
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
