import React from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, CheckCircle2, Info, ArrowRight,
  BookOpen, Database, Cpu, Shield,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { GlassCard } from '../components/ui/Glass'

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] } }),
}

export const AboutPage: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen pt-24 pb-16" style={{ background: 'var(--bg-base)' }}>
      <div className="fixed orb orb-ember pointer-events-none" style={{ width: 600, height: 600, top: '-10%', right: '-15%', opacity: 0.10 }} />
      <div className="fixed orb orb-rose pointer-events-none"  style={{ width: 420, height: 420, bottom: '10%', left: '-10%', opacity: 0.08 }} />

      <div className="container relative z-10 max-w-3xl">

        {/* Header */}
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible" className="mb-10">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ember)', marginBottom: 6, display: 'block' }}>About</span>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(1.8rem,4vw,2.75rem)', letterSpacing: '-0.03em', marginBottom: 8 }}>
            About SwasthyaScan AI &{' '}
            <span className="gradient-text">Limitations</span>
          </h1>
          <p style={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--text-muted)', maxWidth: 520 }}>
            Understanding what SwasthyaScan AI is, how it works, and where its current limitations lie is as important as the tool itself.
          </p>
        </motion.div>

        {/* Project overview */}
        <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible" className="mb-5">
          <GlassCard className="rounded-[var(--r-lg)] p-6">
            <div className="flex items-center gap-3 mb-4">
              <BookOpen size={16} style={{ color: 'var(--ember)' }} />
              <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Project Overview</h2>
            </div>
            <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-muted)' }}>
              SwasthyaScan AI is a <strong style={{ color: 'var(--text-primary)' }}>reliability-aware tuberculosis screening support prototype</strong> for TB screening support research.
            </p>
            <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-muted)' }}>
              The central idea: a screening system should not present every prediction as equally reliable. It should identify limitations, communicate uncertainty responsibly, and recommend professional review when available evidence is insufficient or conflicting.
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              This is <em>not</em> a clinically validated medical device. It is a research prototype demonstrating how honest AI workflows can be implemented in healthcare screening support.
            </p>
          </GlassCard>
        </motion.div>

        {/* Technical architecture */}
        <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible" className="mb-5">
          <GlassCard className="rounded-[var(--r-lg)] p-6">
            <div className="flex items-center gap-3 mb-5">
              <Cpu size={16} style={{ color: 'var(--ember)' }} />
              <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Technical Architecture</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { label: 'Frontend', items: ['React + Vite + TypeScript', 'Tailwind CSS (Ember Noir)', 'Framer Motion animations', 'Scroll-driven image sequence'] },
                { label: 'Backend',  items: ['Python + FastAPI', 'Pydantic validation', 'Pillow image processing', 'PyTorch + DenseNet121'] },
                { label: 'Model',    items: ['DenseNet121 (fine-tuned)', 'NLM Shenzhen + Kaggle TB datasets', 'Binary TB/Normal classification', 'Grad-CAM explainability (planned)'] },
                { label: 'Reliability Engine', items: ['Separate testable module', 'Image quality validation', 'Conflicting evidence detection', 'Four-state result handling'] },
              ].map(section => (
                <div key={section.label} style={{ background: 'rgba(255,107,74,0.05)', border: '1px solid rgba(255,107,74,0.12)', borderRadius: 12, padding: 14 }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--ember)', marginBottom: 10 }}>{section.label}</p>
                  <ul className="space-y-1.5">
                    {section.items.map(item => (
                      <li key={item} className="text-xs flex gap-2" style={{ color: 'var(--text-muted)' }}>
                        <span style={{ color: 'var(--ember)', opacity: 0.5 }}>””</span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>

        {/* Dataset information */}
        <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible" className="mb-5">
          <GlassCard className="rounded-[var(--r-lg)] p-6">
            <div className="flex items-center gap-3 mb-4">
              <Database size={16} style={{ color: 'var(--ember)' }} />
              <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Dataset Information</h2>
            </div>
            <div className="space-y-3">
              {[
                { name: 'Shenzhen Hospital CXR Set',            source: 'NLM / NIH',       role: 'Training & Validation', status: 'Pending verification' },
                { name: 'Montgomery County CXR Set',            source: 'NLM / NIH',       role: 'External test set only', status: 'Pending verification' },
                { name: 'TB Chest X-ray Dataset (tawsifurrahman)', source: 'Kaggle · CC BY 4.0', role: 'Training & Validation', status: 'Pending verification' },
              ].map(ds => (
                <div key={ds.name} style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.14)', borderRadius: 12, padding: 14 }}>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{ds.name}</p>
                    <span className="result-badge result-badge-limited">{ds.status}</span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Source: {ds.source} · Role: {ds.role}</p>
                </div>
              ))}
            </div>
            <p className="text-xs mt-4" style={{ color: 'var(--text-faint)' }}>Dataset verification and integrity checks will be completed before any model training begins. No datasets have been downloaded yet.</p>
          </GlassCard>
        </motion.div>

        {/* Known limitations */}
        <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible" className="mb-5">
          <GlassCard variant="caution" className="rounded-[var(--r-lg)] p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield size={16} style={{ color: 'var(--result-caution)' }} />
              <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Known Limitations</h2>
            </div>
            <div className="space-y-3">
              {[
                { title: 'Not clinically validated', body: 'This prototype has not been validated in clinical settings. Its performance on populations different from the training datasets is unknown.' },
                { title: 'Small public datasets', body: 'The NLM Shenzhen and Montgomery datasets are small (hundreds of images). Claims about generalisation to diverse populations cannot be made.' },
                { title: 'Model output is not a calibrated probability', body: 'The DenseNet121 score has not been calibrated. It cannot be interpreted as a clinical probability of having TB.' },
                { title: 'Reliability rules are experimental', body: 'All reliability thresholds are prototype rules without clinical validation. They are documented as experimental and clearly labelled.' },
                { title: 'No real-time model inference yet', body: 'The model has not yet been trained or integrated. The backend currently returns an honest "Unable to Assess" state.' },
                { title: 'Image quality detection is basic', body: 'Only fundamental image validity checks (format, dimensions, decodability) are implemented. Clinical-quality assessment is not.' },
              ].map(lim => (
                <div key={lim.title} className="flex gap-3 rounded-xl" style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.10)', padding: 14 }}>
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--result-caution)' }} />
                  <div>
                    <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{lim.title}</p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{lim.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>

        {/* Safety */}
        <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible" className="mb-8">
          <GlassCard className="rounded-[var(--r-lg)] p-6">
            <div className="flex items-center gap-3 mb-4">
              <Info size={16} style={{ color: 'var(--ember)' }} />
              <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Safety & Responsible Use</h2>
            </div>
            <ul className="space-y-3">
              {[
                'Always seek professional medical advice for TB symptoms or concerns.',
                'A low model score does NOT mean a person does not have TB.',
                'A high model score does NOT confirm TB.',
                'This tool cannot replace a doctor, radiologist, or laboratory test.',
                'Do not delay seeking medical care based on any output from this application.',
                'For severe symptoms (significant haemoptysis, breathing difficulty), seek emergency care immediately.',
              ].map(item => (
                <li key={item} className="flex gap-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--result-success)' }} />
                  {item}
                </li>
              ))}
            </ul>
          </GlassCard>
        </motion.div>

        {/* Actions */}
        <motion.div custom={6} variants={fadeUp} initial="hidden" animate="visible" className="flex flex-wrap gap-4">
          <Button variant="primary" onClick={() => navigate('/screening')} iconRight={<ArrowRight size={16} />}>Start Screening</Button>
          <Button variant="glass" onClick={() => navigate('/dashboard')}>Dashboard</Button>
        </motion.div>

      </div>
    </div>
  )
}

