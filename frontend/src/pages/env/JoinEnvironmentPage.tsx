/**
 * JoinEnvironmentPage — Patient enters join code + pseudonym
 * Full-viewport, matches site design system.
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { QrCode, ArrowRight, AlertCircle } from 'lucide-react'
import { BackgroundVideo } from '../../components/BackgroundVideo'
import { lookupByCode, joinEnvironment } from '../../api/environmentApi'

const ease = [0.16, 1, 0.3, 1] as const

export function JoinEnvironmentPage() {
  const navigate = useNavigate()
  const [code, setCode]         = useState('')
  const [pseudonym, setPseudonym] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { environment_id } = await lookupByCode(code.trim())
      const session = await joinEnvironment(environment_id, code.trim(), pseudonym.trim())
      sessionStorage.setItem('env_patient_session', JSON.stringify({
        environment_id,
        submission_id: session.submission_id,
        session_token: session.session_token,
        pseudonym: session.pseudonym,
        environment_expires_at: session.environment_expires_at,
      }))
      navigate('/env/consent')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('429') || msg.toLowerCase().includes('too many'))
        setError('Too many attempts. Please wait before trying again.')
      else if (msg.includes('410') || msg.toLowerCase().includes('expired'))
        setError('This join code has expired.')
      else if (msg.includes('403') || msg.toLowerCase().includes('closed'))
        setError('This environment is closed. Contact your doctor.')
      else if (msg.includes('404') || msg.toLowerCase().includes('invalid'))
        setError('Invalid join code. Please check with your doctor.')
      else setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <BackgroundVideo scrimBase={0.82} scrimMax={0.92} />
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(255,255,255,0.016) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.016) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />

      <div style={{ minHeight: '100dvh', paddingTop: 'calc(var(--navbar-h) + 64px)', paddingBottom: 80, position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease }}
          style={{ width: '100%', maxWidth: 520, margin: '0 auto', padding: '0 24px' }}
        >
          {/* Section label */}
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ember)', marginBottom: 12 }}>
            Patient Access
          </p>

          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 1.3rem + 1.8vw, 2.5rem)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 32 }}>
            Join a <span className="gradient-text">Screening Session</span>
          </h1>

          <div style={{ background: 'rgba(20,16,14,0.72)', backdropFilter: 'blur(32px)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 'var(--r-lg)', padding: '36px 36px 32px', boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}>

            {/* Icon + subtitle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
              <div style={{ width: 44, height: 44, borderRadius: 'var(--r-sm)', background: 'rgba(255,107,74,0.12)', border: '1px solid rgba(255,107,74,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <QrCode size={20} style={{ color: 'var(--ember)' }} />
              </div>
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-h2)', fontWeight: 700, letterSpacing: '-0.015em', color: 'var(--text-primary)' }}>Enter Join Code</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Code provided by your doctor</p>
              </div>
            </div>

            <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Join code */}
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
                  Join Code (8 characters)
                </label>
                <input
                  id="join-code-input"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ABCD1234"
                  maxLength={8}
                  required
                  style={{ width: '100%', padding: '16px 20px', borderRadius: 'var(--r-sm)', background: 'rgba(255,255,255,0.04)', border: '1.5px solid var(--border-medium)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 'clamp(1.25rem, 1rem + 1vw, 1.75rem)', fontWeight: 700, letterSpacing: '0.22em', textAlign: 'center', outline: 'none', transition: 'border-color 0.2s' }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(255,107,74,0.5)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border-medium)')}
                />
              </div>

              {/* Pseudonym */}
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
                  Pseudonymous ID
                </label>
                <input
                  id="pseudonym-input"
                  value={pseudonym}
                  onChange={e => setPseudonym(e.target.value)}
                  placeholder="e.g. Patient-07  (no real name)"
                  maxLength={32}
                  required
                  style={{ width: '100%', padding: '13px 16px', borderRadius: 'var(--r-sm)', background: 'rgba(255,255,255,0.04)', border: '1.5px solid var(--border-medium)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body)', outline: 'none', transition: 'border-color 0.2s' }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(255,107,74,0.5)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border-medium)')}
                />
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
                  Do not use your real name, phone number, or email address.
                </p>
              </div>

              {error && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 'var(--r-sm)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertCircle size={15} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: '#ef4444', lineHeight: 1.5 }}>{error}</p>
                </motion.div>
              )}

              <button id="join-btn" type="submit" disabled={loading}
                style={{ width: '100%', padding: '14px 24px', borderRadius: 'var(--r-md)', background: 'var(--grad-brand)', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-display)', fontSize: 'var(--text-body)', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em', opacity: loading ? 0.65 : 1, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {loading ? 'Joining…' : <><span>Continue</span><ArrowRight size={17} /></>}
              </button>
            </form>
          </div>

          <p style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 20 }}>
            Are you a doctor?{' '}
            <a href="/env/doctor" style={{ color: 'var(--ember)', textDecoration: 'none' }}>Create or access an environment →</a>
          </p>
        </motion.div>
      </div>
    </>
  )
}
