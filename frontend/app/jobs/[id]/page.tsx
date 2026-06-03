"use client";

import { useEffect, useRef, useState, use as usePromise } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  API_BASE,
  formatDuration,
  generateReport,
  getJob,
  getReport,
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

  // Release the previous object URL when it changes / on unmount.
  useEffect(() => {
    return () => {
      if (reportUrl) URL.revokeObjectURL(reportUrl);
    };
  }, [reportUrl]);

  async function onGenerateReport() {
    if (!job) return;
    setReportBusy(true);
    setReportError(null);
    setReportUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    try {
      const blob = await generateReport(job.id);
      setReportUrl(URL.createObjectURL(blob));
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
          </div>
          <video
            ref={videoRef}
            src={`${API_BASE}/jobs/${job.id}/video`}
            controls
            className="w-full max-h-[38vh] object-contain rounded border border-neutral-200 dark:border-neutral-800 bg-black"
          />
        </div>
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
              <FactSheetView sheet={job.result} jobId={job.id} onSeek={seekTo} />
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

              <div className="mt-8 border-t border-neutral-200 dark:border-neutral-800 pt-6">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={onGenerateReport}
                    disabled={reportBusy}
                    className="bg-neutral-900 dark:bg-neutral-100 text-neutral-50 dark:text-neutral-900 px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                  >
                    {reportBusy
                      ? "Wird erstellt…"
                      : reportUrl
                        ? "🔄 Neu erstellen"
                        : "📊 PowerPoint-Bericht erstellen"}
                  </button>

                  {reportBusy && (
                    <span className="text-sm text-neutral-500">
                      Bericht wird erstellt… {reportSeconds}s
                    </span>
                  )}

                  {!reportBusy && reportUrl && (
                    <a
                      href={reportUrl}
                      download={`${job.filename}_Bericht.pptx`}
                      className="inline-flex items-center gap-1 border border-neutral-300 dark:border-neutral-700 px-4 py-2 rounded text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      ⬇ Bericht herunterladen
                    </a>
                  )}
                </div>
                <p className="text-xs text-neutral-500 mt-2">
                  Gruppiert die Fakten nach Themen, mit Belegen (Screenshots/Zitate) und Quellen.
                </p>
                {reportError && <p className="text-sm text-red-600 mt-2">{reportError}</p>}
              </div>
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
