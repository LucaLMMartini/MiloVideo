import type { JobStatus } from "@/lib/api";

const styles: Record<JobStatus, string> = {
  queued: "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  succeeded: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${styles[status]}`}>
      {status}
    </span>
  );
}
