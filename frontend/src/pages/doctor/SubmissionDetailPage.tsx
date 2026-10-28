/**
 * SubmissionDetailPage — Doctor review view
 * Scan viewer (zoom/brightness), model output (verified/unverified note),
 * priority + reasons, override, notes, status, release guidance.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, ZoomIn, ZoomOut, Sun, Brain,
  AlertTriangle, CheckCircle2, Send, Loader2, MessageSquare,
  Activity, FileText
} from "lucide-react";
import {
  getSubmissionDetail, getImageUrl, getGradcam,
  reviewSubmission, releaseGuidance,
  type SubmissionDetail
} from "../../api/environmentApi";

const PRIORITY_COLOR: Record<string, string> = {
  "Urgent review":   "#ef4444",
  "Elevated review": "#f97316",
  "Routine review":  "#22c55e",
  "Unable to assess": "#6b7280",
};

const OVERRIDE_OPTIONS = [
  "", "Urgent review", "Elevated review", "Routine review", "Unable to assess"
];

export function SubmissionDetailPage() {
  const { subId } = useParams<{ subId: string }>();
  const navigate   = useNavigate();

  const raw = sessionStorage.getItem("env_doctor_session");
  if (!raw) { navigate("/env/doctor"); return null; }
  const session = JSON.parse(raw);

  const [detail, setDetail]       = useState<SubmissionDetail | null>(null);
  const [imageUrl, setImageUrl]   = useState<string>("");
  const [gradcam, setGradcam]     = useState<string>("");
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");

  // Viewer controls
  const [zoom, setZoom]       = useState(1);
  const [brightness, setBrightness] = useState(100);
  const [showGradcam, setShowGradcam] = useState(false);

  // Review form
  const [notes, setNotes]         = useState("");
  const [status, setStatus]       = useState("Reviewed");
  const [overrideLabel, setOverrideLabel] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);

  // Guidance form
  const [guidance, setGuidance]   = useState("");
  const [sendingGuidance, setSendingGuidance] = useState(false);
  const [guidanceSent, setGuidanceSent] = useState(false);

  useEffect(() => {
    if (!subId) return;
    async function load() {
      try {
        const d = await getSubmissionDetail(session.environment_id, subId!, session.session_token);
        setDetail(d);
        setNotes(d.doctor_notes ?? "");
        setStatus(d.status);
        setOverrideLabel(d.override_label ?? "");
        setOverrideReason(d.override_reason ?? "");
        setGuidanceSent(!!d.released_guidance);

        if (d.has_image) {
          const url = await getImageUrl(session.environment_id, subId!, session.session_token);
          setImageUrl(url);
        }
        try {
          const gc = await getGradcam(session.environment_id, subId!, session.session_token);
          setGradcam(gc.gradcam_data);
        } catch {}
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load submission.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [subId]);    // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!subId) return;
    setSaving(true); setSaved(false);
    try {
      await reviewSubmission(session.environment_id, subId, session.session_token, {
        doctor_notes: notes, new_status: status,
        override_label: overrideLabel, override_reason: overrideReason,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendGuidance() {
    if (!subId || !guidance.trim()) return;
    setSendingGuidance(true);
    try {
      await releaseGuidance(session.environment_id, subId, session.session_token, guidance);
      setGuidanceSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send guidance.");
    } finally {
      setSendingGuidance(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <Loader2 size={28} className="animate-spin" style={{ color: "var(--ember)" }} />
      </div>
    );
  }
  if (error && !detail) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg-base)" }}>
        <div className="text-center">
          <p className="text-sm mb-4" style={{ color: "#ef4444" }}>{error}</p>
          <button onClick={() => navigate(-1)} className="btn-primary">← Back</button>
        </div>
      </div>
    );
  }

  const effectivePriority = detail?.override_label ?? detail?.priority_label ?? "Unable to assess";
  const prioColor = PRIORITY_COLOR[effectivePriority] ?? "#6b7280";

  return (
    <div className="w-full min-h-screen" style={{ background: "var(--bg-base)" }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "6.5rem 2rem 5rem" }}>

        {/* ── Top Navigation ─────────────────────────────────── */}
        <button
          id="back-btn"
          onClick={() => navigate("/env/doctor/dashboard")}
          className="flex items-center gap-2 mb-6 transition-colors"
          style={{
            color: "var(--text-muted)",
            fontSize: "0.95rem",
            fontWeight: 500,
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--ember)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          <ArrowLeft size={18} /> Back to Dashboard
        </button>

        {/* ── Header Card ─────────────────────────────────────── */}
        <div className="glass-card rounded-2xl mb-8" style={{ padding: "1.75rem 2.25rem" }}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="font-mono mb-1 text-xs" style={{ color: "var(--ember)", letterSpacing: "0.06em" }}>
                SUBMISSION RECORD • {new Date(detail!.created_at).toLocaleString()}
              </p>
              <h1 className="font-bold gradient-text" style={{ fontSize: "2.25rem", lineHeight: 1.2 }}>
                Patient: {detail!.pseudonym}
              </h1>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <span
                className="font-bold rounded-full text-sm"
                style={{
                  padding: "0.5rem 1.25rem",
                  background: prioColor + "20",
                  color: prioColor,
                  border: `1.5px solid ${prioColor}50`,
                }}
              >
                {effectivePriority}
                {detail?.override_label && (
                  <span className="ml-1.5 opacity-75 font-normal text-xs">(Overridden)</span>
                )}
              </span>

              <span
                className="font-semibold rounded-full text-sm"
                style={{
                  padding: "0.5rem 1.1rem",
                  background: status === "Pending" ? "rgba(251,146,60,0.12)" : status === "Reviewed" ? "rgba(34,197,94,0.12)" : "rgba(168,85,247,0.12)",
                  color: status === "Pending" ? "#f97316" : status === "Reviewed" ? "#22c55e" : "#a855f7",
                  border: `1px solid ${status === "Pending" ? "rgba(251,146,60,0.3)" : status === "Reviewed" ? "rgba(34,197,94,0.3)" : "rgba(168,85,247,0.3)"}`,
                }}
              >
                {status}
              </span>
            </div>
          </div>
        </div>

        {/* ── Two-Column Balanced Workspace Grid ─────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* ══════════════════════════════════════════════════════
              LEFT COLUMN (col-span-6): Scan Viewer + Symptoms
             ══════════════════════════════════════════════════════ */}
          <div className="lg:col-span-6 flex flex-col gap-6">

            {/* Scan Viewer Card */}
            <div className="glass-card rounded-2xl" style={{ padding: "1.75rem 2rem" }}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Activity size={18} style={{ color: "var(--ember)" }} />
                  <h2 className="font-bold" style={{ fontSize: "1.15rem", color: "var(--text-primary)" }}>
                    Diagnostic Chest Scan
                  </h2>
                </div>
                {gradcam && (
                  <button
                    id="toggle-gradcam-btn"
                    onClick={() => setShowGradcam(g => !g)}
                    className="rounded-xl flex items-center gap-1.5 transition-all"
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      padding: "0.45rem 1rem",
                      background: showGradcam ? "rgba(139,92,246,0.22)" : "rgba(255,255,255,0.06)",
                      color: showGradcam ? "#c4b5fd" : "var(--text-muted)",
                      border: `1px solid ${showGradcam ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.12)"}`,
                      cursor: "pointer",
                    }}
                  >
                    <Brain size={15} /> {showGradcam ? "Original Scan" : "Grad-CAM++ Heatmap"}
                  </button>
                )}
              </div>

              {/* Viewer Controls Toolbar */}
              <div
                className="flex items-center gap-3 mb-4 p-2.5 rounded-xl flex-wrap"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}
                    className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
                    title="Zoom out"
                    style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)", border: "none", cursor: "pointer" }}
                  >
                    <ZoomOut size={16} />
                  </button>
                  <span className="font-mono text-xs px-2" style={{ color: "var(--text-subtle)", minWidth: 44, textAlign: "center" }}>
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
                    className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
                    title="Zoom in"
                    style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)", border: "none", cursor: "pointer" }}
                  >
                    <ZoomIn size={16} />
                  </button>
                </div>

                <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)", margin: "0 4px" }} />

                <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                  <Sun size={16} style={{ color: "var(--text-subtle)", flexShrink: 0 }} />
                  <input
                    type="range"
                    min={50}
                    max={200}
                    value={brightness}
                    onChange={e => setBrightness(Number(e.target.value))}
                    className="w-full"
                    title="Brightness adjustment"
                  />
                  <span className="font-mono text-xs" style={{ color: "var(--text-subtle)", minWidth: 38, textAlign: "right" }}>
                    {brightness}%
                  </span>
                </div>
              </div>

              {/* Viewport Box */}
              <div
                className="overflow-hidden rounded-xl flex items-center justify-center relative"
                style={{
                  background: "#050404",
                  border: "1px solid rgba(255,255,255,0.08)",
                  minHeight: 440,
                  maxHeight: 520,
                }}
              >
                {(imageUrl || gradcam) ? (
                  <img
                    src={showGradcam && gradcam ? gradcam : imageUrl}
                    alt={showGradcam ? "Grad-CAM heatmap" : "Patient X-ray"}
                    style={{
                      transform: `scale(${zoom})`,
                      transformOrigin: "center center",
                      filter: `brightness(${brightness}%)`,
                      maxWidth: "100%",
                      maxHeight: 500,
                      objectFit: "contain",
                      transition: "filter 0.1s ease-out",
                    }}
                  />
                ) : (
                  <div className="text-center p-8" style={{ color: "var(--text-subtle)" }}>
                    No chest scan image uploaded for this submission.
                  </div>
                )}
              </div>

              {gradcam && (
                <div
                  className="mt-4 p-3 rounded-xl flex items-center gap-2.5"
                  style={{ background: "rgba(251,146,60,0.06)", border: "1px solid rgba(251,146,60,0.18)" }}
                >
                  <AlertTriangle size={15} style={{ color: "var(--ember)", flexShrink: 0 }} />
                  <p style={{ fontSize: "0.82rem", color: "var(--text-subtle)", lineHeight: 1.4 }}>
                    <strong>Clinical Note:</strong> Grad-CAM++ highlights regions influencing AI model inference. It does not replace full radiological assessment.
                  </p>
                </div>
              )}
            </div>

            {/* Patient Questionnaire Card */}
            {detail?.questionnaire && Object.keys(detail.questionnaire).length > 0 && (
              <div className="glass-card rounded-2xl" style={{ padding: "1.75rem 2rem" }}>
                <div className="flex items-center gap-2 mb-4">
                  <FileText size={18} style={{ color: "var(--ember)" }} />
                  <h2 className="font-bold" style={{ fontSize: "1.15rem", color: "var(--text-primary)" }}>
                    Patient Reported Symptoms
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(detail.questionnaire).map(([k, v]) => {
                    const isYes = Boolean(v);
                    const label = k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                    return (
                      <div
                        key={k}
                        className="p-3 rounded-xl flex items-center justify-between"
                        style={{
                          background: isYes ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.03)",
                          border: isYes ? "1px solid rgba(239,68,68,0.25)" : "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <span style={{ fontSize: "0.9rem", color: isYes ? "var(--text-primary)" : "var(--text-muted)" }}>
                          {label}
                        </span>
                        <span
                          className="font-semibold text-xs px-2.5 py-1 rounded-full"
                          style={{
                            background: isYes ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)",
                            color: isYes ? "#ef4444" : "var(--text-subtle)",
                          }}
                        >
                          {isYes ? "Yes" : "No"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          {/* ══════════════════════════════════════════════════════
              RIGHT COLUMN (col-span-6): AI Analysis + Doctor Review
             ══════════════════════════════════════════════════════ */}
          <div className="lg:col-span-6 flex flex-col gap-6">

            {/* ── CARD 1: AI Analysis & Priority Evidence ── */}
            <div className="glass-card rounded-2xl" style={{ padding: "2rem" }}>
              
              {/* Header */}
              <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <Brain size={20} style={{ color: "var(--violet)" }} />
                  <h2 className="font-bold" style={{ fontSize: "1.2rem", color: "var(--text-primary)" }}>
                    AI Clinical Analysis
                  </h2>
                </div>
                {!detail?.model_verified && (
                  <span
                    className="font-semibold rounded-full text-xs"
                    style={{
                      padding: "0.3rem 0.85rem",
                      background: "rgba(251,146,60,0.12)",
                      color: "#f97316",
                      border: "1px solid rgba(251,146,60,0.35)",
                    }}
                  >
                    EXPERIMENTAL — NOT VERIFIED
                  </span>
                )}
              </div>

              {/* Metrics Grid */}
              {detail?.model_output ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {/* Prediction */}
                    <div
                      className="p-3.5 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                    >
                      <p className="text-xs mb-1" style={{ color: "var(--text-subtle)" }}>Prediction</p>
                      <p
                        className="font-bold text-lg"
                        style={{ color: detail.model_output.prediction === "TB" ? "#ef4444" : "#22c55e" }}
                      >
                        {detail.model_output.prediction === "TB" ? "TB Indicated" : "Normal"}
                      </p>
                    </div>

                    {/* Score */}
                    <div
                      className="p-3.5 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                    >
                      <p className="text-xs mb-1" style={{ color: "var(--text-subtle)" }}>Model Confidence</p>
                      <p className="font-mono font-bold text-lg" style={{ color: "var(--text-primary)" }}>
                        {(detail.model_output.score * 100).toFixed(1)}%
                      </p>
                    </div>

                    {/* Threshold */}
                    <div
                      className="p-3.5 rounded-xl col-span-2 sm:col-span-1"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                    >
                      <p className="text-xs mb-1" style={{ color: "var(--text-subtle)" }}>Decision Threshold</p>
                      <p className="font-mono font-bold text-lg" style={{ color: "var(--text-muted)" }}>
                        {isNaN(detail.model_output.threshold) ? "N/A" : (detail.model_output.threshold * 100).toFixed(1) + "%"}
                      </p>
                    </div>
                  </div>

                  {/* Experimental Notice */}
                  {!detail.model_verified && (
                    <div
                      className="p-3 rounded-xl"
                      style={{
                        background: "rgba(251,146,60,0.06)",
                        border: "1px solid rgba(251,146,60,0.2)",
                        fontSize: "0.83rem",
                        color: "var(--text-subtle)",
                        lineHeight: 1.5,
                      }}
                    >
                      This model output is experimental and has not been externally clinically validated. In accordance with safety protocol (MODEL_VERIFIED=false), AI scores do NOT elevate patient review priority automatically.
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl text-center mb-5" style={{ background: "rgba(255,255,255,0.03)", color: "var(--text-subtle)" }}>
                  Model output unavailable — inference did not complete.
                </div>
              )}

              {/* Priority & Clinical Rules */}
              <div className="mt-6 pt-6" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                    Priority Stratification &amp; Rule Evidence
                  </h3>
                  <span
                    className="font-bold text-xs px-2.5 py-1 rounded-full"
                    style={{ background: prioColor + "20", color: prioColor }}
                  >
                    {effectivePriority}
                  </span>
                </div>

                <div className="space-y-2 mb-6">
                  {(detail?.priority_reasons ?? []).map((r, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-lg text-xs leading-relaxed"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        borderLeft: `3px solid ${prioColor}`,
                        color: "var(--text-secondary)",
                      }}
                    >
                      {r}
                    </div>
                  ))}
                </div>

                {/* Reliability Quality Checks (Clean Grid!) */}
                <h3 className="font-semibold text-sm mb-3" style={{ color: "var(--text-primary)" }}>
                  Reliability &amp; Pipeline Verifications
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(detail?.reliability_flags ?? []).map((f, i) => {
                    const isOk = f.ok !== false; // if ok is true or undefined, check passes
                    return (
                      <div
                        key={i}
                        className="p-2.5 rounded-xl flex items-center justify-between gap-2"
                        style={{
                          background: isOk ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.08)",
                          border: isOk ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(239,68,68,0.25)",
                        }}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          {isOk ? (
                            <CheckCircle2 size={15} style={{ color: "#22c55e", flexShrink: 0 }} />
                          ) : (
                            <AlertTriangle size={15} style={{ color: "#ef4444", flexShrink: 0 }} />
                          )}
                          <span className="font-medium truncate" style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>
                            {f.flag}
                          </span>
                        </div>
                        <span
                          className="font-semibold text-xs px-2 py-0.5 rounded-md flex-shrink-0"
                          style={{
                            background: isOk ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.2)",
                            color: isOk ? "#22c55e" : "#ef4444",
                          }}
                        >
                          {isOk ? "Passed" : (f.note || "Flagged")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* ── CARD 2: Doctor Clinical Review & Guidance Decision ── */}
            <div className="glass-card rounded-2xl" style={{ padding: "2rem" }}>
              <h2 className="font-bold mb-5" style={{ fontSize: "1.2rem", color: "var(--text-primary)" }}>
                Doctor Review &amp; Actions
              </h2>

              {/* Status and Priority Override (Side-by-side) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-mono uppercase mb-2" style={{ color: "var(--text-muted)" }}>
                    Update Queue Status
                  </label>
                  <select
                    id="status-select"
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1.5px solid rgba(255,255,255,0.12)",
                      color: "var(--text-primary)",
                      outline: "none",
                    }}
                  >
                    <option value="Pending" style={{ background: "#1a1a1a" }}>Pending</option>
                    <option value="Reviewed" style={{ background: "#1a1a1a" }}>Reviewed</option>
                    <option value="Follow-up needed" style={{ background: "#1a1a1a" }}>Follow-up needed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase mb-2" style={{ color: "var(--text-muted)" }}>
                    Override Priority (Optional)
                  </label>
                  <select
                    id="override-label-select"
                    value={overrideLabel}
                    onChange={e => setOverrideLabel(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1.5px solid rgba(255,255,255,0.12)",
                      color: "var(--text-primary)",
                      outline: "none",
                    }}
                  >
                    {OVERRIDE_OPTIONS.map(o => (
                      <option key={o} value={o} style={{ background: "#1a1a1a" }}>
                        {o || "— Keep System Priority —"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Override Reason (if override selected) */}
              {overrideLabel && (
                <div className="mb-4">
                  <label className="block text-xs font-mono uppercase mb-1.5" style={{ color: "var(--ember)" }}>
                    Reason for Override (Required)
                  </label>
                  <input
                    id="override-reason-input"
                    value={overrideReason}
                    onChange={e => setOverrideReason(e.target.value)}
                    placeholder="E.g. Clinical presentation discordant with AI assessment"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1.5px solid rgba(251,146,60,0.4)",
                      color: "var(--text-primary)",
                      outline: "none",
                    }}
                  />
                </div>
              )}

              {/* Notes */}
              <div className="mb-5">
                <label className="block text-xs font-mono uppercase mb-2" style={{ color: "var(--text-muted)" }}>
                  Doctor's Clinical Notes (Internal &amp; Confidential)
                </label>
                <textarea
                  id="doctor-notes-textarea"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Record differential diagnosis, radiological impressions, or follow-up plan..."
                  rows={4}
                  className="w-full px-3.5 py-3 rounded-xl text-sm resize-none"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1.5px solid rgba(255,255,255,0.12)",
                    color: "var(--text-primary)",
                    outline: "none",
                  }}
                />
              </div>

              {/* Save Review Button */}
              <button
                id="save-review-btn"
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm transition-all"
                style={{
                  background: "var(--grad-brand)",
                  color: "#ffffff",
                  border: "none",
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                  boxShadow: "0 4px 18px rgba(255,107,74,0.25)",
                }}
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : saved ? (
                  <><CheckCircle2 size={16} /> Review Saved Successfully!</>
                ) : (
                  "Save Review Decision"
                )}
              </button>

              {/* Patient Guidance Communication Box */}
              <div className="mt-8 pt-6" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare size={17} style={{ color: "var(--ember)" }} />
                  <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                    Release Guidance Note to Patient
                  </h3>
                </div>

                {guidanceSent ? (
                  <div
                    className="p-3.5 rounded-xl flex items-center gap-2.5"
                    style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}
                  >
                    <CheckCircle2 size={16} style={{ color: "#22c55e", flexShrink: 0 }} />
                    <p style={{ fontSize: "0.85rem", color: "#22c55e" }}>
                      Guidance note has been released to the patient's confirmation page.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <textarea
                      id="guidance-textarea"
                      value={guidance}
                      onChange={e => setGuidance(e.target.value)}
                      placeholder="Write patient-facing instructions (e.g. 'Please visit the clinic for follow-up sputum testing.')..."
                      rows={3}
                      maxLength={1000}
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm resize-none"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1.5px solid rgba(255,255,255,0.12)",
                        color: "var(--text-primary)",
                        outline: "none",
                      }}
                    />
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="text-xs" style={{ color: "var(--text-subtle)" }}>
                        ⚠️ Patient will see this note. Avoid raw medical jargon.
                      </p>
                      <button
                        id="send-guidance-btn"
                        onClick={handleSendGuidance}
                        disabled={sendingGuidance || !guidance.trim()}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                        style={{
                          background: "rgba(251,146,60,0.16)",
                          color: "var(--ember)",
                          border: "1px solid rgba(251,146,60,0.35)",
                          opacity: sendingGuidance || !guidance.trim() ? 0.5 : 1,
                          cursor: sendingGuidance || !guidance.trim() ? "not-allowed" : "pointer",
                        }}
                      >
                        {sendingGuidance ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <><Send size={14} /> Send Note to Patient</>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Error feedback */}
              {error && (
                <div
                  className="mt-4 p-3 rounded-xl flex items-center gap-2"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}
                >
                  <AlertTriangle size={15} style={{ color: "#ef4444" }} />
                  <p style={{ fontSize: "0.85rem", color: "#ef4444" }}>{error}</p>
                </div>
              )}

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
