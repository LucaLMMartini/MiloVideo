"use client";

import { useEffect, useRef, useState, use as usePromise } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  API_BASE,
  formatDuration,
  getJob,
  getReport,
  reportDownloadUrl,
  reportStatus,
  searchTerms,
  startReport,
  updateJobMeta,
  type Job,
} from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { FactSheetView } from "@/components/FactSheetView";
import { ProgressView } from "@/components/ProgressView";
import { TranscriptView } from "@/components/TranscriptView";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function JobPage({ params }: PageProps) {
  const { id } = usePromise(params);
  const [job, setJob] = useState<Job | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [reportSeconds, setReportSeconds] = useState(0);
  const [meta, setMeta] = useState({ brand: "", model_name: "", trim: "" });
  const metaInit = useRef(false);
  const [query, setQuery] = useState("");
  const [terms, setTerms] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);

  // Expand the search query into synonyms + DE/EN equivalents (debounced).
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

  function downloadTranscript() {
    const t = job?.result?.transcript;
    if (!t) return;
    const esc = (s: string | null | undefined) =>
      (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const ts = (n: number) => {
      const s = Math.floor(n) % 60;
      const m = Math.floor(n / 60);
      return `${m}:${String(s).padStart(2, "0")}`;
    };
    const segs = t.segments?.length
      ? t.segments.map((s) => `<p><b>${ts(s.t_start)}</b> ${esc(s.text)}</p>`).join("")
      : `<p>${esc(t.text)}</p>`;
    const html =
      `<html><head><meta charset="utf-8"></head><body>` +
      `<h1>Transkript — ${esc(job?.filename)}</h1>` +
      (t.translated_text
        ? `<h2>Übersetzung (${esc(t.target_language)})</h2><p>${esc(t.translated_text)}</p>`
        : "") +
      `<h2>Original${t.language ? ` (${esc(t.language)})` : ""}</h2>${segs}</body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "application/msword" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${job?.filename ?? "transcript"}_Transkript.doc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Initialise the editable vehicle metadata once, from the loaded job.
  useEffect(() => {
    if (job && !metaInit.current) {
      setMeta({ brand: job.brand ?? "", model_name: job.model_name ?? "", trim: job.trim ?? "" });
      metaInit.current = true;
    }
  }, [job]);

  async function saveMeta() {
    if (!job) return;
    try {
      await updateJobMeta(job.id, {
        brand: meta.brand,
        modelName: meta.model_name,
        trim: meta.trim,
      });
    } catch {
      /* best-effort; the field keeps the typed value */
    }
  }

  // Count up elapsed seconds while the report is being generated.
  useEffect(() => {
    if (!reportBusy) return;
    setReportSeconds(0);
    const id = setInterval(() => setReportSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [reportBusy]);

  // Generate the PowerPoint in the background, then poll until it's ready.
  async function onGenerateReport() {
    if (!job) return;
    setReportBusy(true);
    setReportError(null);
    setReportUrl(null);
    try {
      await startReport(job.id);
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      for (let i = 0; i < 180; i++) {
        await sleep(2000);
        const st = await reportStatus(job.id);
        if (st.status === "ready") {
          setReportUrl(reportDownloadUrl(job.id));
          break;
        }
        if (st.status === "error") {
          setReportError(st.error || "Unbekannter Fehler bei der Erstellung.");
          break;
        }
      }
    } catch (e: unknown) {
      setReportError(e instanceof Error ? e.message : String(e));
    } finally {
      setReportBusy(false);
    }
  }

  function seekTo(seconds: number) {
    const v = videoRef.current;
    if (!v) return;
    v.pause(); // jump to the evidence frame but stay paused
    v.currentTime = seconds;
  }

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const j = await getJob(id);
        if (cancelled) return;
        setJob(j);
        if (j.status === "succeeded" && report === null) {
          try {
            const md = await getReport(id);
            if (!cancelled) setReport(md);
          } catch {
            /* report may briefly lag the status flip */
          }
        }
        if (j.status === "queued" || j.status === "running") {
          timer = setTimeout(tick, 2000);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, report]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!job) return <p className="text-sm text-neutral-500">Loading…</p>;

  const done = job.status === "succeeded" || job.status === "failed";
  const durationSec = done
    ? (Date.parse(job.updated_at) - Date.parse(job.created_at)) / 1000
    : null;

  return (
    <div className="space-y-6">
      {/* Sticky header: info on the left, smaller video on the right. */}
      <div className="sticky top-0 z-10 bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 pt-4 pb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="space-y-2">
            <Link href="/" className="text-sm text-neutral-500 hover:underline">
              ← back
            </Link>
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-semibold tracking-tight">{job.filename}</h1>
              <StatusBadge status={job.status} />
            </div>
            <p className="text-xs text-neutral-500">
              {job.id} · {(job.size_bytes / (1024 * 1024)).toFixed(1)} MB · {job.provider}
              {durationSec != null && ` · ⏱ ${formatDuration(durationSec)}`}
            </p>

            <div className="grid grid-cols-3 gap-2 pt-1">
              {([
                ["brand", "Marke"],
                ["model_name", "Modell"],
                ["trim", "Trim"],
              ] as const).map(([key, label]) => (
                <input
                  key={key}
                  value={meta[key]}
                  onChange={(e) => setMeta((m) => ({ ...m, [key]: e.target.value }))}
                  onBlur={saveMeta}
                  placeholder={label}
                  className="border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-2 py-1 text-xs w-full"
                />
              ))}
            </div>

            {job.result && (
              <>
                {/* Downloads / report — under the model inputs, side by side. */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {job.result.transcript && (
                    <button
                      type="button"
                      onClick={downloadTranscript}
                      className="inline-flex items-center gap-1 border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 rounded text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      ⬇ Transkript (Word)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onGenerateReport}
                    disabled={reportBusy}
                    className="inline-flex items-center gap-1 bg-neutral-900 dark:bg-neutral-100 text-neutral-50 dark:text-neutral-900 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
                  >
                    {reportBusy ? "Wird erstellt…" : reportUrl ? "🔄 PPTX neu" : "📊 PPTX erstellen"}
                  </button>
                  {!reportBusy && reportUrl && (
                    <a
                      href={reportUrl}
                      download={`${job.filename}_Bericht.pptx`}
                      className="inline-flex items-center gap-1 border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 rounded text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      ⬇ PPTX
                    </a>
                  )}
                </div>
                {reportBusy && (
                  <p className="text-xs text-neutral-500">Bericht wird erstellt… {reportSeconds}s</p>
                )}
                {reportError && <p className="text-xs text-red-600">{reportError}</p>}
              </>
            )}
          </div>
          <video
            ref={videoRef}
            src={`${API_BASE}/jobs/${job.id}/video`}
            controls
            className="w-full max-h-[38vh] object-contain rounded border border-neutral-200 dark:border-neutral-800 bg-black"
          />
        </div>

        {/* Search — full width at the very bottom of the header, closest to the facts. */}
        {job.result && (
          <div className="relative mt-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suche in Fakten & Features (z. B. „Nachrichten“ findet „messages“, „sms“)…"
              className="w-full border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-3 py-1.5 pr-28 text-sm"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-neutral-500">
                <span className="inline-block w-3 h-3 border-2 border-neutral-300 border-t-neutral-600 dark:border-neutral-600 dark:border-t-neutral-200 rounded-full animate-spin" />
                sucht…
              </span>
            )}
          </div>
        )}
      </div>

      {job.status === "failed" && (
        <pre className="text-sm bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200 p-3 rounded whitespace-pre-wrap">
          {job.error}
        </pre>
      )}

      <section className="space-y-6">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-3">
            Fact-sheet
          </h2>
          {job.result ? (
            <>
              <FactSheetView sheet={job.result} jobId={job.id} terms={terms} onSeek={seekTo} onJobUpdate={setJob} />
              {job.result.transcript && (
                <details className="mt-6" open>
                  <summary className="text-sm font-semibold uppercase tracking-wide text-neutral-500 cursor-pointer">
                    Transcript
                  </summary>
                  <div className="mt-3">
                    <TranscriptView transcript={job.result.transcript} onSeek={seekTo} />
                  </div>
                </details>
              )}
              {job.result.summary && (
                <details className="mt-6">
                  <summary className="text-sm font-semibold uppercase tracking-wide text-neutral-500 cursor-pointer">
                    Summary
                  </summary>
                  <p className="text-sm leading-relaxed mt-3">{job.result.summary}</p>
                </details>
              )}
              {report && (
                <details className="mt-6">
                  <summary className="text-sm text-neutral-500 cursor-pointer hover:underline">
                    Raw report (markdown)
                  </summary>
                  <article className="prose-report mt-3">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
                  </article>
                </details>
              )}
            </>
          ) : job.status === "running" || job.status === "queued" ? (
            <ProgressView job={job} />
          ) : (
            <p className="text-sm text-neutral-500">
              {job.status === "succeeded"
                ? "Loading results…"
                : "The fact-sheet will appear here when analysis finishes."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
