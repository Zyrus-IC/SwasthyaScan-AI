/**
 * PatientSubmissionPage — Full-viewport, design-system matched.
 */
import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Upload, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { BackgroundVideo } from '../../components/BackgroundVideo'
import { submitXray } from '../../api/environmentApi'

const ease = [0.16, 1, 0.3, 1] as const

const SYMPTOMS = [
  { key: 'persistent_cough', label: 'Persistent cough (≥ 2 weeks)' },
  { key: 'fever',            label: 'Fever or chills' },
  { key: 'night_sweats',     label: 'Night sweats' },
  { key: 'weight_loss',      label: 'Unexplained weight loss' },
  { key: 'fatigue',          label: 'Fatigue or weakness' },
  { key: 'hemoptysis',       label: 'Coughing up blood (haemoptysis)' },
]

export function PatientSubmissionPage() {
  const navigate = useNavigate()
  const fileRef  = useRef<HTMLInputElement>(null)

  const raw = sessionStorage.getItem('env_patient_session')
  if (!raw) {
    return (
      <>
        <BackgroundVideo scrimBase={0.85} scrimMax={0.92} />
        <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-muted)' }}>
            Session expired. <a href="/env/join" style={{ color: 'var(--ember)' }}>Join again →</a>
          </p>
        </div>
      </>
    )
  }
  const session = JSON.parse(raw)

  const [file, setFile]         = useState<File | null>(null)
  const [preview, setPreview]   = useState('')
  const [symptoms, setSymptoms] = useState<Record<string, boolean>>({})
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  function handleFile(f: File) {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png']
    if (!allowed.includes(f.type)) { setError('Please upload a JPEG or PNG image.'); return }
    if (f.size > 10 * 1024 * 1024) { setError('Image must be under 10 MB.'); return }
    setError(''); setFile(f); setPreview(URL.createObjectURL(f))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { setError('Please upload a chest X-ray image.'); return }
    setError(''); setLoading(true)
    try {
      await submitXray(session.environment_id, session.submission_id, session.session_token, file, symptoms)
      navigate('/env/confirmation')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.')
    } finally { setLoading(false) }
  }

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
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ember)', marginBottom: 6 }}>
            Session · {session.pseudonym}
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 1.3rem + 1.8vw, 2.5rem)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 8 }}>
            Submit Your <span className="gradient-text">X-Ray</span>
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body)', color: 'var(--text-muted)', marginBottom: 36, lineHeight: 1.6 }}>
            Your submission will be reviewed by a doctor. You will not see raw AI scores — only your doctor's assessment.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Upload */}
            <div style={{ background: 'rgba(20,16,14,0.72)', backdropFilter: 'blur(32px)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 'var(--r-lg)', padding: '28px', boxShadow: '0 32px 64px rgba(0,0,0,0.5)' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-h2)', fontWeight: 700, letterSpacing: '-0.015em', color: 'var(--text-primary)', marginBottom: 16 }}>
                Chest X-Ray Image
              </p>
              <div id="xray-dropzone"
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                style={{ borderRadius: 'var(--r-md)', border: `2px dashed ${file ? 'var(--ember)' : 'var(--border-medium)'}`, background: file ? 'rgba(255,107,74,0.04)' : 'rgba(255,255,255,0.02)', minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', padding: 16 }}>
                {preview ? (
                  <img src={preview} alt="X-ray preview" style={{ maxHeight: 220, borderRadius: 12, objectFit: 'contain' }} />
                ) : (
                  <>
                    <Upload size={32} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Click or drag-and-drop your chest X-ray</p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>JPEG or PNG · max 10 MB</p>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
              {file && (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: '#22c55e', marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={13} /> {file.name}
                </p>
              )}
            </div>

            {/* Symptoms */}
            <div style={{ background: 'rgba(20,16,14,0.72)', backdropFilter: 'blur(32px)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 'var(--r-lg)', padding: '28px', boxShadow: '0 32px 64px rgba(0,0,0,0.5)' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-h2)', fontWeight: 700, letterSpacing: '-0.015em', color: 'var(--text-primary)', marginBottom: 6 }}>
                Symptom Questionnaire
              </p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 20 }}>
                Select all symptoms you have been experiencing
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {SYMPTOMS.map(s => (
                  <label key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                    <input id={`sym-${s.key}`} type="checkbox" checked={!!symptoms[s.key]} onChange={() => setSymptoms(prev => ({ ...prev, [s.key]: !prev[s.key] }))}
                      style={{ width: 18, height: 18, accentColor: 'var(--ember)', cursor: 'pointer', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body)', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{s.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Privacy note */}
            <div style={{ padding: '14px 18px', borderRadius: 'var(--r-sm)', background: 'rgba(255,107,74,0.05)', border: '1px solid rgba(255,107,74,0.12)' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                🔒 Your X-ray metadata is stripped on upload. You are identified only as <strong style={{ color: 'var(--text-secondary)' }}>{session.pseudonym}</strong>. Data is deleted automatically when this session expires.
              </p>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 'var(--r-sm)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle size={15} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: '#ef4444', lineHeight: 1.5 }}>{error}</p>
              </motion.div>
            )}

            <button id="submit-xray-btn" type="submit" disabled={loading || !file}
              style={{ width: '100%', padding: '15px 24px', borderRadius: 'var(--r-md)', background: 'var(--grad-brand)', border: 'none', cursor: loading || !file ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-display)', fontSize: 'var(--text-body)', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em', opacity: loading || !file ? 0.45 : 1, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Submitting…</> : 'Submit for Review'}
            </button>
          </form>
        </motion.div>
      </div>
    </>
  )
}
