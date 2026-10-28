/**
 * ConsentPage — Full-viewport, design-system matched.
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ShieldCheck, Clock, Trash2, AlertTriangle } from 'lucide-react'
import { BackgroundVideo } from '../../components/BackgroundVideo'

const ease = [0.16, 1, 0.3, 1] as const

const field = (label: string, value: string | boolean) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
    <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{label}</span>
    <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600, color: typeof value === 'boolean' ? (value ? '#22c55e' : '#ef4444') : 'var(--text-primary)' }}>
      {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}
    </span>
  </div>
)

export function ConsentPage() {
  const navigate  = useNavigate()
  const [agreed, setAgreed] = useState(false)

  const raw = sessionStorage.getItem('env_patient_session')
  if (!raw) {
    return (
      <>
        <BackgroundVideo scrimBase={0.85} scrimMax={0.92} />
        <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-muted)' }}>
            Session not found.{' '}<a href="/env/join" style={{ color: 'var(--ember)' }}>Join again →</a>
          </p>
        </div>
      </>
    )
  }
  const session  = JSON.parse(raw)
  const expires  = new Date(session.environment_expires_at)
  const expiryStr = expires.toLocaleString()

  return (
    <>
      <BackgroundVideo scrimBase={0.82} scrimMax={0.92} />
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(255,255,255,0.016) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.016) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />

      <div style={{ minHeight: '100dvh', paddingTop: 'calc(var(--navbar-h) + 48px)', paddingBottom: 80, position: 'relative', zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease }}
          style={{ maxWidth: 680, margin: '0 auto', padding: '0 24px' }}
        >
          {/* Header */}
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ember)', marginBottom: 12 }}>
            Before You Continue
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 1.3rem + 1.8vw, 2.5rem)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 32 }}>
            <span className="gradient-text">Research Consent</span>
          </h1>

          <div style={{ background: 'rgba(20,16,14,0.72)', backdropFilter: 'blur(32px)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 'var(--r-lg)', padding: '36px', boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}>

            {/* Icon row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
              <div style={{ width: 44, height: 44, borderRadius: 'var(--r-sm)', background: 'rgba(255,107,74,0.12)', border: '1px solid rgba(255,107,74,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ShieldCheck size={20} style={{ color: 'var(--ember)' }} />
              </div>
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-h2)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.015em' }}>Data &amp; Privacy</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Please read carefully before continuing</p>
              </div>
            </div>

            {/* Prototype notice */}
            <div style={{ padding: '14px 16px', borderRadius: 'var(--r-sm)', background: 'rgba(255,107,74,0.06)', border: '1px solid rgba(255,107,74,0.18)', marginBottom: 28, display: 'flex', gap: 10 }}>
              <AlertTriangle size={16} style={{ color: 'var(--ember)', flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                <strong style={{ color: 'var(--text-primary)' }}>SwasthyaScan AI is a screening support tool.</strong> It is not a certified medical device and is not approved for clinical diagnosis. All AI output requires professional medical interpretation.
              </p>
            </div>

            {/* What IS stored */}
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>What will be stored</p>
            <div style={{ marginBottom: 24 }}>
              {[
                `Your pseudonymous ID: ${session.pseudonym}`,
                'Your chest X-ray image (re-encoded to strip metadata)',
                'Your symptom questionnaire answers',
                'The AI model output and attention heatmap',
                'A review priority label and your doctor\'s notes',
              ].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--ember)', fontSize: 14, marginTop: 1, flexShrink: 0 }}>•</span>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.55 }}>{item}</p>
                </div>
              ))}
            </div>

            {/* What is NOT stored */}
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>What will NOT be stored</p>
            <div style={{ marginBottom: 28 }}>
              {[
                'Your real name, phone number, email address, or location',
                'Any identifying metadata from the image (stripped on upload)',
                'Your IP address (used only for rate limiting, not logged)',
              ].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: '#22c55e', fontSize: 14, marginTop: 1, flexShrink: 0 }}>✓</span>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.55 }}>{item}</p>
                </div>
              ))}
            </div>

            {/* Retention cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
              <div style={{ padding: '16px', borderRadius: 'var(--r-sm)', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', display: 'flex', gap: 10 }}>
                <Clock size={16} style={{ color: 'var(--ember)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Auto-deletion</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.55 }}>All data deleted automatically on <strong style={{ color: 'var(--text-secondary)' }}>{expiryStr}</strong></p>
                </div>
              </div>
              <div style={{ padding: '16px', borderRadius: 'var(--r-sm)', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', display: 'flex', gap: 10 }}>
                <Trash2 size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Early deletion</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.55 }}>Your doctor can delete all data at any time before expiry</p>
                </div>
              </div>
            </div>

            {/* Safety */}
            <div style={{ padding: '14px 16px', borderRadius: 'var(--r-sm)', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', marginBottom: 28, display: 'flex', gap: 10 }}>
              <AlertTriangle size={15} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.65 }}>
                <strong style={{ color: 'var(--text-primary)' }}>⚠️ Safety reminder: </strong>
                If you are experiencing severe symptoms — difficulty breathing, high fever, or coughing up blood — seek emergency medical care immediately. Do not wait for this review.
              </p>
            </div>

            {/* Consent checkbox */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', marginBottom: 28 }}>
              <input id="consent-checkbox" type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                style={{ marginTop: 3, width: 17, height: 17, accentColor: 'var(--ember)', cursor: 'pointer' }} />
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                I understand SwasthyaScan AI is a screening support tool, I have read the above information, and I consent to my pseudonymous data being stored for this screening session.
              </p>
            </label>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button id="consent-decline-btn" onClick={() => { sessionStorage.removeItem('env_patient_session'); navigate('/') }}
                style={{ flex: 1, padding: '13px 20px', borderRadius: 'var(--r-md)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-medium)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-muted)', transition: 'all 0.2s' }}>
                Decline &amp; Exit
              </button>
              <button id="consent-agree-btn" disabled={!agreed} onClick={() => navigate('/env/patient-submit')}
                style={{ flex: 2, padding: '13px 24px', borderRadius: 'var(--r-md)', background: 'var(--grad-brand)', border: 'none', cursor: agreed ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-display)', fontSize: 'var(--text-body)', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em', opacity: agreed ? 1 : 0.38, transition: 'opacity 0.2s' }}>
                I Agree — Continue
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  )
}
