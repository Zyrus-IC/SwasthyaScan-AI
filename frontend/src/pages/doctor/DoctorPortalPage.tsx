/**
 * DoctorPortalPage — Create / login. Full-viewport, site-design-matched.
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Stethoscope, Plus, LogIn, Eye, EyeOff, AlertCircle, Copy, CheckCircle2 } from 'lucide-react'
import { BackgroundVideo } from '../../components/BackgroundVideo'
import { createEnvironment, doctorLogin } from '../../api/environmentApi'

const ease = [0.16, 1, 0.3, 1] as const

export function DoctorPortalPage() {
  const navigate = useNavigate()
  const [mode, setMode]         = useState<'create' | 'login'>('create')
  const [passcode, setPasscode] = useState('')
  const [envId, setEnvId]       = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [created, setCreated]   = useState<{ join_code: string; expires_at: string } | null>(null)
  const [copied, setCopied]     = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (passcode.length < 8) { setError('Passcode must be at least 8 characters.'); return }
    setError(''); setLoading(true)
    try {
      const res = await createEnvironment(passcode)
      sessionStorage.setItem('env_doctor_session', JSON.stringify({
        environment_id: res.environment_id,
        session_token:  res.session_token,
        join_code:      res.join_code,
        expires_at:     res.expires_at,
      }))
      setCreated({ join_code: res.join_code, expires_at: res.expires_at })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create environment.')
    } finally { setLoading(false) }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await doctorLogin(envId.trim(), passcode)
      sessionStorage.setItem('env_doctor_session', JSON.stringify({
        environment_id: res.environment_id,
        session_token:  res.session_token,
        join_code:      res.join_code,
        expires_at:     res.expires_at,
      }))
      navigate('/env/doctor/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('401') || msg.toLowerCase().includes('incorrect')) setError('Incorrect passcode.')
      else if (msg.includes('410') || msg.toLowerCase().includes('expired')) setError('This environment has expired.')
      else setError(msg)
    } finally { setLoading(false) }
  }

  function copyCode() {
    if (created) {
      navigator.clipboard.writeText(created.join_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  /* ── After creation: show join code screen ── */
  if (created) {
    return (
      <>
        <BackgroundVideo scrimBase={0.82} scrimMax={0.92} />
        <div style={{ minHeight: '100dvh', paddingTop: 'calc(var(--navbar-h) + 64px)', paddingBottom: 80, position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease }}
            style={{ width: '100%', maxWidth: 560, margin: '0 auto', padding: '0 24px' }}
          >
            <div style={{
              background: 'rgba(20,16,14,0.72)', backdropFilter: 'blur(32px)',
              border: '1px solid rgba(255,255,255,0.10)', borderRadius: 'var(--r-lg)',
              padding: '48px 48px 40px', boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
            }}>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <CheckCircle2 size={24} style={{ color: '#22c55e' }} />
                </div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 1.2rem + 1.2vw, 2rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>
                  <span className="gradient-text">Environment Created</span>
                </h1>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Share this code with your patients. Expires{' '}
                  <strong style={{ color: 'var(--text-secondary)' }}>{new Date(created.expires_at).toLocaleString()}</strong>
                </p>
              </div>

              {/* Join code */}
              <div style={{ padding: '28px 24px', borderRadius: 'var(--r-md)', background: 'rgba(255,107,74,0.07)', border: '1.5px solid rgba(255,107,74,0.25)', textAlign: 'center', marginBottom: 24 }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
                  Patient Join Code
                </p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(2rem, 1.5rem + 2vw, 3rem)', fontWeight: 800, letterSpacing: '0.18em', background: 'var(--grad-brand)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 16 }}>
                  {created.join_code}
                </p>
                <button id="copy-code-btn" onClick={copyCode}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 'var(--r-pill)', background: 'rgba(255,107,74,0.12)', border: '1px solid rgba(255,107,74,0.25)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--ember)', transition: 'all 0.2s' }}>
                  {copied ? <><CheckCircle2 size={14} /> Copied!</> : <><Copy size={14} /> Copy Code</>}
                </button>
              </div>

              <div style={{ padding: '14px 16px', borderRadius: 'var(--r-sm)', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', marginBottom: 28 }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Patients join at <strong style={{ color: 'var(--text-secondary)' }}>{window.location.origin}/env/join</strong> and enter this code.
                </p>
              </div>

              <button id="go-dashboard-btn" onClick={() => navigate('/env/doctor/dashboard')}
                style={{ width: '100%', padding: '14px 24px', borderRadius: 'var(--r-md)', background: 'var(--grad-brand)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: 'var(--text-body)', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em', transition: 'opacity 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                Go to Dashboard →
              </button>
            </div>
          </motion.div>
        </div>
      </>
    )
  }

  /* ── Create / Login form ── */
  return (
    <>
      <BackgroundVideo scrimBase={0.82} scrimMax={0.92} />
      {/* Subtle grid */}
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(255,255,255,0.016) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.016) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />

      <div style={{ minHeight: '100dvh', paddingTop: 'calc(var(--navbar-h) + 64px)', paddingBottom: 80, position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease }}
          style={{ width: '100%', maxWidth: 520, margin: '0 auto', padding: '0 24px' }}
        >
          {/* Section label */}
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ember)', marginBottom: 12 }}>
            Doctor Access
          </p>

          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 1.3rem + 1.8vw, 2.5rem)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 32 }}>
            {mode === 'create' ? (
              <>Create a <span className="gradient-text">Screening Session</span></>
            ) : (
              <>Access Your <span className="gradient-text">Dashboard</span></>
            )}
          </h1>

          <div style={{ background: 'rgba(20,16,14,0.72)', backdropFilter: 'blur(32px)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 'var(--r-lg)', padding: '36px 36px 32px', boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}>

            {/* Icon + subtitle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
              <div style={{ width: 44, height: 44, borderRadius: 'var(--r-sm)', background: 'rgba(255,107,74,0.12)', border: '1px solid rgba(255,107,74,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Stethoscope size={20} style={{ color: 'var(--ember)' }} />
              </div>
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-h2)', fontWeight: 700, letterSpacing: '-0.015em', color: 'var(--text-primary)' }}>Doctor Portal</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Create or access a screening environment</p>
              </div>
            </div>

            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 'var(--r-md)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', marginBottom: 28 }}>
              {(['create', 'login'] as const).map(m => (
                <button key={m} id={`mode-${m}`} onClick={() => { setMode(m); setError('') }}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px', borderRadius: 'calc(var(--r-md) - 4px)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600, transition: 'all 0.2s', background: mode === m ? 'rgba(255,107,74,0.16)' : 'transparent', color: mode === m ? 'var(--ember)' : 'var(--text-muted)' }}>
                  {m === 'create' ? <Plus size={15} /> : <LogIn size={15} />}
                  {m === 'create' ? 'New Environment' : 'Login'}
                </button>
              ))}
            </div>

            <form onSubmit={mode === 'create' ? handleCreate : handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {mode === 'login' && (
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
                    Environment ID
                  </label>
                  <input id="env-id-input" value={envId} onChange={e => setEnvId(e.target.value)}
                    placeholder="Paste your environment ID"
                    required
                    style={{ width: '100%', padding: '13px 16px', borderRadius: 'var(--r-sm)', background: 'rgba(255,255,255,0.04)', border: '1.5px solid var(--border-medium)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', outline: 'none', transition: 'border-color 0.2s' }}
                    onFocus={e => (e.target.style.borderColor = 'rgba(255,107,74,0.5)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border-medium)')}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
                  {mode === 'create' ? 'Set Doctor Passcode' : 'Doctor Passcode'}
                </label>
                <div style={{ position: 'relative' }}>
                  <input id="passcode-input" type={showPw ? 'text' : 'password'} value={passcode}
                    onChange={e => setPasscode(e.target.value)}
                    placeholder={mode === 'create' ? 'At least 8 characters' : 'Enter your passcode'}
                    required minLength={8}
                    style={{ width: '100%', padding: '13px 48px 13px 16px', borderRadius: 'var(--r-sm)', background: 'rgba(255,255,255,0.04)', border: '1.5px solid var(--border-medium)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body)', outline: 'none', transition: 'border-color 0.2s' }}
                    onFocus={e => (e.target.style.borderColor = 'rgba(255,107,74,0.5)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border-medium)')}
                  />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                    {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {mode === 'create' && (
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
                    Remember this passcode — it cannot be recovered. Never stored in plain text.
                  </p>
                )}
              </div>

              {error && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 'var(--r-sm)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertCircle size={15} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: '#ef4444', lineHeight: 1.5 }}>{error}</p>
                </motion.div>
              )}

              <button id="doctor-submit-btn" type="submit" disabled={loading}
                style={{ width: '100%', padding: '14px 24px', borderRadius: 'var(--r-md)', background: 'var(--grad-brand)', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-display)', fontSize: 'var(--text-body)', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em', opacity: loading ? 0.65 : 1, transition: 'opacity 0.2s' }}>
                {loading ? 'Please wait…' : mode === 'create' ? 'Create Environment' : 'Login'}
              </button>
            </form>
          </div>

          <p style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 20 }}>
            Are you a patient?{' '}
            <a href="/env/join" style={{ color: 'var(--ember)', textDecoration: 'none' }}>Join with a code →</a>
          </p>
        </motion.div>
      </div>
    </>
  )
}
