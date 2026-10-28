/**
 * PatientConfirmationPage — Full-viewport, design-system matched.
 */
import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Clock, MessageSquare, AlertTriangle } from 'lucide-react'
import { BackgroundVideo } from '../../components/BackgroundVideo'
import { pollSubmissionStatus } from '../../api/environmentApi'

const ease = [0.16, 1, 0.3, 1] as const

export function PatientConfirmationPage() {
  const raw     = sessionStorage.getItem('env_patient_session')
  const session = raw ? JSON.parse(raw) : null

  const [guidance, setGuidance]   = useState<string | null>(null)
  const [pollError, setPollError] = useState(false)

  useEffect(() => {
    if (!session) return
    let interval: ReturnType<typeof setInterval>

    async function poll() {
      try {
        const res = await pollSubmissionStatus(session.environment_id, session.submission_id, session.session_token)
        if (res.released_guidance) { setGuidance(res.released_guidance); clearInterval(interval) }
      } catch { setPollError(true); clearInterval(interval) }
    }

    poll()
    interval = setInterval(poll, 10_000)
    return () => clearInterval(interval)
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <BackgroundVideo scrimBase={0.82} scrimMax={0.92} />
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(255,255,255,0.016) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.016) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />

      <div style={{ minHeight: '100dvh', paddingTop: 'calc(var(--navbar-h) + 48px)', paddingBottom: 80, position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease }}
          style={{ width: '100%', maxWidth: 560, margin: '0 auto', padding: '0 24px' }}
        >
          <div style={{ background: 'rgba(20,16,14,0.72)', backdropFilter: 'blur(32px)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 'var(--r-lg)', padding: '48px 40px', boxShadow: '0 40px 80px rgba(0,0,0,0.6)', textAlign: 'center' }}>

            {/* Success icon */}
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', border: '1.5px solid rgba(34,197,94,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <CheckCircle2 size={30} style={{ color: '#22c55e' }} />
            </div>

            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 1.2rem + 1.2vw, 2.25rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 12 }}>
              <span className="gradient-text">Submission Received</span>
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body)', color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 32 }}>
              Your X-ray and questionnaire have been submitted. A doctor will review your case and may leave a note for you below.
            </p>

            {/* Doctor's note (shown after release) */}
            {guidance ? (
              <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                style={{ padding: '20px 22px', borderRadius: 'var(--r-md)', background: 'rgba(255,107,74,0.07)', border: '1.5px solid rgba(255,107,74,0.3)', textAlign: 'left', marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <MessageSquare size={16} style={{ color: 'var(--ember)' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ember)', fontWeight: 700 }}>Doctor's Note</span>
                </div>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body)', color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: 12 }}>{guidance}</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                  This note is from the reviewing doctor. It does not constitute a clinical diagnosis.
                </p>
              </motion.div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px 18px', borderRadius: 'var(--r-sm)', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', marginBottom: 28 }}>
                <Clock size={15} style={{ color: 'var(--text-muted)' }} />
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Waiting for doctor's note{pollError ? ' (unable to connect — please refresh)' : ' · checking every 10 seconds…'}
                </p>
              </div>
            )}

            {/* Safety notice — always shown */}
            <div style={{ padding: '14px 18px', borderRadius: 'var(--r-sm)', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <AlertTriangle size={15} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.65 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Safety reminder: </strong>
                  If you are experiencing severe symptoms such as difficulty breathing, high fever, or coughing blood, seek emergency medical care immediately.
                </p>
              </div>
            </div>

            {session && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 24 }}>
                Submitted as <strong style={{ color: 'var(--text-secondary)' }}>{session.pseudonym}</strong> · Data deleted automatically when session expires
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </>
  )
}
