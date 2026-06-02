export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface Evidence {
  t_start: number;
  t_end: number | null;
  note?: string | null;
}

export interface Feature {
  label: string;
  kind: "digital_feature" | "connectivity" | "ui_element" | "other";
  description?: string | null;
  evidence: Evidence[];
}

export interface UIScreen {
  id: string;
  name: string;
  description?: string | null;
  evidence: Evidence[];
}

export interface UIFlow {
  from_screen: string;
  to_screen: string;
  steps: number;
  interactions: string[];
  evidence: Evidence[];
}

export interface AnalysisResult {
  summary: string;
  features: Feature[];
  screens: UIScreen[];
  flows: UIFlow[];
  notes: string[];
}

export interface Job {
  id: string;
  filename: string;
  size_bytes: number;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  provider: string;
  error?: string | null;
  result?: AnalysisResult | null;
  report_path?: string | null;
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

export async function uploadVideo(file: File, provider?: string): Promise<{ id: string }> {
  const fd = new FormData();
  fd.append("video", file);
  if (provider) fd.append("provider", provider);
  const r = await fetch(`${API_BASE}/jobs`, { method: "POST", body: fd });
  if (!r.ok) throw new Error(`uploadVideo: ${r.status} ${await r.text()}`);
  return r.json();
}
