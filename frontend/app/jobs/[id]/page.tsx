"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { API_BASE, getJob, getReport, type Job } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function JobPage({ params }: PageProps) {
  const { id } = usePromise(params);
  const [job, setJob] = useState<Job | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← back
        </Link>
      </div>

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{job.filename}</h1>
          <p className="text-xs text-neutral-500 mt-1">
            {job.id} · {(job.size_bytes / (1024 * 1024)).toFixed(1)} MB · {job.provider}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </header>

      {job.status === "failed" && (
        <pre className="text-sm bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200 p-3 rounded whitespace-pre-wrap">
          {job.error}
        </pre>
      )}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <aside className="md:col-span-1 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Video
          </h2>
          <video
            src={`${API_BASE}/jobs/${job.id}/video`}
            controls
            className="w-full rounded border border-neutral-200 dark:border-neutral-800"
          />
        </aside>

        <div className="md:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-3">
            Report
          </h2>
          {report ? (
            <article className="prose-report">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
            </article>
          ) : (
            <p className="text-sm text-neutral-500">
              {job.status === "succeeded"
                ? "Loading report…"
                : "Report will appear here when analysis finishes."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
