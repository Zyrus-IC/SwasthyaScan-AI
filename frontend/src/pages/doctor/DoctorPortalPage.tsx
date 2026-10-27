/**
 * DoctorPortalPage — Create new environment OR log in to existing one
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Stethoscope, Plus, LogIn, Eye, EyeOff, AlertCircle, Copy, CheckCircle2 } from "lucide-react";
import { createEnvironment, doctorLogin } from "../../api/environmentApi";

export function DoctorPortalPage() {
  const navigate = useNavigate();
  const [mode, setMode]       = useState<"create" | "login">("create");
  const [passcode, setPasscode] = useState("");
  const [envId, setEnvId]     = useState("");
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [created, setCreated] = useState<{ join_code: string; expires_at: string } | null>(null);
  const [copied, setCopied]   = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (passcode.length < 8) { setError("Passcode must be at least 8 characters."); return; }
    setError(""); setLoading(true);
    try {
      const res = await createEnvironment(passcode);
      sessionStorage.setItem("env_doctor_session", JSON.stringify({
        environment_id: res.environment_id,
        session_token:  res.session_token,
        join_code:      res.join_code,
        expires_at:     res.expires_at,
      }));
      setCreated({ join_code: res.join_code, expires_at: res.expires_at });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create environment.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await doctorLogin(envId.trim(), passcode);
      sessionStorage.setItem("env_doctor_session", JSON.stringify({
        environment_id: res.environment_id,
        session_token:  res.session_token,
        join_code:      res.join_code,
        expires_at:     res.expires_at,
      }));
      navigate(`/env/doctor/dashboard`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("401") || msg.toLowerCase().includes("incorrect"))
        setError("Incorrect passcode.");
      else if (msg.includes("410") || msg.toLowerCase().includes("expired"))
        setError("This environment has expired.");
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function copyCode() {
    if (created) {
      navigator.clipboard.writeText(created.join_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // After creation: show code + proceed button
  if (created) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4"
        style={{ background: "var(--bg-base)", paddingTop: 80 }}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="glass-card rounded-2xl p-8 max-w-md w-full text-center">
          <CheckCircle2 size={40} style={{ color: "#22c55e", margin: "0 auto 16px" }} />
          <h1 className="text-xl font-bold gradient-text mb-2">Environment Created</h1>
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
            Share this code with your patients. It expires on{" "}
            <strong>{new Date(created.expires_at).toLocaleString()}</strong>.
          </p>

          {/* Join code display */}
          <div className="p-5 rounded-2xl mb-4"
            style={{ background: "rgba(251,146,60,0.08)", border: "2px solid rgba(251,146,60,0.3)" }}>
            <p className="text-xs mb-2" style={{ color: "var(--text-subtle)" }}>Patient Join Code</p>
            <p className="text-4xl font-mono font-bold tracking-widest gradient-text mb-3">
              {created.join_code}
            </p>
            <button id="copy-code-btn" onClick={copyCode}
              className="flex items-center gap-2 mx-auto text-xs px-4 py-2 rounded-lg"
              style={{ background: "rgba(251,146,60,0.15)", color: "var(--ember)" }}>
              {copied ? <><CheckCircle2 size={12} /> Copied!</> : <><Copy size={12} /> Copy Code</>}
            </button>
          </div>

          <div className="p-3 rounded-xl mb-5 text-left"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <p className="text-xs" style={{ color: "var(--text-subtle)" }}>
              Patients join at <strong style={{ color: "var(--text-muted)" }}>
                {window.location.origin}/env/join
              </strong>. They enter this code and choose a pseudonym.
            </p>
          </div>

          <button id="go-dashboard-btn" onClick={() => navigate("/env/doctor/dashboard")}
            className="btn-primary w-full">
            Go to Dashboard →
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--bg-base)", paddingTop: 80 }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-8 max-w-md w-full">

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl" style={{ background: "rgba(251,146,60,0.12)" }}>
            <Stethoscope size={24} style={{ color: "var(--ember)" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold gradient-text">Doctor Portal</h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Create or access a screening environment
            </p>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-6 p-1 rounded-xl"
          style={{ background: "rgba(255,255,255,0.04)" }}>
          {(["create", "login"] as const).map(m => (
            <button key={m} id={`mode-${m}`} onClick={() => { setMode(m); setError(""); }}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all"
              style={{
                background: mode === m ? "rgba(251,146,60,0.2)" : "transparent",
                color: mode === m ? "var(--ember)" : "var(--text-muted)",
              }}>
              {m === "create" ? <><Plus size={14} /> New Environment</> : <><LogIn size={14} /> Login</>}
            </button>
          ))}
        </div>

        <form onSubmit={mode === "create" ? handleCreate : handleLogin} className="space-y-4">
          {mode === "login" && (
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-muted)" }}>
                Environment ID
              </label>
              <input id="env-id-input" value={envId} onChange={e => setEnvId(e.target.value)}
                placeholder="Paste your environment ID"
                required className="w-full px-4 py-3 rounded-xl font-mono text-sm"
                style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.1)",
                         color: "var(--text-primary)", outline: "none" }} />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-muted)" }}>
              {mode === "create" ? "Set Doctor Passcode" : "Doctor Passcode"}
            </label>
            <div className="relative">
              <input id="passcode-input" type={showPw ? "text" : "password"} value={passcode}
                onChange={e => setPasscode(e.target.value)}
                placeholder={mode === "create" ? "At least 8 characters" : "Enter your passcode"}
                required minLength={8}
                className="w-full px-4 py-3 rounded-xl pr-10"
                style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.1)",
                         color: "var(--text-primary)", outline: "none" }} />
              <button type="button" onClick={() => setShowPw(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-subtle)" }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {mode === "create" && (
              <p className="text-xs mt-1" style={{ color: "var(--text-subtle)" }}>
                Remember this passcode — it cannot be recovered. It is never stored in plain text.
              </p>
            )}
          </div>

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-start gap-2 p-3 rounded-xl"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertCircle size={14} style={{ color: "#ef4444", flexShrink: 0, marginTop: 1 }} />
              <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>
            </motion.div>
          )}

          <button id="doctor-submit-btn" type="submit" disabled={loading}
            className="btn-primary w-full" style={{ opacity: loading ? 0.7 : 1 }}>
            {loading ? "Please wait…" : mode === "create" ? "Create Environment" : "Login"}
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: "var(--text-subtle)" }}>
          Are you a patient?{" "}
          <a href="/env/join" style={{ color: "var(--ember)" }}>Join with a code →</a>
        </p>
      </motion.div>
    </div>
  );
}
