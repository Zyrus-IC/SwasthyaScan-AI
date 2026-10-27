/**
 * DoctorDashboardPage — Queue of patient submissions, sorted by priority.
 * Polls every 10 seconds. Real counts only. Empty state shown.
 */
import React, { useEffect, useState, useCallback } from "react";
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
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
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
    <div className="min-h-screen px-4 py-20" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="glass-card rounded-2xl p-6 mb-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs font-mono mb-1" style={{ color: "var(--ember)" }}>
                Environment: {session.environment_id.slice(0, 8)}…
              </p>
              <h1 className="text-xl font-bold gradient-text">Doctor Dashboard</h1>
              <p className="text-xs mt-1" style={{ color: "var(--text-subtle)" }}>
                Session expires: {expires.toLocaleString()}
                {isExpired && <span style={{ color: "#ef4444" }}> — EXPIRED</span>}
              </p>
            </div>

            {/* Join code */}
            <div className="flex items-center gap-2 p-3 rounded-xl"
              style={{ background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.2)" }}>
              <div>
                <p className="text-xs" style={{ color: "var(--text-subtle)" }}>Patient Join Code</p>
                <p className="text-2xl font-mono font-bold tracking-widest"
                  style={{ color: "var(--ember)" }}>
                  {session.join_code}
                </p>
              </div>
              <div className="flex flex-col gap-1 ml-2">
                <button id="copy-join-code-btn" onClick={copyCode}
                  className="p-1.5 rounded-lg text-xs"
                  title="Copy code"
                  style={{ background: "rgba(251,146,60,0.15)", color: "var(--ember)" }}>
                  {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                </button>
                <button id="regenerate-code-btn" onClick={handleRegenerate}
                  className="p-1.5 rounded-lg text-xs"
                  title="Regenerate code"
                  style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-subtle)" }}>
                  <RefreshCcw size={14} />
                </button>
                <button id="close-code-btn" onClick={handleClose}
                  className="p-1.5 rounded-lg text-xs"
                  title="Close code"
                  style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                  <XCircle size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: "Total",        value: counts.total        ?? 0, icon: Users,        color: "var(--ember)" },
            { label: "Pending",      value: counts.pending      ?? 0, icon: Clock,        color: "#f97316" },
            { label: "Reviewed",     value: counts.reviewed     ?? 0, icon: CheckCircle2, color: "#22c55e" },
            { label: "Follow-up",    value: counts["follow-up_needed"] ?? 0, icon: TrendingUp,  color: "#a855f7" },
          ].map(s => (
            <div key={s.label} className="glass-card rounded-xl p-4 flex items-center gap-3">
              <s.icon size={18} style={{ color: s.color }} />
              <div>
                <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{s.value}</p>
                <p className="text-xs" style={{ color: "var(--text-subtle)" }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filter + refresh */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex gap-2 flex-wrap">
            {STATUS_FILTERS.map(f => (
              <button key={f} id={`filter-${f.toLowerCase().replace(/ /g, "-")}`}
                onClick={() => setFilter(f)}
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                style={{
                  background: filter === f ? "rgba(251,146,60,0.2)" : "rgba(255,255,255,0.04)",
                  color: filter === f ? "var(--ember)" : "var(--text-muted)",
                  border: filter === f ? "1px solid rgba(251,146,60,0.4)" : "1px solid rgba(255,255,255,0.08)",
                }}>
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
              Last update: {lastPoll.toLocaleTimeString()}
            </span>
            <button id="refresh-btn" onClick={fetchQueue}
              className="p-2 rounded-lg" title="Refresh now"
              style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl mb-4 flex items-center gap-2"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <AlertTriangle size={14} style={{ color: "#ef4444" }} />
            <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>
          </div>
        )}

        {/* Queue */}
        {loading ? (
          <div className="text-center py-16" style={{ color: "var(--text-subtle)" }}>
            Loading submissions…
          </div>
        ) : submissions.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <Users size={40} style={{ color: "var(--text-subtle)", margin: "0 auto 12px" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
              No submissions yet
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-subtle)" }}>
              Share the join code <strong>{session.join_code}</strong> with your patients.
            </p>
          </div>
        ) : (
          <AnimatePresence>
            <div className="space-y-3">
              {submissions.map((sub, i) => (
                <motion.div key={sub.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => navigate(`/env/doctor/submission/${sub.id}`)}
                  className="glass-card rounded-xl p-4 cursor-pointer hover:border-ember/30 transition-all"
                  style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: "rgba(251,146,60,0.12)", color: "var(--ember)" }}>
                        {sub.pseudonym.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                          {sub.pseudonym}
                        </p>
                        <p className="text-xs" style={{ color: "var(--text-subtle)" }}>
                          {new Date(sub.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <PriorityBadge label={sub.override_label ?? sub.priority_label} />
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: sub.status === "Pending"
                            ? "rgba(251,146,60,0.1)"
                            : sub.status === "Reviewed"
                            ? "rgba(34,197,94,0.1)"
                            : "rgba(168,85,247,0.1)",
                          color: sub.status === "Pending"
                            ? "#f97316"
                            : sub.status === "Reviewed"
                            ? "#22c55e"
                            : "#a855f7",
                        }}>
                        {sub.status}
                      </span>
                      {sub.released_guidance && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa" }}>
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

        {/* Danger zone */}
        <div className="mt-8 p-4 rounded-xl"
          style={{ border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.04)" }}>
          <p className="text-xs font-bold mb-2" style={{ color: "#ef4444" }}>Danger Zone</p>
          {!showDeleteConfirm ? (
            <button id="delete-env-btn" onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 text-xs px-4 py-2 rounded-lg"
              style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
              <Trash2 size={13} /> Delete Environment &amp; All Data
            </button>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-xs" style={{ color: "#ef4444" }}>
                This will permanently delete all submissions, images, and data. Are you sure?
              </p>
              <button id="confirm-delete-btn" onClick={handleDelete} disabled={deleting}
                className="text-xs px-4 py-2 rounded-lg"
                style={{ background: "#ef4444", color: "white" }}>
                {deleting ? "Deleting…" : "Yes, Delete Everything"}
              </button>
              <button onClick={() => setShowDeleteConfirm(false)}
                className="text-xs px-4 py-2 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
