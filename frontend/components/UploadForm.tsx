"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadVideo } from "@/lib/api";

export function UploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [provider, setProvider] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { id } = await uploadVideo(file, provider || undefined);
      router.push(`/jobs/${id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-6 space-y-4"
    >
      <div>
        <label className="block text-sm font-medium mb-1">Video file</label>
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm"
        />
        {file && (
          <p className="text-xs text-neutral-500 mt-1">
            {file.name} — {(file.size / (1024 * 1024)).toFixed(1)} MB
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Provider (optional)</label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-2 py-1 text-sm"
        >
          <option value="">use server default</option>
          <option value="mock">mock</option>
          <option value="gemini">gemini</option>
          <option value="claude_frames">claude_frames</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={!file || busy}
        className="bg-neutral-900 dark:bg-neutral-100 text-neutral-50 dark:text-neutral-900 px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
      >
        {busy ? "Uploading…" : "Analyze"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
