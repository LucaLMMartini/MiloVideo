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

export interface AtomicFact {
  fact: string;
  vehicle_model?: string | null;
  evidence: Evidence[];
}

export interface Feature {
  label: string;
  description?: string | null;
  evidence: Evidence[];
}

export interface FactSheet {
  vehicle_model?: string | null;
  summary: string;
  atomic_facts: AtomicFact[];
  features: Feature[];
  notes: string[];
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
  error?: string | null;
  result?: FactSheet | null;
  report_path?: string | null;
}

export function frameUrl(jobId: string, t: number): string {
  return `${API_BASE}/jobs/${jobId}/frame?t=${t}`;
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
}

export async function uploadVideo(file: File, cfg: RunConfig = {}): Promise<{ id: string }> {
  const fd = new FormData();
  fd.append("video", file);
  if (cfg.provider) fd.append("provider", cfg.provider);
  if (cfg.model) fd.append("model", cfg.model);
  if (cfg.sampleFps != null) fd.append("sample_fps", String(cfg.sampleFps));
  if (cfg.visionDetail) fd.append("vision_detail", cfg.visionDetail);
  if (cfg.useAudio != null) fd.append("use_audio", String(cfg.useAudio));
  const r = await fetch(`${API_BASE}/jobs`, { method: "POST", body: fd });
  if (!r.ok) throw new Error(`uploadVideo: ${r.status} ${await r.text()}`);
  return r.json();
}
