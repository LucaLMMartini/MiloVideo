"use client";

import { useEffect, useRef, useState, use as usePromise } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { API_BASE, formatDuration, getJob, getReport, type Job } from "@/lib/api";
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
