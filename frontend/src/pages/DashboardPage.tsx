import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Activity, Shield, Brain, AlertTriangle,
  Clock, Info, ArrowRight, Server, Zap,
  CheckCircle, XCircle, Loader,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { GlassCard } from '../components/ui/Glass'

const ease = [0.16, 1, 0.3, 1]
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.55, ease } }),
}

// ── Real system status ──────────────────────────────────────
type StatusKind = 'ok' | 'warn' | 'err' | 'loading'

const STATUS: Record<StatusKind, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  ok:      { color: 'var(--result-success)', bg: 'rgba(74,222,128,0.08)',   icon: <CheckCircle size={11} />, label: 'ONLINE'     },
  warn:    { color: 'var(--result-caution)', bg: 'rgba(251,191,36,0.08)',   icon: <Loader size={11} />,      label: 'STARTING”¦'  },
  err:     { color: 'var(--result-review)',  bg: 'rgba(251,113,133,0.08)',  icon: <XCircle size={11} />,     label: 'OFFLINE'    },
  loading: { color: 'var(--ember)',          bg: 'rgba(255,107,74,0.08)',   icon: <Loader size={11} />,      label: 'CHECKING”¦'  },
}

function StatusBadge({ kind, text }: { kind: StatusKind; text?: string }) {
  const s = STATUS[kind]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
      letterSpacing: '0.12em', textTransform: 'uppercase',
      color: s.color, background: s.bg,
      padding: '3px 10px', borderRadius: 100,
      border: `1px solid ${s.color}33`,
    }}>
      {s.icon}{text ?? s.label}
    </span>
  )
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const [backendKind, setBackendKind] = useState<StatusKind>('loading')
  const [modelKind,   setModelKind]   = useState<StatusKind>('loading')

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const r = await fetch('/health', { signal: AbortSignal.timeout(3000) })
        if (cancelled) return
        if (r.ok) {
          const d = await r.json()
          setBackendKind('ok')
          setModelKind(d.model_loaded ? 'ok' : 'err')
        } else {
          setBackendKind('err'); setModelKind('err')
        }
      } catch { if (!cancelled) { setBackendKind('err'); setModelKind('err') } }
    }
    check()
    const id = setInterval(check, 15000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  return (
    <div className="min-h-screen pt-24 pb-20" style={{ background: 'var(--bg-base)' }}>
      {/* Ambient */}
      <div className="fixed orb orb-ember pointer-events-none" style={{ width: 600, height: 600, top: '-15%', right: '-12%', opacity: 0.12 }} />
      <div className="fixed orb orb-rose pointer-events-none"  style={{ width: 400, height: 400, bottom: '5%',  left: '-8%',  opacity: 0.09 }} />

      <div className="container relative" style={{ zIndex: 1 }}>

        {/* Header */}
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible" className="mb-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ember)', marginBottom: 6, display: 'block' }}>
                Dashboard
              </span>
              <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(1.8rem,3.5vw,2.75rem)', lineHeight: 1.1 }}>
                Welcome to{' '}
                <span className="gradient-text">SwasthyaScan AI</span>
              </h1>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 6 }}>
                Reliability-aware tuberculosis screening support ”” research prototype
              </p>
            </div>
            <Button variant="primary" size="md" onClick={() => navigate('/screening')} iconRight={<ArrowRight size={16} />}>
              New Screening
            </Button>
          </div>
        </motion.div>

        {/* Real System Status */}
        <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible">
          <GlassCard className="rounded-[var(--r-lg)] p-6 mb-5">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,107,74,0.08)', border: '1px solid rgba(255,107,74,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Server size={14} style={{ color: 'var(--ember)' }} />
              </div>
              <h2 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>Live System Status</h2>
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,rgba(255,107,74,0.18),transparent)', marginLeft: 8 }} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Backend',            kind: backendKind,  icon: <Server size={18} />, desc: 'FastAPI server'       },
                { label: 'Image Validation',   kind: 'ok' as const, icon: <Zap size={18} />,    desc: 'DICOM / PNG / JPG'   },
                { label: 'Reliability Engine', kind: 'ok' as const, icon: <Shield size={18} />,  desc: '6 reliability checks'},
                { label: 'AI Model',           kind: modelKind,    icon: <Brain size={18} />,   desc: 'Model inference'     },
              ].map(item => (
                <motion.div key={item.label} whileHover={{ y: -2 }} style={{
                  padding: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: STATUS[item.kind].bg, border: `1px solid ${STATUS[item.kind].color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: STATUS[item.kind].color }}>
                    {item.icon}
                  </div>
                  <div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>{item.label}</p>
                    <StatusBadge kind={item.kind} />
                  </div>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-faint)', marginTop: 'auto' }}>{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </motion.div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-3 gap-5 mb-5">
          {[
            { icon: <Plus size={22} />, title: 'Start New Screening', description: 'Upload a chest X-ray and complete the symptom questionnaire to begin a reliability-aware analysis.', action: () => navigate('/screening'), label: 'Begin', custom: 2 },
            { icon: <Brain size={22} />, title: 'How It Works', description: 'Explore the 6-step workflow: input validation, preprocessing, model inference, reliability checks, and more.', action: () => navigate('/#how-it-works'), label: 'Explore', custom: 3 },
            { icon: <Shield size={22} />, title: 'About & Limitations', description: "Understand what SwasthyaScan AI is and isn't. Read the documented limitations before using any results.", action: () => navigate('/about'), label: 'Read', custom: 4 },
          ].map(card => (
            <motion.div
              key={card.title}
              custom={card.custom}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              whileHover={{ y: -5 }}
              onClick={card.action}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && card.action()}
              style={{ cursor: 'pointer' }}
            >
              <GlassCard variant="interactive" spotlight className="rounded-[var(--r-lg)] p-6 h-full flex flex-col gap-3">
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,107,74,0.10)', border: '1px solid rgba(255,107,74,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ember)' }}>
                  {card.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: 8 }}>{card.title}</h3>
                  <p style={{ fontSize: '0.825rem', lineHeight: 1.65, color: 'var(--text-muted)' }}>{card.description}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600, color: 'var(--ember)' }}>
                  {card.label} <ArrowRight size={13} />
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Stats row */}
        <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible">
          <GlassCard className="rounded-[var(--r-lg)] p-5 mb-5">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-center">
              {[
                { v: '6',   l: 'Reliability checks', sub: 'Per session'      },
                { v: '4',   l: 'Honest result states',sub: 'No fake results'  },
                { v: '0',   l: 'Stored sessions',     sub: 'Ephemeral only'   },
              ].map((s, i) => (
                <div key={i}>
                  <p className="gradient-text" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(1.5rem,3vw,2rem)' }}>{s.v}</p>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{s.l}</p>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>{s.sub}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>

        {/* Recent Activity empty state */}
        <motion.div custom={6} variants={fadeUp} initial="hidden" animate="visible">
          <GlassCard className="rounded-[var(--r-lg)] p-6 mb-5">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,107,74,0.08)', border: '1px solid rgba(255,107,74,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={14} style={{ color: 'var(--ember)' }} />
              </div>
              <h2 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>Recent Activity</h2>
            </div>
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Activity size={26} style={{ color: 'rgba(255,255,255,0.18)' }} />
              </div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>No screenings yet</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-faint)', marginBottom: 20 }}>Start a new screening. No session data is stored by default.</p>
              <Button variant="glass" size="sm" onClick={() => navigate('/screening')} iconRight={<ArrowRight size={14} />}>
                Begin First Screening
              </Button>
            </div>
          </GlassCard>
        </motion.div>

        {/* Disclaimer */}
        <motion.div custom={7} variants={fadeUp} initial="hidden" animate="visible">
          <div style={{ display: 'flex', gap: 12, padding: '16px 20px', borderRadius: 14, background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)' }}>
            <AlertTriangle size={15} style={{ color: 'var(--result-caution)', flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--result-caution)', marginBottom: 4, letterSpacing: '0.06em' }}>RESEARCH PROTOTYPE ”” IMPORTANT SAFETY NOTICE</p>
              <p style={{ fontSize: '0.75rem', lineHeight: 1.65, color: 'var(--text-muted)' }}>
                SwasthyaScan AI is a research prototype, not a clinically validated medical device. It does not diagnose, confirm, or rule out tuberculosis. All results require professional interpretation. Do not delay seeking medical care based on any output from this application.
              </p>
            </div>
            <Info size={13} style={{ color: 'var(--text-faint)', flexShrink: 0, marginTop: 1 }} />
          </div>
        </motion.div>

      </div>
    </div>
  )
}

