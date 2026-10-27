/**
 * LandingPage.tsx ”” S3: 5-scene cinematic single-page experience
 *
 * Scenes:
 *  1. INTRO/HERO    ”” Lung video visible, headline, CTAs, status pill
 *  2. THE PROBLEM   ”” One headline, three glass cards with sourced stats
 *  3. CORE INNOVATION ”” 6 reliability checks in 3Ã—2 glass grid
 *  4. HOW IT WORKS  ”” 6-step interactive horizontal stepper + 4 honest result states
 *  5. RESPONSIBLE USE + CTA ”” It is / It is not panels + big CTA + footer line
 *
 * Scroll-snap: CSS scroll-snap-type: y proximity on the snap container
 * Progress dots: right-side, clickable, highlight active scene
 * Scene transitions: framer-motion, content fades/lifts on enter, stagger on exit
 * Navbar: all nav items scroll to scene anchors
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, Shield, Brain, AlertTriangle, Eye, Users,
  CheckCircle2, Info, Activity, Microscope,
  FileSearch, UserCheck, Zap, Lock,
  AlertCircle, ClipboardCheck, HelpCircle,
  ChevronRight, ChevronDown, XCircle,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { GlassCard, GlassPanel } from '../components/ui/Glass'
import { BackgroundVideo } from '../components/BackgroundVideo'

// ─── Constants ────────────────────────────────────────────────
const ease = [0.16, 1, 0.3, 1] as const

const SCENES = [
  { id: 'hero',        label: 'Intro'           },
  { id: 'problem',     label: 'The Problem'     },
  { id: 'innovation',  label: 'Core Innovation' },
  { id: 'workflow',    label: 'How It Works'    },
  { id: 'cta',         label: 'Get Started'     },
]

// ─── Scene enter animation variants ──────────────────────────
const sceneVariants = {
  hidden:  { opacity: 0, y: 32, filter: 'blur(4px)' },
  visible: { opacity: 1, y: 0,  filter: 'blur(0px)',
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1], staggerChildren: 0.08 } },
}
const itemVariants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0,  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
}

// ─── Scene content wrapper ────────────────────────────────────
function SceneContent({ children, className = '' }: {
  children: React.ReactNode; className?: string
}) {
  return (
    <motion.div
      className={className}
      variants={sceneVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: false, amount: 0.15 }}
    >
      {children}
    </motion.div>
  )
}

function Item({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <motion.div variants={itemVariants} className={className}>{children}</motion.div>
}

// ─── Section eyebrow chip ─────────────────────────────────────
function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontFamily: 'var(--font-mono)', fontSize: 'var(--text-mono)',
      letterSpacing: '0.10em', textTransform: 'uppercase',
      color: 'var(--ember)',
      background: 'rgba(255,107,74,0.09)',
      border: '1px solid rgba(255,107,74,0.22)',
      borderRadius: 999, padding: '5px 14px',
      marginBottom: 20, whiteSpace: 'nowrap',
    }}>
      {icon} {label}
    </span>
  )
}

// ─── Right-side progress dots ─────────────────────────────────
function ProgressDots({ active, onDotClick }: {
  active: number;
  onDotClick: (i: number) => void
}) {
  return (
    <div className="scene-dots" role="navigation" aria-label="Scene navigation">
      {SCENES.map((s, i) => (
        <button
          key={s.id}
          className={`scene-dot${active === i ? ' active' : ''}`}
          onClick={() => onDotClick(i)}
          aria-label={`Go to scene: ${s.label}`}
          title={s.label}
        />
      ))}
    </div>
  )
}

// ─── Live System Status Pill ──────────────────────────────────
function StatusPill() {
  const [status, setStatus] = useState<{
    backend: 'online' | 'offline' | 'loading'
    model: 'loaded' | 'not_loaded' | 'loading'
  }>({ backend: 'loading', model: 'loading' })

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const r = await fetch('http://localhost:8000/health', { signal: AbortSignal.timeout(3000) })
        if (cancelled) return
        if (r.ok) {
          const d = await r.json()
          setStatus({ backend: 'online', model: d.model_loaded ? 'loaded' : 'not_loaded' })
        } else { setStatus({ backend: 'offline', model: 'not_loaded' }) }
      } catch { if (!cancelled) setStatus({ backend: 'offline', model: 'not_loaded' }) }
    }
    check()
    const id = setInterval(check, 15000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const dot = (s: string) =>
    s === 'online' || s === 'loaded' ? 'status-dot status-dot-online' :
    s === 'loading'                  ? 'status-dot status-dot-loading' :
                                       'status-dot status-dot-offline'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.5, ease: [0.16,1,0.3,1] }}
    >
      <div style={{
        display: 'inline-flex', flexDirection: 'column', gap: 6,
        background: 'rgba(14,11,10,0.75)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 'var(--r-md)',
        padding: '12px 18px',
      }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 2 }}>
          Live System Status
        </p>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span className={dot(status.backend)} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Backend{' '}
              <span style={{ color: status.backend === 'online' ? 'var(--result-success)' :
                status.backend === 'loading' ? 'var(--result-caution)' : 'var(--result-review)' }}>
                {status.backend === 'loading' ? 'checking”¦' : status.backend}
              </span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span className={dot(status.model)} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Model{' '}
              <span style={{ color: status.model === 'loaded' ? 'var(--result-success)' :
                status.model === 'loading' ? 'var(--result-caution)' : 'var(--result-review)' }}>
                {status.model === 'loading' ? 'checking”¦' : status.model === 'loaded' ? 'loaded' : 'not loaded'}
              </span>
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SCENE 1 ”” INTRO / HERO
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function SceneHero({ onNext }: { onNext: () => void }) {
  const navigate = useNavigate()
  return (
    <div className="snap-scene" id="hero">
      {/* Text-readability gradient on left ”” lungs visible on right */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'linear-gradient(108deg, rgba(10,8,7,0.96) 0%, rgba(10,8,7,0.88) 36%, rgba(10,8,7,0.55) 62%, rgba(10,8,7,0.12) 85%, transparent 100%)',
        zIndex: 0,
      }} />

      <div className="container relative" style={{ zIndex: 1, width: '100%' }}>
        <div style={{ maxWidth: 660 }}>
          <SceneContent>


            {/* H1 ”” 12ch max â†’ 2 clean lines */}
            <Item>
              <h1 style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 'clamp(2.75rem, 1.6rem + 4.6vw, 5.5rem)',
                lineHeight: 1.08,
                letterSpacing: '-0.02em',
                color: 'var(--text-primary)',
                marginBottom: 24,
                maxWidth: '12ch',
              }}>
                Every Breath Matters.{' '}
                <span className="gradient-text">Every Second Counts.</span>
              </h1>
            </Item>

            {/* Subline ”” one sentence */}
            <Item>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'clamp(1.0625rem, 1rem + 0.3vw, 1.25rem)',
                color: 'var(--text-secondary)',
                lineHeight: 1.65,
                maxWidth: 500,
                marginBottom: 36,
              }}>
                SwasthyaScan AI doesn't just predict — it reports what it knows,
                what it doesn't, and when a clinician must decide.
              </p>
            </Item>

            {/* CTAs */}
            <Item>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 36 }}>
                <Button variant="primary" size="lg"
                  iconRight={<ArrowRight size={16} />}
                  onClick={() => navigate('/screening')}
                >
                  Start Screening
                </Button>
                <Button variant="glass" size="lg" onClick={onNext}>
                  How It Works
                </Button>
              </div>
            </Item>

            {/* Status pill */}
            <Item>
              <StatusPill />
            </Item>
          </SceneContent>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.button
        onClick={onNext}
        aria-label="Scroll to next scene"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          zIndex: 2, color: 'var(--text-faint)',
          background: 'none', border: 'none', cursor: 'pointer', padding: 8,
        }}
      >
        <ChevronDown size={22} />
      </motion.button>

      {/* Disclaimer ”” absolute bottom, centred, never overlapping content */}
      <p className="disclaimer-notice" style={{
        position: 'absolute', bottom: 8, width: '100%', textAlign: 'center', zIndex: 2,
        paddingInline: 'clamp(20px, 5vw, 96px)',
        fontSize: '0.72rem',
      }}>
        <><AlertTriangle size={13} style={{ display: 'inline', verticalAlign: 'text-top', marginRight: 6, color: 'var(--result-caution)' }} />Research prototype only &mdash; not a clinically validated medical device. Requires professional interpretation.</>
      </p>
    </div>
  )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SCENE 2 ”” THE PROBLEM
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const PROBLEMS = [
  {
    icon: <AlertTriangle size={22} style={{ color: 'var(--result-review)' }} />,
    title: 'Overconfident predictions',
    body: 'A model can return a low TB-probability score while the patient presents classic symptoms. Without reliability context, that score creates dangerous false reassurance.',
  },
  {
    icon: <Eye size={22} style={{ color: 'var(--result-caution)' }} />,
    title: 'Hidden limitations',
    body: 'Most screening tools don\'t surface image quality issues, missing clinical data, uncertain confidence, or conflicting signals — they just show a number.',
  },
  {
    icon: <Users size={22} style={{ color: 'var(--ember)' }} />,
    title: 'Replaced oversight',
    body: 'Without explicit "Review Recommended" flags, automated predictions can bypass the clinical judgement that catches edge cases and rare presentations.',
  },
]

function SceneProblem() {
  return (
    <div className="snap-scene" id="problem" style={{ background: 'rgba(10,8,7,0.75)' }}>
      <div className="container" style={{ width: '100%', zIndex: 1, position: 'relative' }}>
        <SceneContent>
          <Item>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: 'clamp(2rem, 1.3rem + 2.8vw, 3.75rem)',
              lineHeight: 1.1, letterSpacing: '-0.025em',
              marginBottom: 16,
            }}>
              TB screening is{' '}
              <span className="gradient-text">not that simple.</span>
            </h2>
          </Item>
          <Item>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'clamp(1.0625rem, 1rem + 0.3vw, 1.25rem)',
              color: 'var(--text-secondary)', lineHeight: 1.65,
              maxWidth: 560, marginBottom: 40,
            }}>
              AI can help — but a prediction without reliability context
              can mislead as much as it helps.
            </p>
          </Item>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
            gap: 'clamp(16px, 2.5vw, 28px)',
          }}>
            {PROBLEMS.map((p, i) => (
              <Item key={i}>
                <GlassCard variant="interactive" spotlight tilt
                  className="rounded-[var(--r-lg)] h-full"
                  style={{ padding: 'clamp(20px, 2.5vw, 32px)' }}
                >
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 18,
                  }}>
                    {p.icon}
                  </div>
                  <h3 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(1.125rem, 1.05rem + 0.3vw, 1.375rem)',
                    fontWeight: 700, letterSpacing: '-0.015em', marginBottom: 10,
                  }}>
                    {p.title}
                  </h3>
                  <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.65 }}>
                    {p.body}
                  </p>
                </GlassCard>
              </Item>
            ))}
          </div>
        </SceneContent>
      </div>
    </div>
  )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SCENE 3 ”” CORE INNOVATION
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const CHECKS = [
  { icon: <Shield size={18} />,      label: 'Image Quality',      body: 'Automated scoring rejects unreadable or artefact-heavy X-rays before any inference runs.' },
  { icon: <Microscope size={18} />,  label: 'Model Confidence',   body: 'Raw confidence scores reported honestly — never rounded to binary positive/negative.' },
  { icon: <Brain size={18} />,       label: 'Symptom Cross-check', body: 'Clinical symptom data compared against model output; conflicts are explicitly flagged.' },
  { icon: <FileSearch size={18} />,  label: 'Input Completeness',  body: 'Missing or contradictory inputs produce "Analysis Limited" — not a forced prediction.' },
  { icon: <Activity size={18} />,    label: 'Uncertainty Bands',   body: 'Output uncertainty is surfaced as a range, not hidden inside a single percentage figure.' },
  { icon: <UserCheck size={18} />,   label: 'Review Escalation',   body: 'High-uncertainty or conflicting cases always recommend professional review before action.' },
]

function SceneInnovation() {
  return (
    <div className="snap-scene" id="innovation" style={{ background: 'rgba(10,8,7,0.82)' }}>
      <div className="container" style={{ width: '100%', zIndex: 1, position: 'relative' }}>
        <SceneContent>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', columnGap: 'clamp(16px,2vw,32px)', rowGap: 0 }}>
            {/* Left ”” heading */}
            <div style={{ gridColumn: 'span 12', marginBottom: 'clamp(28px,4vw,48px)' }}>
              <Item><Chip icon={<Zap size={11} />} label="Core Innovation" /></Item>
              <Item>
                <h2 style={{
                  fontFamily: 'var(--font-display)', fontWeight: 800,
                  fontSize: 'clamp(2rem, 1.3rem + 2.8vw, 3.75rem)',
                  lineHeight: 1.1, letterSpacing: '-0.025em',
                  marginBottom: 14, maxWidth: '22ch',
                }}>
                  Six checks before{' '}
                  <span className="gradient-text">any result.</span>
                </h2>
              </Item>
              <Item>
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'clamp(1.0625rem, 1rem + 0.3vw, 1.25rem)',
                  color: 'var(--text-secondary)', lineHeight: 1.65, maxWidth: 520,
                }}>
                  No result is presented without passing all applicable reliability gates.
                </p>
              </Item>
            </div>

            {/* 3Ã—2 grid of checks */}
            {CHECKS.map((c, i) => (
              <div key={i} style={{
                gridColumn: 'span 4',
                marginBottom: 'clamp(14px,2vw,24px)',
              }}>
                <Item>
                  <GlassCard className="rounded-[var(--r-md)] h-full"
                    style={{ padding: 'clamp(18px,2vw,28px)' }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: 'rgba(255,107,74,0.10)',
                      border: '1px solid rgba(255,107,74,0.18)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--ember)', marginBottom: 12, flexShrink: 0,
                    }}>
                      {c.icon}
                    </div>
                    <h3 style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'clamp(1.05rem, 1rem + 0.25vw, 1.25rem)',
                      fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 8,
                    }}>
                      {c.label}
                    </h3>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {c.body}
                    </p>
                  </GlassCard>
                </Item>
              </div>
            ))}
          </div>
        </SceneContent>
      </div>
    </div>
  )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SCENE 4 ”” HOW IT WORKS (horizontal stepper + result states)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const STEPS = [
  { n: '01', icon: <FileSearch size={18} />,    title: 'Upload X-ray',        body: 'Submit a chest X-ray (JPEG/PNG/DICOM). Image quality is scored immediately — unreadable scans are rejected cleanly.' },
  { n: '02', icon: <ClipboardCheck size={18} />, title: 'Enter Symptoms',      body: 'Provide clinical data: cough duration, fever, weight loss, contact history. Missing fields produce an honest "incomplete" result.' },
  { n: '03', icon: <Activity size={18} />,       title: 'Quality Gate',        body: 'Six automated quality checks run before model inference. Low-quality inputs exit early with an "Unable to Assess" result.' },
  { n: '04', icon: <Brain size={18} />,          title: 'Model Inference',     body: 'TB probability estimated. Raw confidence preserved — no silent rounding or thresholding.' },
  { n: '05', icon: <Shield size={18} />,         title: 'Reliability Engine',  body: 'Confidence bands, symptom match, uncertainty, and completeness checks run after inference.' },
  { n: '06', icon: <UserCheck size={18} />,      title: 'Structured Result',   body: 'One of four honest result states returned with full reliability breakdown and next-step guidance.' },
]

const RESULT_STATES = [
  { cls: 'result-badge result-badge-completed', icon: <CheckCircle2 size={12} />, label: 'Analysis Completed',   color: 'var(--result-success)' },
  { cls: 'result-badge result-badge-limited',   icon: <AlertTriangle size={12} />, label: 'Analysis Limited',     color: 'var(--result-caution)' },
  { cls: 'result-badge result-badge-review',    icon: <Eye size={12} />,           label: 'Review Recommended',   color: 'var(--result-review)'  },
  { cls: 'result-badge result-badge-neutral',   icon: <HelpCircle size={12} />,    label: 'Unable to Assess',     color: 'var(--result-neutral)' },
]

function SceneWorkflow() {
  const [activeStep, setActiveStep] = useState(0)

  // Auto-advance every 2.5 s
  useEffect(() => {
    const id = setInterval(() => setActiveStep(s => (s + 1) % STEPS.length), 2500)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="snap-scene" id="workflow" style={{ background: 'rgba(10,8,7,0.80)' }}>
      <div className="container" style={{ width: '100%', zIndex: 1, position: 'relative' }}>
        <SceneContent>
          <Item style={{ textAlign: 'center', marginBottom: 'clamp(24px,4vw,44px)' }}>
            <Chip icon={<Activity size={11} />} label="How It Works" />
            <h2 style={{
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: 'clamp(2rem, 1.3rem + 2.8vw, 3.75rem)',
              lineHeight: 1.1, letterSpacing: '-0.025em',
            }}>
              Six steps. <span className="gradient-text">One honest result.</span>
            </h2>
          </Item>

          {/* Horizontal stepper */}
          <Item>
            <div style={{ position: 'relative', marginBottom: 'clamp(20px,3vw,36px)' }}>
              {/* Step pills */}
              <div style={{ display: 'flex', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
                {STEPS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveStep(i)}
                    style={{
                      flex: '1 1 0', minWidth: 80,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      padding: '10px 8px', cursor: 'pointer',
                      background: 'none', border: 'none',
                      position: 'relative',
                    }}
                    aria-pressed={activeStep === i}
                    aria-label={`Step ${s.n}: ${s.title}`}
                  >
                    {/* Connector line */}
                    {i < STEPS.length - 1 && (
                      <div style={{
                        position: 'absolute', top: 22, left: '50%', width: '100%',
                        height: 2,
                        background: i < activeStep
                          ? 'var(--grad-brand)'
                          : 'rgba(255,255,255,0.10)',
                        transition: 'background 0.5s',
                        zIndex: 0,
                      }} />
                    )}
                    {/* Icon circle */}
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%', zIndex: 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: activeStep === i
                        ? 'var(--grad-brand)'
                        : i < activeStep
                          ? 'rgba(255,107,74,0.25)'
                          : 'rgba(255,255,255,0.06)',
                      border: activeStep === i
                        ? 'none'
                        : '1px solid rgba(255,255,255,0.10)',
                      color: activeStep === i ? '#fff' : 'var(--text-muted)',
                      transition: 'all 0.4s var(--ease-out-expo)',
                      boxShadow: activeStep === i
                        ? '0 0 20px rgba(255,107,74,0.35)'
                        : 'none',
                    }}>
                      {s.icon}
                    </div>
                    {/* Step number label */}
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      color: activeStep === i ? 'var(--ember)' : 'var(--text-faint)',
                      transition: 'color 0.3s',
                    }}>
                      {s.n}
                    </span>
                  </button>
                ))}
              </div>

              {/* Active step detail card */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35, ease: [0.16,1,0.3,1] }}
                >
                  <GlassCard style={{
                    padding: 'clamp(18px,2.5vw,28px)',
                    borderRadius: 'var(--r-lg)',
                    minHeight: 96,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                        background: 'rgba(255,107,74,0.10)',
                        border: '1px solid rgba(255,107,74,0.20)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--ember)',
                      }}>
                        {STEPS[activeStep].icon}
                      </div>
                      <div>
                        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700,
                          fontSize: '1.0625rem', marginBottom: 6 }}>
                          {STEPS[activeStep].n} — {STEPS[activeStep].title}
                        </p>
                        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-secondary)',
                          fontSize: '0.9375rem', lineHeight: 1.65 }}>
                          {STEPS[activeStep].body}
                        </p>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              </AnimatePresence>
            </div>
          </Item>

          {/* 4 result state badges */}
          <Item>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
              {RESULT_STATES.map((r, i) => (
                <span key={i} className={r.cls} style={{ fontSize: '0.8125rem' }}>
                  {r.icon} {r.label}
                </span>
              ))}
            </div>
          </Item>
        </SceneContent>
      </div>
    </div>
  )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SCENE 5 ”” RESPONSIBLE USE + CTA
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const IS_ITEMS = [
  'A reliability-aware screening support prototype',
  'A research demonstration',
  'A tool that tells you when it\'s uncertain',
  'Designed for clinician-in-the-loop workflows',
]
const IS_NOT_ITEMS = [
  'A clinically validated medical device',
  'A replacement for a radiologist or clinician',
  'A diagnostic tool for real patients',
  'Ready for deployment in clinical settings',
]

function SceneCTA() {
  const navigate = useNavigate()
  return (
    <div className="snap-scene" id="cta" style={{ background: 'rgba(10,8,7,0.85)' }}>
      <div className="container" style={{ width: '100%', zIndex: 1, position: 'relative' }}>
        <SceneContent>
          <Item style={{ textAlign: 'center', marginBottom: 'clamp(20px,3vw,36px)' }}>
            <Chip icon={<Lock size={11} />} label="Responsible Use" />
            <h2 style={{
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: 'clamp(2rem, 1.3rem + 2.8vw, 3.75rem)',
              lineHeight: 1.1, letterSpacing: '-0.025em',
            }}>
              What it is.{' '}
              <span className="gradient-text">What it is not.</span>
            </h2>
          </Item>

          {/* Two glass panels side-by-side */}
          <Item>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
              gap: 'clamp(14px,2vw,24px)',
              marginBottom: 'clamp(24px,3.5vw,40px)',
            }}>
              {/* It IS */}
              <GlassCard variant="success" style={{ padding: 'clamp(20px,2.5vw,32px)', borderRadius: 'var(--r-lg)' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: 'var(--result-success)', marginBottom: 16 }}>
                  <><CheckCircle2 size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> IT IS</>
                </p>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, listStyle: 'none' }}>
                  {IS_ITEMS.map((item, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <CheckCircle2 size={15} style={{ color: 'var(--result-success)', flexShrink: 0, marginTop: 2 }} />
                      <span style={{ fontFamily: 'var(--font-body)', color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.55 }}>
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </GlassCard>

              {/* It is NOT */}
              <GlassCard variant="review" style={{ padding: 'clamp(20px,2.5vw,32px)', borderRadius: 'var(--r-lg)' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: 'var(--result-review)', marginBottom: 16 }}>
                  <><XCircle size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> IT IS NOT</>
                </p>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, listStyle: 'none' }}>
                  {IS_NOT_ITEMS.map((item, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <AlertCircle size={15} style={{ color: 'var(--result-review)', flexShrink: 0, marginTop: 2 }} />
                      <span style={{ fontFamily: 'var(--font-body)', color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.55 }}>
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </GlassCard>
            </div>
          </Item>

          {/* Big CTA button */}
          <Item style={{ textAlign: 'center' }}>
            <Button variant="primary" size="lg"
              iconRight={<ArrowRight size={18} />}
              onClick={() => navigate('/screening')}
              style={{ fontSize: '1.0625rem', padding: '16px 44px', minHeight: 60 }}
            >
              Start Screening
            </Button>
          </Item>

          {/* One-line footer */}
          <Item>
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
              color: 'var(--text-faint)', textAlign: 'center', marginTop: 20,
              letterSpacing: '0.05em', lineHeight: 1.6,
            }}>
              <span style={{ color: 'var(--result-review)', opacity: 0.8 }}>
                <><AlertTriangle size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }} />Not a medical device &mdash; for research only</>
              </span>
            </p>
          </Item>
        </SceneContent>
      </div>
    </div>
  )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ROOT PAGE COMPONENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export function LandingPage() {
  const [activeScene, setActiveScene] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const scenesRef = useRef<HTMLDivElement[]>([])

  /* ── Track active scene via IntersectionObserver ─────────── */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (e.isIntersecting && e.intersectionRatio >= 0.45) {
            const idx = SCENES.findIndex(s => s.id === e.target.id)
            if (idx !== -1) setActiveScene(idx)
          }
        })
      },
      { threshold: 0.45, root: containerRef.current }
    )
    const scenes = containerRef.current?.querySelectorAll('[id]')
    scenes?.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  /* ── Scroll to scene by index ────────────────────────────── */
  const scrollToScene = useCallback((i: number) => {
    const id = SCENES[i]?.id
    if (!id) return
    const el = containerRef.current?.querySelector(`#${id}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <>
      {/* Fixed lung video ”” plays behind everything */}
      <BackgroundVideo scrimBase={0.22} scrimMax={0.65} />

      {/* Right-side progress dots */}
      <ProgressDots active={activeScene} onDotClick={scrollToScene} />

      {/* Scroll-snap container */}
      <div
        ref={containerRef}
        className="snap-container"
        style={{ position: 'relative' }}
      >
        <SceneHero onNext={() => scrollToScene(1)} />
        <SceneProblem />
        <SceneInnovation />
        <SceneWorkflow />
        <SceneCTA />
      </div>
    </>
  )
}

