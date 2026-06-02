"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listJobs, type Job } from "@/lib/api";
import { StatusBadge } from "./StatusBadge";

export function JobList() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const j = await listJobs();
        if (!cancelled) setJobs(j);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }
    tick();
    const t = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (error) return <p className="text-sm text-red-600">Backend unreachable: {error}</p>;
  if (jobs === null) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (jobs.length === 0) return <p className="text-sm text-neutral-500">No jobs yet.</p>;

  return (
    <ul className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-lg">
      {jobs.map((j) => (
        <li key={j.id} className="px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <Link
              href={`/jobs/${j.id}`}
              className="font-medium hover:underline truncate block"
            >
              {j.filename}
            </Link>
            <p className="text-xs text-neutral-500">
              {j.id} · {(j.size_bytes / (1024 * 1024)).toFixed(1)} MB · {j.provider}
            </p>
          </div>
          <StatusBadge status={j.status} />
        </li>
      ))}
    </ul>
  );
}
