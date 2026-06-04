export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface Evidence {
  t_start: number;
  t_end: number | null;
  source: "visual" | "voiceover" | "both";
  quote?: string | null;
  note?: string | null;
}

export type ReviewStatus = "unreviewed" | "verified" | "rejected";

export interface AtomicFact {
  fact: string;
  vehicle_model?: string | null;
  evidence: Evidence[];
  status: ReviewStatus;
}

export interface Feature {
  label: string;
  description?: string | null;
  evidence: Evidence[];
  status: ReviewStatus;
}

export interface TranscriptSegment {
  t_start: number;
  t_end?: number | null;
  text: string;
}

export interface Transcript {
  language?: string | null;
  text: string;
  target_language?: string | null;
  translated_text?: string | null;
  segments: TranscriptSegment[];
}

export interface FactSheet {
  vehicle_model?: string | null;
  summary: string;
  atomic_facts: AtomicFact[];
  features: Feature[];
  notes: string[];
  transcript?: Transcript | null;
}

export interface JobProgress {
  stage: string;
  message: string;
  current?: number | null;
  total?: number | null;
}

export interface Job {
  id: string;
  filename: string;
  size_bytes: number;
  status: JobStatus;
  progress?: JobProgress | null;
  created_at: string;
  updated_at: string;
  provider: string;
  model?: string | null;
  sample_fps?: number | null;
  vision_detail?: string | null;
  use_audio?: boolean | null;
  target_lang?: string | null;
  brand?: string | null;
  model_name?: string | null;
  trim?: string | null;
  error?: string | null;
  result?: FactSheet | null;
  report_path?: string | null;
}

export function frameUrl(jobId: string, t: number): string {
  return `${API_BASE}/jobs/${jobId}/frame?t=${t}`;
}

export interface FactItemUpdate {
  kind: "fact" | "feature";
  index: number;
  status?: ReviewStatus;
  fact?: string;
  label?: string;
  description?: string;
}

export async function updateFactItem(jobId: string, upd: FactItemUpdate): Promise<Job> {
  const r = await fetch(`${API_BASE}/jobs/${jobId}/items`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(upd),
  });
  if (!r.ok) throw new Error(`updateFactItem: ${r.status} ${await r.text()}`);
  return r.json();
}

export async function generateReport(jobId: string): Promise<Blob> {
  const r = await fetch(`${API_BASE}/jobs/${jobId}/pptx`);
  if (!r.ok) throw new Error(`report: ${r.status} ${await r.text()}`);
  return r.blob();
}

export async function searchTerms(q: string): Promise<string[]> {
  const r = await fetch(`${API_BASE}/search-terms?q=${encodeURIComponent(q)}`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`searchTerms: ${r.status}`);
  const data = (await r.json()) as { terms: string[] };
  return data.terms ?? [];
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}m ${rem}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export async function listJobs(): Promise<Job[]> {
  const r = await fetch(`${API_BASE}/jobs`, { cache: "no-store" });
  if (!r.ok) throw new Error(`listJobs: ${r.status}`);
  return r.json();
}

export async function getJob(id: string): Promise<Job> {
  const r = await fetch(`${API_BASE}/jobs/${id}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`getJob: ${r.status}`);
  return r.json();
}

export async function getReport(id: string): Promise<string> {
  const r = await fetch(`${API_BASE}/jobs/${id}/report`, { cache: "no-store" });
  if (!r.ok) throw new Error(`getReport: ${r.status}`);
  return r.text();
}

export interface RunConfig {
  provider?: string;
  model?: string;
  sampleFps?: number;
  visionDetail?: string;
  useAudio?: boolean;
  targetLang?: string;
  brand?: string;
  modelName?: string;
  trim?: string;
}

// Uses XHR so we can report upload progress (fetch can't).
export function uploadVideo(
  file: File,
  cfg: RunConfig = {},
  onProgress?: (fraction: number) => void,
): Promise<{ id: string }> {
  const fd = new FormData();
  fd.append("video", file);
  if (cfg.provider) fd.append("provider", cfg.provider);
  if (cfg.model) fd.append("model", cfg.model);
  if (cfg.sampleFps != null) fd.append("sample_fps", String(cfg.sampleFps));
  if (cfg.visionDetail) fd.append("vision_detail", cfg.visionDetail);
  if (cfg.useAudio != null) fd.append("use_audio", String(cfg.useAudio));
  if (cfg.targetLang) fd.append("target_lang", cfg.targetLang);
  if (cfg.brand) fd.append("brand", cfg.brand);
  if (cfg.modelName) fd.append("model_name", cfg.modelName);
  if (cfg.trim) fd.append("trim", cfg.trim);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/jobs`);
    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("uploadVideo: invalid response"));
        }
      } else {
        reject(new Error(`uploadVideo: ${xhr.status} ${xhr.responseText}`));
      }
    };
    xhr.onerror = () => reject(new Error("uploadVideo: network error"));
    xhr.send(fd);
  });
}

export async function updateJobMeta(
  jobId: string,
  meta: { brand?: string; modelName?: string; trim?: string },
): Promise<Job> {
  const r = await fetch(`${API_BASE}/jobs/${jobId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      brand: meta.brand || null,
      model_name: meta.modelName || null,
      trim: meta.trim || null,
    }),
  });
  if (!r.ok) throw new Error(`updateJobMeta: ${r.status}`);
  return r.json();
}
