"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadVideo } from "@/lib/api";

const MODELS = ["gpt-5", "gpt-5-mini", "gpt-4o", "gpt-4o-mini"];
const LANGUAGES = [
  { code: "de", label: "German" },
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "it", label: "Italian" },
];

export function UploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-5");
  const [sampleFps, setSampleFps] = useState(1.0);
  const [visionDetail, setVisionDetail] = useState("high");
  const [useAudio, setUseAudio] = useState(true);
  const [targetLang, setTargetLang] = useState("de");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Frame-sampling controls only apply to the OpenAI (frame-sampling) provider.
  const isOpenAI = provider === "openai" || provider === "claude_frames";

  function pickFile(f: File | null) {
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      setError(`Not a video file: ${f.name}`);
      return;
    }
    setError(null);
    setFile(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    pickFile(e.dataTransfer.files?.[0] ?? null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { id } = await uploadVideo(file, {
        provider: provider || undefined,
        ...(isOpenAI ? { model, sampleFps, visionDetail, useAudio, targetLang } : {}),
      });
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
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-6 py-8 text-center cursor-pointer transition-colors ${
            dragOver
              ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800"
              : "border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600"
          }`}
        >
          {file ? (
            <>
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-neutral-500">
                {(file.size / (1024 * 1024)).toFixed(1)} MB — click or drop to replace
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Drag & drop a video here</p>
              <p className="text-xs text-neutral-500">or click to browse</p>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          className="hidden"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Provider</label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-2 py-1 text-sm"
        >
          <option value="openai">openai (frame sampling)</option>
          <option value="mock">mock</option>
          <option value="gemini">gemini</option>
          <option value="claude_frames">claude_frames</option>
        </select>
      </div>

      {isOpenAI && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-neutral-200 dark:border-neutral-800 pt-4">
          <div>
            <label className="block text-sm font-medium mb-1">Model</label>
            <input
              list="model-options"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-2 py-1 text-sm w-full"
            />
            <datalist id="model-options">
              {MODELS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Frame sampling (per s)
            </label>
            <input
              type="number"
              min={0.1}
              max={10}
              step={0.1}
              value={sampleFps}
              onChange={(e) => setSampleFps(parseFloat(e.target.value) || 1.0)}
              className="border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-2 py-1 text-sm w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Vision detail</label>
            <select
              value={visionDetail}
              onChange={(e) => setVisionDetail(e.target.value)}
              className="border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-2 py-1 text-sm w-full"
            >
              <option value="high">high</option>
              <option value="low">low</option>
              <option value="auto">auto</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Transcript language</label>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-2 py-1 text-sm w-full"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-neutral-500 mt-1">
              Transcript is always created and translated into this language.
            </p>
          </div>

          <div className="sm:col-span-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={useAudio}
                onChange={(e) => setUseAudio(e.target.checked)}
                className="h-4 w-4"
              />
              Use voiceover for analysis
            </label>
            <p className="text-xs text-neutral-500 mt-1">
              On: also derive atomic facts &amp; features from the transcript and feed voiceover
              hints to the vision stage (fused with the visual results). Off: vision-only — the
              transcript is still created and shown.
            </p>
          </div>
        </div>
      )}

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
