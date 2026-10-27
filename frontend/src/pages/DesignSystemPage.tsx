import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Zap, Heart, Shield, Eye, Lock, Users, Activity,
  AlertTriangle, CheckCircle, Info, Star, ArrowRight,
} from 'lucide-react'
import { GlassCard, GlassPanel } from '../components/ui/Glass'
import { Button } from '../components/ui/Button'
import { Input, Textarea } from '../components/ui/Input'

/* ─────────────────────────────────────────────────────────────
   /design-system ”” D1 preview page (hidden from main nav)
   Shows all tokens, glass variants, buttons, inputs, badges
───────────────────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-20">
      <div className="flex items-center gap-4 mb-8">
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-h3)',
          letterSpacing: '-0.025em',
          color: 'var(--text-primary)',
        }}>
          {title}
        </h2>
        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
      </div>
      {children}
    </section>
  )
}

function Swatch({ label, value, style }: { label: string; value: string; style: React.CSSProperties }) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="h-14 rounded-xl border"
        style={{ background: style.background || value, borderColor: 'rgba(255,255,255,0.08)' }}
      />
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-faint)' }}>{value}</div>
    </div>
  )
}

export function DesignSystemPage() {
  const [inputVal, setInputVal] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleLoadingDemo = () => {
    setLoading(true)
    setTimeout(() => { setLoading(false); setSuccess(true) }, 1800)
    setTimeout(() => setSuccess(false), 3200)
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh', paddingTop: 100 }}>
      {/* Ambient orbs */}
      <div className="orb orb-ember" style={{ width: 600, height: 600, top: -200, right: -100, opacity: 0.18, position: 'fixed', zIndex: 0 }} />
      <div className="orb orb-rose" style={{ width: 500, height: 500, bottom: 200, left: -150, opacity: 0.14, position: 'fixed', zIndex: 0 }} />

      <div className="container" style={{ position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <motion.div
          className="mb-16 text-center"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="section-label"><Star size={10} /> Design System</span>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
            letterSpacing: '-0.03em',
            marginBottom: 16,
          }}>
            Ember Noir{' '}
            <span className="gradient-text">D1 Preview</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-body-lg)' }}>
            Hidden page ”” development preview only. Not linked from any nav.
          </p>
        </motion.div>

        {/* ── Colour Tokens ─────────────────────────────────────── */}
        <Section title="Colour Tokens">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            <Swatch label="--bg-base" value="#0A0807" style={{}} />
            <Swatch label="--bg-raised" value="#141010" style={{}} />
            <Swatch label="--bg-elevated" value="#1C1715" style={{}} />
            <Swatch label="--ember" value="#FF6B4A" style={{}} />
            <Swatch label="--rose" value="#FF4D6D" style={{}} />
            <Swatch label="--magenta" value="#E040A0" style={{}} />
            <Swatch label="--peach" value="#FFC2A8" style={{}} />
            <Swatch label="Brand gradient" value="110deg, #FF8A5B â†’ #E040A0"
              style={{ background: 'linear-gradient(110deg, #FF8A5B 0%, #FF4D6D 55%, #E040A0 100%)' }} />
            <Swatch label="--result-success" value="#4ADE80" style={{}} />
            <Swatch label="--result-caution" value="#FBBF24" style={{}} />
            <Swatch label="--result-review" value="#FB7185" style={{}} />
            <Swatch label="--result-neutral" value="#E5E7EB" style={{}} />
          </div>
        </Section>

        {/* ── Typography ────────────────────────────────────────── */}
        <Section title="Typography">
          <div className="space-y-6">
            <div>
              <p className="label-mono mb-2">Display / Hero ”” Bricolage Grotesque 800</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(3rem,8vw,7rem)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                Screening you <span className="gradient-text">can question.</span>
              </p>
            </div>
            <div>
              <p className="label-mono mb-2">H2 ”” Bricolage Grotesque 700</p>
              <h2>How SwasthyaScan AI works</h2>
            </div>
            <div>
              <p className="label-mono mb-2">Body ”” Inter 400/500/600</p>
              <p style={{ color: 'var(--text-secondary)', maxWidth: 600 }}>
                SwasthyaScan AI is a reliability-aware TB screening prototype.
                It doesn't just predict ”” it tells you what it knows, what it doesn't, and when a professional is needed.
              </p>
            </div>
            <div>
              <p className="label-mono mb-2">Mono ”” JetBrains Mono</p>
              <p className="font-mono" style={{ color: 'var(--ember)', fontSize: '0.875rem' }}>
                ANALYSIS_COMPLETED · CONFIDENCE 0.873 · RELIABILITY OK
              </p>
            </div>
          </div>
        </Section>

        {/* ── Glass Variants ────────────────────────────────────── */}
        <Section title="Glass Variants">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { label: 'default', desc: 'Standard glass card' },
              { label: 'ember' as const, desc: 'Ember-tinted interactive' },
              { label: 'rose' as const, desc: 'Rose-tinted surface' },
              { label: 'success' as const, desc: 'Success state glass' },
              { label: 'caution' as const, desc: 'Caution state glass' },
              { label: 'review' as const, desc: 'Review state glass' },
            ].map(({ label, desc }) => (
              <GlassCard
                key={label}
                variant={label as any}
                spotlight
                tilt
                className="rounded-[var(--r-lg)] p-6"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'rgba(255,255,255,0.07)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Zap size={18} style={{ color: 'var(--ember)' }} />
                  </div>
                  <div>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--ember)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      .glass-{label}
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{desc}</p>
                  </div>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  Hover to see 3D tilt + cursor spotlight tracking.
                </p>
              </GlassCard>
            ))}
          </div>
        </Section>

        {/* ── Buttons ───────────────────────────────────────────── */}
        <Section title="Buttons">
          <div className="flex flex-wrap gap-4 mb-8">
            <Button variant="primary">Start Screening</Button>
            <Button variant="primary" iconRight={<ArrowRight size={14} />}>See How It Works</Button>
            <Button variant="glass">Glass Button</Button>
            <Button variant="ghost">Ghost Button</Button>
            <Button variant="danger">Delete</Button>
          </div>

          <div className="flex flex-wrap gap-4 mb-8">
            <Button variant="primary" size="sm">Small</Button>
            <Button variant="primary" size="md">Medium</Button>
            <Button variant="primary" size="lg">Large</Button>
          </div>

          <div className="flex flex-wrap gap-4">
            <Button
              variant="primary"
              loading={loading}
              success={success}
              onClick={handleLoadingDemo}
            >
              {success ? 'Submitted!' : loading ? 'Analysing”¦' : 'Run Loading Demo'}
            </Button>
            <Button variant="primary" disabled>Disabled</Button>
          </div>
        </Section>

        {/* ── Inputs ────────────────────────────────────────────── */}
        <Section title="Form Inputs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
            <Input
              label="Patient identifier"
              placeholder=""
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              hint="Enter a study ID or reference number"
              valid={inputVal.length > 3}
              error={inputVal.length === 1 ? 'Too short' : undefined}
            />
            <Input label="Email address" type="email" placeholder="" />
            <Textarea label="Clinical notes" rows={3} placeholder="" hint="Optional notes for doctor review" />
          </div>
        </Section>

        {/* ── Result Badges ─────────────────────────────────────── */}
        <Section title="Result State Badges">
          <div className="flex flex-wrap gap-4 mb-6">
            <span className="result-badge result-badge-completed">
              <CheckCircle size={11} /> Analysis Completed
            </span>
            <span className="result-badge result-badge-limited">
              <AlertTriangle size={11} /> Analysis Limited
            </span>
            <span className="result-badge result-badge-review">
              <Eye size={11} /> Review Recommended
            </span>
            <span className="result-badge result-badge-neutral">
              <Info size={11} /> Unable to Assess
            </span>
          </div>
          <p className="label-mono">Result states differ by icon, colour chip, AND label ”” never colour alone</p>
        </Section>

        {/* ── Status Dots ───────────────────────────────────────── */}
        <Section title="Status Indicators">
          <div className="flex flex-wrap gap-8">
            {[
              { label: 'Backend online', cls: 'status-dot-online' },
              { label: 'Offline / error', cls: 'status-dot-offline' },
              { label: 'Starting / loading', cls: 'status-dot-loading' },
            ].map(({ label, cls }) => (
              <div key={label} className="flex items-center gap-2">
                <span className={`status-dot ${cls}`} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Skeleton ──────────────────────────────────────────── */}
        <Section title="Skeleton Loaders">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl">
            <div className="skeleton h-24 rounded-[var(--r-md)]" />
            <div className="skeleton h-24 rounded-[var(--r-md)]" />
            <div className="skeleton h-24 rounded-[var(--r-md)]" />
            <div className="skeleton h-6 rounded-full col-span-2" />
            <div className="skeleton h-6 rounded-full" />
          </div>
        </Section>

        {/* ── GlassPanel ────────────────────────────────────────── */}
        <Section title="Glass Panel">
          <GlassPanel className="rounded-[var(--r-lg)] p-8">
            <div className="grid md:grid-cols-3 gap-6">
              {[Heart, Shield, Activity].map((Icon, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: 'rgba(255,107,74,0.10)',
                    border: '1px solid rgba(255,107,74,0.18)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon size={20} style={{ color: 'var(--ember)' }} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                      Feature {i + 1}
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      GlassPanel content area ”” full-width translucent surface.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>
        </Section>

        {/* ── Easing ────────────────────────────────────────────── */}
        <Section title="Easing Tokens">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: '--ease-out-expo', val: 'cubic-bezier(0.16,1,0.3,1)' },
              { name: '--ease-spring', val: 'cubic-bezier(0.34,1.56,0.64,1)' },
              { name: '--ease-out-quart', val: 'cubic-bezier(0.25,1,0.5,1)' },
              { name: '--ease-in-expo', val: 'cubic-bezier(0.7,0,0.84,0)' },
            ].map(({ name, val }) => (
              <GlassCard key={name} className="rounded-[var(--r-md)] p-4">
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--ember)', marginBottom: 4 }}>{name}</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)' }}>{val}</p>
              </GlassCard>
            ))}
          </div>
        </Section>

        {/* Footer disclaimer */}
        <div className="pb-20 text-center">
          <p className="disclaimer-notice">
            DESIGN SYSTEM PREVIEW ”” DEVELOPMENT ONLY ”” NOT LINKED FROM PRODUCTION NAV
          </p>
        </div>

      </div>
    </div>
  )
}

