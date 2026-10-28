/**
 * DoctorDashboardPage — Queue of patient submissions, sorted by priority.
 * Polls every 10 seconds. Real counts only. Empty state shown.
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw, Trash2, XCircle, Users, AlertTriangle,
  TrendingUp, Clock, CheckCircle2, Copy, RefreshCcw
} from "lucide-react";
import {
  listSubmissions, closeEnvironment, deleteEnvironment,
  regenerateCode, type SubmissionSummary
} from "../../api/environmentApi";

const PRIORITY_COLOR: Record<string, string> = {
  "Urgent review":   "#ef4444",
  "Elevated review": "#f97316",
  "Routine review":  "#22c55e",
  "Unable to assess": "#6b7280",
};

const STATUS_FILTERS = ["All", "Pending", "Reviewed", "Follow-up needed"];

function PriorityBadge({ label }: { label: string }) {
  const color = PRIORITY_COLOR[label] ?? "#6b7280";
  return (
    <span className="text-sm font-semibold px-3 py-1 rounded-full"
      style={{ background: color + "20", color, border: `1px solid ${color}40` }}>
      {label}
    </span>
  );
}

export function DoctorDashboardPage() {
  const navigate = useNavigate();
  const raw = sessionStorage.getItem("env_doctor_session");
  if (!raw) { navigate("/env/doctor"); return null; }
  const session = JSON.parse(raw);

  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [counts, setCounts]           = useState<Record<string, number>>({});
  const [filter, setFilter]           = useState("All");
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [lastPoll, setLastPoll]       = useState<Date>(new Date());
  const [copied, setCopied]           = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting]       = useState(false);

  const fetchQueue = useCallback(async () => {
    try {
      const sf = filter === "All" ? undefined : filter;
      const res = await listSubmissions(session.environment_id, session.session_token, sf);
      setSubmissions(res.submissions);
      setCounts(res.counts);
      setError("");
      setLastPoll(new Date());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("401") || msg.includes("403")) {
        sessionStorage.removeItem("env_doctor_session");
        navigate("/env/doctor");
      } else {
        setError("Unable to fetch submissions. Retrying…");
      }
    } finally {
      setLoading(false);
    }
  }, [filter, session.environment_id, session.session_token, navigate]);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 10_000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteEnvironment(session.environment_id, session.session_token);
      sessionStorage.removeItem("env_doctor_session");
      navigate("/env/doctor");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleClose() {
    try {
      await closeEnvironment(session.environment_id, session.session_token);
      alert("Join code closed. Patients can no longer join.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to close.");
    }
  }

  async function handleRegenerate() {
    try {
      const res = await regenerateCode(session.environment_id, session.session_token);
      const updated = { ...session, join_code: res.join_code };
      sessionStorage.setItem("env_doctor_session", JSON.stringify(updated));
      alert(`New join code: ${res.join_code}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to regenerate.");
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(session.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const expires = new Date(session.expires_at);
  const isExpired = expires < new Date();

  return (
    <div className="w-full min-h-screen" style={{ background: "var(--bg-base)" }}>
      <div style={{ maxWidth: "1360px", margin: "0 auto", padding: "6.5rem 2rem 5rem" }}>

        {/* ── Header card ───────────────────────────────────── */}
        <div className="glass-card rounded-2xl mb-6" style={{ padding: "2rem" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1.5rem" }}>

            {/* Left: title */}
            <div>
              <p style={{ fontSize: "0.8rem", fontFamily: "monospace", color: "var(--ember)", marginBottom: "0.4rem" }}>
                Environment: {session.environment_id.slice(0, 8)}…
              </p>
              <h1 style={{ fontSize: "2rem", fontWeight: 800, lineHeight: 1.2 }} className="gradient-text">
                Doctor Dashboard
              </h1>
              <p style={{ fontSize: "0.85rem", marginTop: "0.4rem", color: "var(--text-subtle)" }}>
                Session expires: {expires.toLocaleString()}
                {isExpired && <span style={{ color: "#ef4444" }}> — EXPIRED</span>}
              </p>
            </div>

            {/* Right: join code box */}
            <div style={{
              display: "flex", alignItems: "center", gap: "1rem",
              padding: "1.25rem 1.5rem", borderRadius: "1rem",
              background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.25)",
            }}>
              <div>
                <p style={{ fontSize: "0.8rem", color: "var(--text-subtle)", marginBottom: "0.3rem" }}>Patient Join Code</p>
                <p style={{ fontSize: "2.5rem", fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.18em", color: "var(--ember)", lineHeight: 1 }}>
                  {session.join_code}
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <button id="copy-join-code-btn" onClick={copyCode} title="Copy code"
                  style={{ padding: "0.5rem", borderRadius: "0.6rem", background: "rgba(251,146,60,0.15)", color: "var(--ember)", border: "none", cursor: "pointer" }}>
                  {copied ? <CheckCircle2 size={17} /> : <Copy size={17} />}
                </button>
                <button id="regenerate-code-btn" onClick={handleRegenerate} title="Regenerate code"
                  style={{ padding: "0.5rem", borderRadius: "0.6rem", background: "rgba(255,255,255,0.06)", color: "var(--text-subtle)", border: "none", cursor: "pointer" }}>
                  <RefreshCcw size={17} />
                </button>
                <button id="close-code-btn" onClick={handleClose} title="Close code"
                  style={{ padding: "0.5rem", borderRadius: "0.6rem", background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "none", cursor: "pointer" }}>
                  <XCircle size={17} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats row ─────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
          {[
            { label: "Total",     value: counts.total     ?? 0, icon: Users,        color: "var(--ember)" },
            { label: "Pending",   value: counts.pending   ?? 0, icon: Clock,        color: "#f97316"      },
            { label: "Reviewed",  value: counts.reviewed  ?? 0, icon: CheckCircle2, color: "#22c55e"      },
            { label: "Follow-up", value: counts["follow-up_needed"] ?? 0, icon: TrendingUp,  color: "#a855f7" },
          ].map(s => (
            <div key={s.label} className="glass-card rounded-2xl"
              style={{ padding: "1.4rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
              <s.icon size={26} style={{ color: s.color, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: "2rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontSize: "0.8rem", color: "var(--text-subtle)", marginTop: "0.25rem" }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filter bar ────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {STATUS_FILTERS.map(f => (
              <button key={f} id={`filter-${f.toLowerCase().replace(/ /g, "-")}`}
                onClick={() => setFilter(f)}
                style={{
                  fontSize: "0.85rem", padding: "0.45rem 1.1rem", borderRadius: "0.65rem",
                  fontWeight: 500, cursor: "pointer", transition: "all 0.2s",
                  background: filter === f ? "rgba(251,146,60,0.18)" : "rgba(255,255,255,0.04)",
                  color:      filter === f ? "var(--ember)"           : "var(--text-muted)",
                  border:     filter === f ? "1px solid rgba(251,146,60,0.45)" : "1px solid rgba(255,255,255,0.09)",
                }}>
                {f}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-subtle)" }}>
              Last update: {lastPoll.toLocaleTimeString()}
            </span>
            <button id="refresh-btn" onClick={fetchQueue} title="Refresh now"
              style={{ padding: "0.5rem", borderRadius: "0.65rem", background: "rgba(255,255,255,0.05)", color: "var(--text-muted)", border: "none", cursor: "pointer" }}>
              <RefreshCw size={17} />
            </button>
          </div>
        </div>

        {/* ── Error ─────────────────────────────────────────── */}
        {error && (
          <div style={{ padding: "1rem 1.25rem", borderRadius: "0.75rem", marginBottom: "1.25rem",
            display: "flex", alignItems: "center", gap: "0.75rem",
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <AlertTriangle size={17} style={{ color: "#ef4444", flexShrink: 0 }} />
            <p style={{ fontSize: "0.85rem", color: "#ef4444" }}>{error}</p>
          </div>
        )}

        {/* ── Queue ─────────────────────────────────────────── */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "5rem 0", fontSize: "0.95rem", color: "var(--text-subtle)" }}>
            Loading submissions…
          </div>
        ) : submissions.length === 0 ? (
          <div className="glass-card rounded-2xl" style={{ padding: "4rem 2rem", textAlign: "center" }}>
            <Users size={52} style={{ color: "var(--text-subtle)", margin: "0 auto 1rem" }} />
            <p style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--text-muted)" }}>No submissions yet</p>
            <p style={{ fontSize: "0.85rem", marginTop: "0.5rem", color: "var(--text-subtle)" }}>
              Share the join code <strong>{session.join_code}</strong> with your patients.
            </p>
          </div>
        ) : (
          <AnimatePresence>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {submissions.map((sub, i) => (
                <motion.div key={sub.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => navigate(`/env/doctor/submission/${sub.id}`)}
                  className="glass-card rounded-2xl"
                  style={{ padding: "1.25rem 1.5rem", cursor: "pointer", borderColor: "rgba(255,255,255,0.08)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "0.9rem", fontWeight: 700, flexShrink: 0,
                        background: "rgba(251,146,60,0.12)", color: "var(--ember)",
                      }}>
                        {sub.pseudonym.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)" }}>{sub.pseudonym}</p>
                        <p style={{ fontSize: "0.8rem", marginTop: "0.2rem", color: "var(--text-subtle)" }}>
                          {new Date(sub.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <PriorityBadge label={sub.override_label ?? sub.priority_label} />
                      <span style={{
                        fontSize: "0.8rem", padding: "0.25rem 0.75rem", borderRadius: "999px",
                        background: sub.status === "Pending" ? "rgba(251,146,60,0.1)" : sub.status === "Reviewed" ? "rgba(34,197,94,0.1)" : "rgba(168,85,247,0.1)",
                        color:      sub.status === "Pending" ? "#f97316"               : sub.status === "Reviewed" ? "#22c55e"              : "#a855f7",
                      }}>{sub.status}</span>
                      {sub.released_guidance && (
                        <span style={{ fontSize: "0.8rem", padding: "0.25rem 0.75rem", borderRadius: "999px", background: "rgba(59,130,246,0.1)", color: "#60a5fa" }}>
                          Note sent
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* ── Danger zone ───────────────────────────────────── */}
        <div style={{ marginTop: "2.5rem", padding: "1.5rem", borderRadius: "1rem",
          border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.04)" }}>
          <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "#ef4444", marginBottom: "0.75rem" }}>Danger Zone</p>
          {!showDeleteConfirm ? (
            <button id="delete-env-btn" onClick={() => setShowDeleteConfirm(true)}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem",
                padding: "0.6rem 1.25rem", borderRadius: "0.65rem", cursor: "pointer",
                background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
              <Trash2 size={15} /> Delete Environment &amp; All Data
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              <p style={{ fontSize: "0.85rem", color: "#ef4444" }}>
                This will permanently delete all submissions, images, and data. Are you sure?
              </p>
              <button id="confirm-delete-btn" onClick={handleDelete} disabled={deleting}
                style={{ fontSize: "0.85rem", padding: "0.6rem 1.25rem", borderRadius: "0.65rem",
                  background: "#ef4444", color: "white", border: "none", cursor: "pointer" }}>
                {deleting ? "Deleting…" : "Yes, Delete Everything"}
              </button>
              <button onClick={() => setShowDeleteConfirm(false)}
                style={{ fontSize: "0.85rem", padding: "0.6rem 1.25rem", borderRadius: "0.65rem",
                  background: "rgba(255,255,255,0.05)", color: "var(--text-muted)", border: "none", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
