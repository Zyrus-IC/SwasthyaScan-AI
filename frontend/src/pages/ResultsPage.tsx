import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Plus,
  Brain,
  Phone,
  Stethoscope,
  HeartPulse,
  ShieldCheck,
  Activity,
  Clock,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { useReport } from '../hooks/ReportContext'

// ─── Types ───────────────────────────────────────────────────────────────────

type AnalysisStatus = 'completed' | 'limited' | 'review_recommended' | 'unavailable'

interface ResultState {
  status: AnalysisStatus
  message?: string
  model_output?: {
    prediction: 'TB' | 'Normal'
    score: number
    threshold?: number
    label_meaning: string
  }
  reliability_flags?: Array<{ flag: string; ok: boolean; note?: string }>
  review_reasons?: string[]
  limitations?: string[]
  imageName?: string
  symptoms?: Record<string, unknown>
  gradcam_heatmap?: string | null
}

// ─── TB Next Steps ────────────────────────────────────────────────────────────

const TB_STEPS = [
  {
    icon: <Phone size={20} />,
    title: 'See a Doctor Immediately',
    desc: 'Visit a pulmonologist, chest specialist, or your nearest government TB centre (DOTS). Do not delay — TB is curable when caught early.',
    urgent: true,
  },
  {
    icon: <Activity size={20} />,
    title: 'Get Confirmatory Tests',
    desc: 'A chest X-ray AI result is NOT a diagnosis. You need sputum smear microscopy, GeneXpert/CBNAAT test, or culture test to confirm TB.',
    urgent: false,
  },
  {
    icon: <HeartPulse size={20} />,
    title: 'Wear a Mask & Isolate if Symptomatic',
    desc: 'If you have cough, fever, or night sweats, wear a mask and limit close contact with others until you see a doctor.',
    urgent: false,
  },
  {
    icon: <Stethoscope size={20} />,
    title: 'Free Treatment Available',
    desc: 'TB treatment is FREE at all government hospitals and health centres in India under the National TB Elimination Programme (NTEP).',
    urgent: false,
  },
]

const NORMAL_STEPS = [
  {
    icon: <ShieldCheck size={20} />,
    title: 'No TB Indicators Found',
    desc: 'The AI found no TB-consistent patterns in this X-ray. However, a normal AI result does NOT rule out TB — always consult a doctor if you have symptoms.',
    urgent: false,
  },
  {
    icon: <HeartPulse size={20} />,
    title: 'Continue Healthy Habits',
    desc: 'Eat well, stay active, get enough sleep, and avoid crowded poorly-ventilated spaces. Good immunity is your best defence.',
    urgent: false,
  },
  {
    icon: <Stethoscope size={20} />,
    title: 'See a Doctor if Symptoms Persist',
    desc: 'If you have persistent cough (>2 weeks), fever, night sweats, or unexplained weight loss — visit a doctor even if this screening shows Normal.',
    urgent: false,
  },
]

// ─── Results Page ─────────────────────────────────────────────────────────────

export const ResultsPage: React.FC = () => {
  const navigate  = useNavigate()
  const location  = useLocation()
  const state     = location.state as ResultState | null
  const { setReport } = useReport()

  useEffect(() => {
    if (state) {
      setReport({
        status:         state.status,
        prediction:     state.model_output?.prediction,
        score:          state.model_output?.score,
        message:        state.message,
        limitations:    state.limitations,
        review_reasons: state.review_reasons,
      })
    }
    return () => setReport(null)
  }, [state, setReport])

  if (!state) {
    return (
      <div className="min-h-screen pt-24 pb-16 flex items-center justify-center"
        style={{ background: 'var(--bg-base)' }}>
        <div className="text-center">
          <XCircle size={48} className="mx-auto mb-4" style={{ color: 'var(--text-subtle)' }} />
          <h1 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            No results to display
          </h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Please start a new screening session.
          </p>
          <Button variant="primary" onClick={() => navigate('/screening')}>
            Start Screening
          </Button>
        </div>
      </div>
    )
  }

  const pred      = state.model_output?.prediction
  const score     = state.model_output?.score ?? 0
  const threshold = (state.model_output as any)?.threshold ?? 0.1453
  const isTB      = pred === 'TB'
  const hasResult = pred === 'TB' || pred === 'Normal'
  const steps     = isTB ? TB_STEPS : NORMAL_STEPS

  return (
    <div className="min-h-screen pt-20 pb-16" style={{ background: 'var(--bg-base)' }}>
      <div className="fixed inset-0 grid-bg opacity-10 pointer-events-none" />

      <div className="container relative z-10" style={{ maxWidth: 860 }}>

        {/* Back */}
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }} className="mb-6">
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />}
            onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </motion.div>

        {/* ── HERO RESULT BANNER ── */}
        {hasResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.5 }}
            style={{
              borderRadius: 24,
              marginBottom: 28,
              padding: '36px 40px',
              background: isTB
                ? 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.08) 100%)'
                : 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(22,163,74,0.08) 100%)',
              border: `2px solid ${isTB ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)'}`,
            }}
          >
            <div className="flex items-center gap-4 mb-3">
              <span style={{
                fontSize: 48,
                lineHeight: 1,
                filter: isTB ? 'drop-shadow(0 0 12px rgba(239,68,68,0.6))' : 'drop-shadow(0 0 12px rgba(34,197,94,0.6))',
              }}>
                {isTB ? '⚠️' : '✅'}
              </span>
              <div>
                <p className="text-xs font-mono uppercase tracking-widest mb-1"
                  style={{ color: isTB ? 'rgba(239,68,68,0.7)' : 'rgba(34,197,94,0.7)' }}>
                  AI Screening Result
                </p>
                <h1 style={{
                  fontSize: 'clamp(28px, 5vw, 42px)',
                  fontWeight: 800,
                  fontFamily: 'var(--font-heading)',
                  color: isTB ? '#EF4444' : '#22C55E',
                  lineHeight: 1.1,
                  letterSpacing: '-0.5px',
                }}>
                  {isTB ? 'TB Indicators Detected' : 'No TB Indicators Detected'}
                </h1>
              </div>
            </div>

            {/* Score bar */}
            <div className="mt-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-mono" style={{ color: 'var(--text-subtle)' }}>
                  TB Probability Score
                </span>
                <span className="text-sm font-bold font-mono" style={{
                  color: isTB ? '#EF4444' : '#22C55E',
                }}>
                  {(score * 100).toFixed(1)}%
                </span>
              </div>
              <div style={{
                height: 10, borderRadius: 99,
                background: 'rgba(255,255,255,0.08)',
                overflow: 'hidden',
              }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${score * 100}%` }}
                  transition={{ delay: 0.4, duration: 0.8, ease: 'easeOut' }}
                  style={{
                    height: '100%', borderRadius: 99,
                    background: isTB
                      ? 'linear-gradient(90deg, #F97316, #EF4444)'
                      : 'linear-gradient(90deg, #22C55E, #16A34A)',
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>0%</span>
                <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                  Threshold: {(threshold * 100).toFixed(1)}%
                </span>
                <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>100%</span>
              </div>
            </div>

            <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Note: </strong>
              This is an AI screening result — not a medical diagnosis. A {isTB ? 'positive' : 'negative'} result
              {isTB
                ? ' does not confirm TB. Confirmatory tests are required.'
                : ' does not rule out TB. See a doctor if you have symptoms.'}
            </p>

            {state.imageName && (
              <p className="mt-2 text-xs font-mono" style={{ color: 'var(--text-subtle)' }}>
                <Clock size={10} style={{ display: 'inline', marginRight: 4 }} />
                {state.imageName} · {new Date().toLocaleString()}
              </p>
            )}
          </motion.div>
        )}

        {/* ── GRAD-CAM++ SIDE-BY-SIDE ── */}
        {state.gradcam_heatmap && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="glass-card rounded-2xl p-6 mb-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <Brain size={18} style={{ color: 'var(--violet)' }} />
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                AI Attention Map — Grad-CAM++
              </h2>
              <span className="status-chip status-chip-muted" style={{ fontSize: 11 }}>
                Region the AI analyzed
              </span>
            </div>

            <p className="text-xs mb-4" style={{ color: 'var(--text-subtle)' }}>
              Left: Original X-ray &nbsp;|&nbsp; Right: Heatmap overlay showing which regions influenced the prediction
            </p>

            {/* Full-width side-by-side image */}
            <div style={{
              borderRadius: 14,
              overflow: 'hidden',
              border: `2px solid ${isTB ? 'rgba(239,68,68,0.35)' : 'rgba(34,197,94,0.35)'}`,
              boxShadow: isTB
                ? '0 4px 32px rgba(239,68,68,0.2)'
                : '0 4px 32px rgba(34,197,94,0.2)',
              marginBottom: 14,
            }}>
              <img
                src={state.gradcam_heatmap}
                alt="Original X-ray and Grad-CAM++ heatmap side by side"
                style={{ width: '100%', display: 'block' }}
              />
            </div>

            {/* Colorbar legend */}
            <div style={{ marginBottom: 12 }}>
              <div style={{
                height: 12, borderRadius: 6,
                background: 'linear-gradient(90deg, #00007F, #0000FF, #00FFFF, #00FF00, #FFFF00, #FF7F00, #FF0000)',
              }} />
              <div className="flex justify-between mt-1">
                <span className="text-xs font-mono" style={{ color: 'var(--text-subtle)' }}>Low focus</span>
                <span className="text-xs font-mono" style={{ color: 'var(--text-subtle)' }}>↑ Model Attention ↑</span>
                <span className="text-xs font-mono" style={{ color: 'var(--text-subtle)' }}>High focus 🔴</span>
              </div>
            </div>

            <div style={{
              padding: '10px 14px', borderRadius: 10,
              background: 'rgba(255,107,74,0.05)',
              border: '1px solid rgba(255,107,74,0.12)',
            }}>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>⚠️ Grad-CAM++ is a model explanation tool — not a clinical finding. </strong>
                Red/hot zones show where the model paid attention for this prediction.
                Only a radiologist can confirm whether these regions indicate disease.
              </p>
            </div>
          </motion.div>
        )}

        {/* ── NEXT STEPS ── */}
        {hasResult && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="glass-card rounded-2xl p-6 mb-6"
          >
            <h2 className="text-base font-bold mb-5" style={{
              fontFamily: 'var(--font-heading)',
              color: 'var(--text-primary)',
            }}>
              {isTB ? '🚨 Recommended Next Steps' : '✅ What to Do Next'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {steps.map((step, i) => (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.07, duration: 0.4 }}
                  style={{
                    display: 'flex',
                    gap: 14,
                    padding: '16px 18px',
                    borderRadius: 14,
                    background: step.urgent
                      ? 'rgba(239,68,68,0.06)'
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${step.urgent ? 'rgba(239,68,68,0.2)' : 'var(--border-subtle)'}`,
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isTB
                      ? (step.urgent ? 'rgba(239,68,68,0.15)' : 'rgba(255,107,74,0.1)')
                      : 'rgba(34,197,94,0.1)',
                    color: isTB ? (step.urgent ? '#EF4444' : 'var(--ember)') : '#22C55E',
                  }}>
                    {step.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                      {step.urgent && <span style={{ color: '#EF4444' }}>[Urgent] </span>}
                      {step.title}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      {step.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── MODEL UNAVAILABLE ── */}
        {state.status === 'unavailable' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="glass-card rounded-2xl p-8 mb-6 text-center"
          >
            <XCircle size={48} className="mx-auto mb-4" style={{ color: 'var(--text-subtle)' }} />
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              Unable to Assess
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto' }}>
              {state.message || 'The AI model could not run. This is not a negative result — please consult a doctor.'}
            </p>
          </motion.div>
        )}

        {/* ── DISCLAIMER ── */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          style={{
            padding: '14px 18px',
            borderRadius: 14,
            background: 'rgba(255,107,107,0.04)',
            border: '1px solid rgba(255,107,107,0.12)',
            marginBottom: 28,
          }}
        >
          <div className="flex gap-3">
            <AlertTriangle size={14} style={{ color: '#EF4444', flexShrink: 0, marginTop: 2 }} />
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              <strong style={{ color: '#EF4444' }}>Medical Disclaimer: </strong>
              SwasthyaScan AI provides screening support. This report does not constitute a medical diagnosis.
              AI screening cannot confirm or rule out tuberculosis.
              Always consult a qualified healthcare professional for diagnosis and treatment.
            </p>
          </div>
        </motion.div>

        {/* ── ACTIONS ── */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="flex flex-wrap gap-4"
        >
          <Button variant="primary" onClick={() => navigate('/screening')} icon={<Plus size={16} />}>
            New Screening
          </Button>
          <Button variant="secondary" onClick={() => navigate('/dashboard')}>
            Dashboard
          </Button>
        </motion.div>

      </div>
    </div>
  )
}
