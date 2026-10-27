/**
 * SwasthyaScan AI — Environment API Client
 * Typed fetch wrappers for all environment endpoints.
 * All doctor requests attach X-Session-Token header.
 */

const BASE = "http://localhost:8000/api/env";

function authHeaders(token: string) {
  return { "X-Session-Token": token };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { msg = (await res.json()).detail ?? msg; } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ── Doctor ────────────────────────────────────────────────────────────────────

export async function createEnvironment(passcode: string) {
  const fd = new FormData();
  fd.append("passcode", passcode);
  const res = await fetch(`${BASE}/create`, { method: "POST", body: fd });
  return handleResponse<{
    environment_id: string;
    join_code: string;
    expires_at: string;
    session_token: string;
    session_expires_hours: number;
  }>(res);
}

export async function doctorLogin(envId: string, passcode: string) {
  const fd = new FormData();
  fd.append("passcode", passcode);
  const res = await fetch(`${BASE}/${envId}/doctor-login`, { method: "POST", body: fd });
  return handleResponse<{
    environment_id: string;
    join_code: string;
    expires_at: string;
    closed: boolean;
    session_token: string;
  }>(res);
}

export async function listSubmissions(
  envId: string,
  token: string,
  statusFilter?: string
) {
  const url = statusFilter
    ? `${BASE}/${envId}/submissions?status_filter=${encodeURIComponent(statusFilter)}`
    : `${BASE}/${envId}/submissions`;
  const res = await fetch(url, { headers: authHeaders(token) });
  return handleResponse<{
    submissions: SubmissionSummary[];
    counts: Record<string, number>;
  }>(res);
}

export async function getSubmissionDetail(envId: string, subId: string, token: string) {
  const res = await fetch(`${BASE}/${envId}/submission/${subId}`, {
    headers: authHeaders(token),
  });
  return handleResponse<SubmissionDetail>(res);
}

export async function getImageUrl(envId: string, subId: string, token: string): Promise<string> {
  const res = await fetch(`${BASE}/${envId}/image/${subId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Image not available`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function getGradcam(envId: string, subId: string, token: string) {
  const res = await fetch(`${BASE}/${envId}/gradcam/${subId}`, {
    headers: authHeaders(token),
  });
  return handleResponse<{ gradcam_data: string }>(res);
}

export async function reviewSubmission(
  envId: string,
  subId: string,
  token: string,
  data: {
    doctor_notes?: string;
    new_status?: string;
    override_label?: string;
    override_reason?: string;
  }
) {
  const fd = new FormData();
  if (data.doctor_notes !== undefined) fd.append("doctor_notes", data.doctor_notes);
  if (data.new_status)      fd.append("new_status", data.new_status);
  if (data.override_label)  fd.append("override_label", data.override_label);
  if (data.override_reason) fd.append("override_reason", data.override_reason);
  const res = await fetch(`${BASE}/${envId}/submission/${subId}/review`, {
    method: "POST",
    headers: authHeaders(token),
    body: fd,
  });
  return handleResponse<{ ok: boolean; status: string }>(res);
}

export async function releaseGuidance(
  envId: string, subId: string, token: string, guidance: string
) {
  const fd = new FormData();
  fd.append("guidance", guidance);
  const res = await fetch(`${BASE}/${envId}/submission/${subId}/release`, {
    method: "POST",
    headers: authHeaders(token),
    body: fd,
  });
  return handleResponse<{ ok: boolean }>(res);
}

export async function closeEnvironment(envId: string, token: string) {
  const res = await fetch(`${BASE}/${envId}/close`, {
    method: "POST",
    headers: authHeaders(token),
  });
  return handleResponse<{ ok: boolean }>(res);
}

export async function regenerateCode(envId: string, token: string) {
  const res = await fetch(`${BASE}/${envId}/regenerate`, {
    method: "POST",
    headers: authHeaders(token),
  });
  return handleResponse<{ ok: boolean; join_code: string }>(res);
}

export async function deleteEnvironment(envId: string, token: string) {
  const res = await fetch(`${BASE}/${envId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return handleResponse<{ ok: boolean }>(res);
}

// ── Patient ───────────────────────────────────────────────────────────────────

export async function lookupByCode(joinCode: string) {
  const res = await fetch(`${BASE}/by-code/${joinCode.toUpperCase()}`);
  return handleResponse<{ environment_id: string; expires_at: string }>(res);
}

export async function joinEnvironment(envId: string, joinCode: string, pseudonym: string) {
  const fd = new FormData();
  fd.append("join_code", joinCode.toUpperCase());
  fd.append("pseudonym", pseudonym);
  const res = await fetch(`${BASE}/${envId}/join`, { method: "POST", body: fd });
  return handleResponse<{
    submission_id: string;
    session_token: string;
    pseudonym: string;
    environment_expires_at: string;
  }>(res);
}

export async function submitXray(
  envId: string,
  submissionId: string,
  token: string,
  imageFile: File,
  symptoms: Record<string, unknown>
) {
  const fd = new FormData();
  fd.append("submission_id", submissionId);
  fd.append("symptoms", JSON.stringify(symptoms));
  fd.append("image", imageFile);
  const res = await fetch(`${BASE}/${envId}/submit`, {
    method: "POST",
    headers: authHeaders(token),
    body: fd,
  });
  return handleResponse<{
    submission_id: string;
    status: string;
    message: string;
  }>(res);
}

export async function pollSubmissionStatus(
  envId: string, subId: string, token: string
) {
  const res = await fetch(`${BASE}/${envId}/status/${subId}`, {
    headers: authHeaders(token),
  });
  return handleResponse<{ status: string; released_guidance: string | null }>(res);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SubmissionSummary {
  id: string;
  pseudonym: string;
  priority_label: string;
  status: string;
  created_at: string;
  override_label: string | null;
  released_guidance: string | null;
}

export interface SubmissionDetail {
  id: string;
  pseudonym: string;
  created_at: string;
  has_image: boolean;
  questionnaire: Record<string, unknown> | null;
  model_output: {
    prediction: string;
    score: number;
    threshold: number;
    analysis_status: string;
  } | null;
  reliability_flags: Array<{ flag: string; severity: string; detail: string }>;
  priority_label: string;
  priority_reasons: string[];
  override_label: string | null;
  override_reason: string | null;
  doctor_notes: string | null;
  status: string;
  released_guidance: string | null;
  model_verified: boolean;
}
