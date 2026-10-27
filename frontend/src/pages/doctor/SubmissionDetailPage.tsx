/**
 * SubmissionDetailPage — Doctor review view
 * Scan viewer (zoom/brightness), model output (verified/unverified note),
 * priority + reasons, override, notes, status, release guidance.
 */
import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, ZoomIn, ZoomOut, Sun, Brain,
  AlertTriangle, CheckCircle2, Send, Loader2, MessageSquare
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
    <div className="min-h-screen px-4 py-20" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-5xl mx-auto">

        {/* Back + header */}
        <button id="back-btn" onClick={() => navigate("/env/doctor/dashboard")}
          className="flex items-center gap-2 text-sm mb-5"
          style={{ color: "var(--text-muted)" }}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        <div className="glass-card rounded-2xl p-6 mb-5">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs font-mono mb-1" style={{ color: "var(--text-subtle)" }}>
                {new Date(detail!.created_at).toLocaleString()}
              </p>
              <h1 className="text-xl font-bold gradient-text">
                Submission: {detail!.pseudonym}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold px-3 py-1.5 rounded-full"
                style={{ background: prioColor + "20", color: prioColor, border: `1px solid ${prioColor}40` }}>
                {effectivePriority}
                {detail?.override_label && (
                  <span className="ml-1 text-xs opacity-70">(overridden)</span>
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* LEFT: Scan viewer */}
          <div className="space-y-4">
            <div className="glass-card rounded-2xl p-4">
              <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
                Scan Viewer
              </h2>

              {/* Viewer controls */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <button onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
                  className="p-1.5 rounded-lg" title="Zoom in"
                  style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
                  <ZoomIn size={14} />
                </button>
                <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}
                  className="p-1.5 rounded-lg" title="Zoom out"
                  style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
                  <ZoomOut size={14} />
                </button>
                <span className="text-xs font-mono" style={{ color: "var(--text-subtle)" }}>
                  {Math.round(zoom * 100)}%
                </span>
                <Sun size={13} style={{ color: "var(--text-subtle)", marginLeft: 8 }} />
                <input type="range" min={50} max={200} value={brightness}
                  onChange={e => setBrightness(Number(e.target.value))}
                  className="w-24" title="Brightness" />
                <span className="text-xs font-mono" style={{ color: "var(--text-subtle)" }}>
                  {brightness}%
                </span>
                {gradcam && (
                  <button id="toggle-gradcam-btn"
                    onClick={() => setShowGradcam(g => !g)}
                    className="ml-auto text-xs px-3 py-1 rounded-lg flex items-center gap-1"
                    style={{
                      background: showGradcam ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.05)",
                      color: showGradcam ? "#a78bfa" : "var(--text-muted)",
                      border: `1px solid ${showGradcam ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.1)"}`,
                    }}>
                    <Brain size={12} /> {showGradcam ? "Original" : "Grad-CAM++"}
                  </button>
                )}
              </div>

              {/* Image display */}
              <div className="overflow-auto rounded-xl"
                style={{ background: "#000", maxHeight: 360 }}>
                {(imageUrl || gradcam) ? (
                  <img
                    src={showGradcam && gradcam ? gradcam : imageUrl}
                    alt={showGradcam ? "Grad-CAM heatmap" : "Patient X-ray"}
                    style={{
                      transform: `scale(${zoom})`,
                      transformOrigin: "top left",
                      filter: `brightness(${brightness}%)`,
                      display: "block",
                      width: "100%",
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-48"
                    style={{ color: "var(--text-subtle)" }}>
                    No image available
                  </div>
                )}
              </div>
              {gradcam && (
                <p className="text-xs mt-2" style={{ color: "var(--text-subtle)" }}>
                  ⚠️ Grad-CAM++ is a model explanation aid — not a clinical finding.
                </p>
              )}
            </div>

            {/* Questionnaire */}
            {detail?.questionnaire && Object.keys(detail.questionnaire).length > 0 && (
              <div className="glass-card rounded-2xl p-4">
                <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
                  Questionnaire Answers
                </h2>
                <div className="space-y-2">
                  {Object.entries(detail.questionnaire).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between text-xs">
                      <span style={{ color: "var(--text-muted)" }}>
                        {k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                      </span>
                      <span className="font-semibold"
                        style={{ color: v ? "#f97316" : "var(--text-subtle)" }}>
                        {v ? "Yes" : "No"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Analysis + Review */}
          <div className="space-y-4">
            {/* Model output */}
            <div className="glass-card rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain size={16} style={{ color: "var(--violet)" }} />
                <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  AI Model Output
                </h2>
                {!detail?.model_verified && (
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(251,146,60,0.1)", color: "#f97316",
                             border: "1px solid rgba(251,146,60,0.3)" }}>
                    EXPERIMENTAL — not verified
                  </span>
                )}
              </div>

              {detail?.model_output ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: "var(--text-muted)" }}>Prediction</span>
                    <span className="font-bold"
                      style={{ color: detail.model_output.prediction === "TB" ? "#ef4444" : "#22c55e" }}>
                      {detail.model_output.prediction}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: "var(--text-muted)" }}>Score</span>
                    <span className="font-mono text-xs" style={{ color: "var(--text-primary)" }}>
                      {(detail.model_output.score * 100).toFixed(1)}% (threshold: {(detail.model_output.threshold * 100).toFixed(1)}%)
                    </span>
                  </div>
                  {!detail.model_verified && (
                    <p className="text-xs mt-2 p-2 rounded-lg"
                      style={{ background: "rgba(251,146,60,0.06)", color: "var(--text-subtle)",
                               border: "1px solid rgba(251,146,60,0.15)" }}>
                      This model output is experimental and has not been externally validated.
                      It does NOT contribute to the review priority label (MODEL_VERIFIED=false).
                      Use clinical judgment.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs" style={{ color: "var(--text-subtle)" }}>
                  Model output unavailable — inference did not complete.
                </p>
              )}
            </div>

            {/* Priority */}
            <div className="glass-card rounded-2xl p-4">
              <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
                Review Priority &amp; Reasons
              </h2>
              <div className="p-2 rounded-lg mb-3"
                style={{ background: prioColor + "12", border: `1px solid ${prioColor}30` }}>
                <p className="text-xs font-bold" style={{ color: prioColor }}>
                  {effectivePriority}
                  <span className="font-normal ml-1" style={{ color: "var(--text-subtle)" }}>
                    (EXPERIMENTAL PROTOTYPE RULES — not clinically validated)
                  </span>
                </p>
              </div>
              <div className="space-y-1.5">
                {(detail?.priority_reasons ?? []).map((r, i) => (
                  <p key={i} className="text-xs leading-relaxed"
                    style={{ color: "var(--text-muted)", borderLeft: "2px solid rgba(255,255,255,0.1)",
                             paddingLeft: 8 }}>
                    {r}
                  </p>
                ))}
              </div>
            </div>

            {/* Reliability flags */}
            {detail?.reliability_flags && detail.reliability_flags.length > 0 && (
              <div className="glass-card rounded-2xl p-4">
                <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
                  Reliability Flags
                </h2>
                <div className="space-y-2">
                  {detail.reliability_flags.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <AlertTriangle size={12} style={{
                        color: f.severity === "high" ? "#ef4444" : "#f97316", flexShrink: 0, marginTop: 1
                      }} />
                      <div>
                        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                          {f.flag}:{" "}
                        </span>
                        <span style={{ color: "var(--text-muted)" }}>{f.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Override */}
            <div className="glass-card rounded-2xl p-4">
              <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
                Override Priority (optional)
              </h2>
              <select id="override-label-select" value={overrideLabel}
                onChange={e => setOverrideLabel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm mb-2"
                style={{ background: "rgba(255,255,255,0.04)",
                         border: "1.5px solid rgba(255,255,255,0.1)",
                         color: "var(--text-primary)", outline: "none" }}>
                {OVERRIDE_OPTIONS.map(o => (
                  <option key={o} value={o} style={{ background: "#1a1a1a" }}>
                    {o || "— No override —"}
                  </option>
                ))}
              </select>
              {overrideLabel && (
                <input id="override-reason-input"
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  placeholder="Override reason (required)"
                  required
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{ background: "rgba(255,255,255,0.04)",
                           border: "1.5px solid rgba(251,146,60,0.3)",
                           color: "var(--text-primary)", outline: "none" }} />
              )}
            </div>

            {/* Notes + status */}
            <div className="glass-card rounded-2xl p-4">
              <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
                Notes &amp; Status
              </h2>
              <textarea id="doctor-notes-textarea"
                value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Doctor's clinical notes (internal, not shared with patient)"
                rows={4}
                className="w-full px-3 py-2 rounded-xl text-sm mb-3 resize-none"
                style={{ background: "rgba(255,255,255,0.04)",
                         border: "1.5px solid rgba(255,255,255,0.1)",
                         color: "var(--text-primary)", outline: "none" }} />

              <select id="status-select" value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm mb-3"
                style={{ background: "rgba(255,255,255,0.04)",
                         border: "1.5px solid rgba(255,255,255,0.1)",
                         color: "var(--text-primary)", outline: "none" }}>
                <option value="Pending"          style={{ background: "#1a1a1a" }}>Pending</option>
                <option value="Reviewed"         style={{ background: "#1a1a1a" }}>Reviewed</option>
                <option value="Follow-up needed" style={{ background: "#1a1a1a" }}>Follow-up needed</option>
              </select>

              <button id="save-review-btn" onClick={handleSave} disabled={saving}
                className="btn-primary w-full flex items-center justify-center gap-2"
                style={{ opacity: saving ? 0.7 : 1 }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> :
                 saved  ? <><CheckCircle2 size={14} /> Saved!</> : "Save Review"}
              </button>
            </div>

            {/* Release guidance to patient */}
            <div className="glass-card rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare size={16} style={{ color: "var(--ember)" }} />
                <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  Release Note to Patient
                </h2>
              </div>
              {guidanceSent ? (
                <div className="flex items-center gap-2 p-3 rounded-xl"
                  style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <CheckCircle2 size={14} style={{ color: "#22c55e" }} />
                  <p className="text-xs" style={{ color: "#22c55e" }}>
                    Guidance note has been released to the patient.
                  </p>
                </div>
              ) : (
                <>
                  <textarea id="guidance-textarea"
                    value={guidance} onChange={e => setGuidance(e.target.value)}
                    placeholder="Short note for the patient (max 1000 chars). Will be shown on their confirmation page."
                    rows={3} maxLength={1000}
                    className="w-full px-3 py-2 rounded-xl text-sm mb-2 resize-none"
                    style={{ background: "rgba(255,255,255,0.04)",
                             border: "1.5px solid rgba(255,255,255,0.1)",
                             color: "var(--text-primary)", outline: "none" }} />
                  <p className="text-xs mb-2" style={{ color: "var(--text-subtle)" }}>
                    ⚠️ This note will be visible to the patient. Do not include clinical diagnoses or raw AI scores.
                  </p>
                  <button id="send-guidance-btn" onClick={handleSendGuidance}
                    disabled={sendingGuidance || !guidance.trim()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                    style={{
                      background: "rgba(251,146,60,0.15)", color: "var(--ember)",
                      border: "1px solid rgba(251,146,60,0.3)",
                      opacity: sendingGuidance || !guidance.trim() ? 0.5 : 1,
                    }}>
                    {sendingGuidance
                      ? <Loader2 size={14} className="animate-spin" />
                      : <><Send size={14} /> Send Note to Patient</>
                    }
                  </button>
                </>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-xl"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
