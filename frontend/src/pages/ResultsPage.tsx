import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  ArrowLeft,
  Plus,
  Shield,
  Brain,
  Clock,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { useReport } from '../hooks/ReportContext'

// ============================================================
// TYPES
// ============================================================

type AnalysisStatus = 'completed' | 'limited' | 'review_recommended' | 'unavailable'

interface ResultState {
  status: AnalysisStatus
  message?: string
  model_output?: {
    prediction: 'TB' | 'Normal'
    score: number
    label_meaning: string
  }
  reliability_flags?: Array<{
    flag: string
    ok: boolean
    note?: string
  }>
  review_reasons?: string[]
  limitations?: string[]
  imageName?: string
  symptoms?: Record<string, unknown>
  gradcam_heatmap?: string | null
}

// ============================================================
// STATUS CONFIG
// ============================================================

const statusConfig: Record<AnalysisStatus, { icon: React.ReactNode; label: string; colour: string; bg: string }> = {
  completed: {
    icon: <CheckCircle2 size={24} />,
    label: 'Analysis Completed',
    colour: 'var(--result-success)',
    bg: 'rgba(74,222,128,0.07)',
  },
  limited: {
    icon: <Info size={24} />,
    label: 'Analysis Limited',
    colour: 'var(--result-caution)',
    bg: 'rgba(251,191,36,0.07)',
  },
  review_recommended: {
    icon: <AlertTriangle size={24} />,
    label: 'Review Recommended',
    colour: 'var(--result-review)',
    bg: 'rgba(251,113,133,0.07)',
  },
  unavailable: {
    icon: <XCircle size={24} />,
    label: 'Unable to Assess',
    colour: 'var(--result-neutral)',
    bg: 'rgba(152,162,179,0.07)',
  },
}

// ============================================================
// RESULTS PAGE
// ============================================================

export const ResultsPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as ResultState | null
  const { setReport } = useReport()

  // Share report with the global ChatBot for context-aware answers
  useEffect(() => {
    if (state) {
      setReport({
        status: state.status,
        prediction: state.model_output?.prediction,
        score: state.model_output?.score,
        message: state.message,
        limitations: state.limitations,
        review_reasons: state.review_reasons,
      })
    }
    // Clear report context when leaving the results page
    return () => setReport(null)
  }, [state, setReport])

  // If no state, show error
  if (!state) {
    return (
      <div
        className="min-h-screen pt-24 pb-16 flex items-center justify-center"
        style={{ background: 'var(--bg-base)' }}
      >
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

  const status = state.status || 'unavailable'
  const config = statusConfig[status]

  return (
    <div
      className="min-h-screen pt-24 pb-16"
      style={{ background: 'var(--bg-base)' }}
    >
      <div className="fixed inset-0 grid-bg opacity-20 pointer-events-none" />

      <div className="container relative z-10 max-w-3xl">
        {/* Back */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft size={14} />}
            onClick={() => navigate('/dashboard')}
          >
            Back to dashboard
          </Button>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.5 }}
          className="mb-8"
        >
          <span
            className="text-xs font-mono uppercase tracking-widest mb-2 block"
            style={{ color: 'var(--text-subtle)' }}
          >
            Analysis Results
          </span>
          <h1
            className="text-3xl md:text-4xl font-bold"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}
          >
            Screening{' '}
            <span className="gradient-text">Report</span>
          </h1>
          {state.imageName && (
            <p className="text-sm mt-2 font-mono" style={{ color: 'var(--text-muted)' }}>
              File: {state.imageName}
            </p>
          )}
        </motion.div>

        {/* Status banner */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="flex items-start gap-4 p-6 rounded-2xl mb-6"
          style={{ background: config.bg, border: `1px solid ${config.colour}30` }}
        >
          <span style={{ color: config.colour }}>{config.icon}</span>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2
                className="text-lg font-semibold"
                style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}
              >
                {config.label}
              </h2>
              <span className="status-chip status-chip-muted">
                <Clock size={10} />
                {new Date().toLocaleTimeString()}
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {state.message ||
                (status === 'unavailable'
                  ? 'The AI model is not currently configured. No prediction was generated. This is the expected honest behaviour until the model is verified and integrated.'
                  : 'Analysis complete.')}
            </p>
          </div>
        </motion.div>

        {/* Model output — shown when inference ran (completed or review_recommended) */}
        {(status === 'completed' || status === 'review_recommended') && state.model_output && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="glass-card rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Brain size={16} style={{ color: 'var(--ember)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Screening Result
              </h3>
              <span className="status-chip status-chip-muted">Genuine inference result</span>
            </div>

            {/* Screening result banner — clear wording, not a diagnosis */}
            <div
              className="flex items-center gap-4 p-4 rounded-xl mb-4"
              style={{
                background:
                  state.model_output.prediction === 'TB'
                    ? 'rgba(251,113,133,0.08)'
                    : 'rgba(74,222,128,0.08)',
                border: `1px solid ${
                  state.model_output.prediction === 'TB'
                    ? 'rgba(251,113,133,0.25)'
                    : 'rgba(74,222,128,0.25)'
                }`,
              }}
            >
              <span style={{
                color: state.model_output.prediction === 'TB'
                  ? 'var(--result-review)'
                  : 'var(--result-success)',
                fontSize: 22,
              }}>
                {state.model_output.prediction === 'TB' ? '⚠️' : '✓'}
              </span>
              <div>
                <p className="font-semibold text-sm" style={{
                  color: state.model_output.prediction === 'TB'
                    ? 'var(--result-review)'
                    : 'var(--result-success)',
                  fontFamily: 'var(--font-heading)',
                }}>
                  {state.model_output.prediction === 'TB'
                    ? 'TB Indicators Detected'
                    : 'No TB Indicators Detected'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>
                  This is a screening result only — not a diagnosis
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div
                className="p-4 rounded-xl text-center"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
              >
                <p className="text-xs mb-2 font-mono" style={{ color: 'var(--text-subtle)' }}>
                  TB-Indicator Score
                </p>
                <p
                  className="text-2xl font-bold font-mono"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {(state.model_output.score * 100).toFixed(1)}%
                </p>
              </div>
              <div
                className="p-4 rounded-xl text-center"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
              >
                <p className="text-xs mb-2 font-mono" style={{ color: 'var(--text-subtle)' }}>
                  Decision Threshold
                </p>
                <p
                  className="text-2xl font-bold font-mono"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {(((state.model_output as any).threshold ?? 0.5) * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            <div
              className="p-3 rounded-xl"
              style={{ background: 'rgba(255,107,74,0.05)', border: '1px solid rgba(255,107,74,0.12)' }}
            >
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>What this means: </strong>
                {state.model_output.label_meaning}
              </p>
            </div>

            <p className="text-xs mt-3" style={{ color: 'var(--text-subtle)' }}>
              This score is not a calibrated probability. A high score does not confirm TB;
              a low score does not rule it out. Professional assessment is required.
            </p>
          </motion.div>
        )}

        {/* Grad-CAM explainability — only shown when a genuine heatmap exists */}
        {state.gradcam_heatmap && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.5 }}
            className="glass-card rounded-2xl p-6 mb-6"
          >
            <div className="flex items-center gap-3 mb-3">
              <Brain size={16} style={{ color: 'var(--violet)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Model Attention Map
              </h3>
              <span className="status-chip status-chip-muted">Grad-CAM explanation</span>
            </div>

            <div
              className="rounded-xl overflow-hidden mb-3"
              style={{ border: '1px solid rgba(139,92,246,0.2)' }}
            >
              <img
                src={state.gradcam_heatmap}
                alt="Grad-CAM model attention map — conceptual explanation, not a clinical finding"
                style={{ width: '100%', display: 'block', borderRadius: 12 }}
              />
            </div>

            <div
              className="p-3 rounded-xl"
              style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}
            >
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>What this shows: </strong>
                Highlighted regions influenced the model's output most. This is a Grad-CAM
                visualisation generated from the actual model and your uploaded image.
                It is a model explanation tool — it does not identify disease,
                confirm a finding, or replace radiological assessment.
              </p>
            </div>
          </motion.div>
        )}

        {/* Model unavailable — explicit honest state */}
        {status === 'unavailable' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="glass-card rounded-2xl p-6 mb-6"
          >
            <div className="flex items-center gap-3 mb-3">
              <Brain size={16} style={{ color: 'var(--text-subtle)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Model Output
              </h3>
            </div>
            <div
              className="p-4 rounded-xl text-center"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
            >
              <XCircle size={32} className="mx-auto mb-3" style={{ color: 'var(--text-subtle)' }} />
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                Model not configured
              </p>
              <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                No prediction was generated. This is the expected honest behaviour — not a negative result.
              </p>
            </div>
          </motion.div>
        )}

        {/* Reliability flags */}
        {state.reliability_flags && state.reliability_flags.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="glass-card rounded-2xl p-6 mb-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <Shield size={16} style={{ color: 'var(--ember)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Reliability Checks
              </h3>
              <span className="status-chip status-chip-muted">Prototype rules</span>
            </div>
            <div className="space-y-2">
              {state.reliability_flags.map((flag) => (
                <div
                  key={flag.flag}
                  className="flex items-start gap-3 text-xs py-2 px-3 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                >
                  <span
                    style={{
                      color: flag.ok ? 'var(--result-success)' : 'var(--result-caution)',
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {flag.ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                  </span>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>{flag.flag}</span>
                    {flag.note && (
                      <span style={{ color: 'var(--text-subtle)' }}> — {flag.note}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Review reasons */}
        {state.review_reasons && state.review_reasons.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="rounded-2xl p-6 mb-6"
            style={{
              background: 'rgba(251,191,36,0.06)',
              border: '1px solid rgba(251,191,36,0.2)',
            }}
          >
            <h3
              className="text-sm font-semibold mb-3"
              style={{ color: 'var(--status-warning)', fontFamily: 'var(--font-heading)' }}
            >
              Why review was recommended
            </h3>
            <ul className="space-y-2">
              {state.review_reasons.map((reason) => (
                <li
                  key={reason}
                  className="flex gap-2 text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" style={{ color: 'var(--status-warning)' }} />
                  {reason}
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Next steps */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="glass-card rounded-2xl p-6 mb-6"
        >
          <h3
            className="text-sm font-semibold mb-4"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}
          >
            Responsible next steps
          </h3>
          <ul className="space-y-3">
            {[
              'Consult a qualified healthcare professional for interpretation of this screening result.',
              'Do not delay seeking medical care if you are experiencing symptoms.',
              'TB diagnosis requires sputum tests, clinical examination, and other investigations — not AI screening alone.',
              'If you are experiencing severe symptoms (difficulty breathing, significant blood in cough), seek emergency care immediately.',
            ].map((step) => (
              <li
                key={step}
                className="flex gap-3 text-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                <CheckCircle2
                  size={14}
                  className="shrink-0 mt-0.5"
                  style={{ color: 'var(--ember)' }}
                />
                {step}
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Safety disclaimer */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="flex gap-3 p-4 rounded-xl mb-8"
          style={{
            background: 'rgba(255,107,107,0.05)',
            border: '1px solid rgba(255,107,107,0.15)',
          }}
        >
          <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--status-danger)' }} />
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--status-danger)' }}>Important: </strong>
            This report is generated by a research prototype. It does not constitute a medical diagnosis.
            A model score — whether high or low — does not confirm or rule out tuberculosis.
            All results require appropriate professional interpretation.
          </p>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap gap-4"
        >
          <Button
            variant="primary"
            onClick={() => navigate('/screening')}
            icon={<Plus size={16} />}
          >
            New Screening
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate('/dashboard')}
          >
            Dashboard
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
