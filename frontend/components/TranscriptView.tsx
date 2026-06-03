"use client";

import { useState } from "react";
import type { Transcript } from "@/lib/api";

function fmtTs(t: number): string {
  const total = Math.floor(t);
  const s = total % 60;
  const m = Math.floor(total / 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function TranscriptView({
  transcript,
  onSeek,
}: {
  transcript: Transcript;
  onSeek: (t: number) => void;
}) {
  const hasTranslation = !!transcript.translated_text;
  // Show the timestamped original by default (clickable); the translation is plain text.
  const [tab, setTab] = useState<"original" | "translated">(
    hasTranslation ? "translated" : "original",
  );

  if (!transcript.text?.trim() && !transcript.segments?.length) {
    return <p className="text-sm text-neutral-500">No speech detected in this video.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs text-neutral-500">
        {transcript.language && <span>Detected: {transcript.language}</span>}
        {hasTranslation && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setTab("translated")}
              className={`rounded px-2 py-0.5 border ${
                tab === "translated"
                  ? "border-neutral-400 dark:border-neutral-500 font-medium text-neutral-900 dark:text-neutral-100"
                  : "border-transparent hover:border-neutral-300"
              }`}
            >
              {transcript.target_language ?? "Translation"}
            </button>
            <button
              type="button"
              onClick={() => setTab("original")}
              className={`rounded px-2 py-0.5 border ${
                tab === "original"
                  ? "border-neutral-400 dark:border-neutral-500 font-medium text-neutral-900 dark:text-neutral-100"
                  : "border-transparent hover:border-neutral-300"
              }`}
            >
              Original
            </button>
          </div>
        )}
      </div>

      {tab === "translated" && hasTranslation ? (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {transcript.translated_text}
        </p>
      ) : transcript.segments.length ? (
        <ul className="space-y-1">
          {transcript.segments.map((s, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <button
                type="button"
                onClick={() => onSeek(s.t_start)}
                className="shrink-0 font-mono text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                {fmtTs(s.t_start)}
              </button>
              <span>{s.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{transcript.text}</p>
      )}
    </div>
  );
}
