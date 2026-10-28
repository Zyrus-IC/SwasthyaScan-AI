/**
 * ScreeningPage.tsx ”” S4 Redesign
 *
 * Layout: two-column (4/12 stepper + 8/12 panel)
 * Background: same fixed lung video (BackgroundVideo), heavy warm-black scrim
 * Step 1: large animated dropzone, preview with file info
 * Step 2: symptom pill toggles + duration input
 * Step 3: review + submit
 *
 * API calls, validation, disclaimers ”” ALL UNTOUCHED from original.
 */
import React, { useCallback, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Upload, X, AlertTriangle, Info, ChevronRight,
  ImageIcon, CheckCircle2, Loader2, Eye, ZoomIn,
  Sun, Contrast, RotateCcw, FileCheck,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { BackgroundVideo } from '../components/BackgroundVideo'

// ─── Constants (from original, kept identical) ─────────────────
const MAX_FILE_SIZE_MB = 10
const ALLOWED_TYPES    = ['image/jpeg', 'image/jpg', 'image/png']

// ─── Types (identical to original) ────────────────────────────
interface SymptomData {
  persistentCough: boolean
  fever:           boolean
  nightSweats:     boolean
  weightLoss:      boolean
  fatigue:         boolean
  hemoptysis:      boolean
  coughDuration:   string
  additionalNotes: string
}

interface FormState {
  imageFile:    File | null
  imagePreview: string | null
  imageError:   string | null
  symptoms:     SymptomData
  consent:      boolean
}

// ─── File validation (identical to original) ──────────────────
function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `Unsupported file type "${file.type}". Please upload a JPEG or PNG image.`
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return `File size (${(file.size / 1024 / 1024).toFixed(1)} MB) exceeds the ${MAX_FILE_SIZE_MB} MB limit.`
  }
  return null
}

// ─── Animation helpers ─────────────────────────────────────────
const ease = [0.16, 1, 0.3, 1] as const
const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: (delay = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1], delay },
  }),
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// LEFT STEPPER
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const STEPS = [
  { n: 1, label: 'Upload X-ray',     sub: 'JPEG or PNG, max 10 MB'     },
  { n: 2, label: 'Symptoms',         sub: 'Clinical context (optional)' },
  { n: 3, label: 'Review & Submit',  sub: 'Verify and send'             },
]

function VerticalStepper({ current }: { current: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {STEPS.map((s, i) => {
        const done    = current > s.n
        const active  = current === s.n
        return (
          <div key={s.n} style={{ display: 'flex', gap: 16, position: 'relative' }}>
            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div style={{
                position: 'absolute', left: 19, top: 40, width: 2, height: 'calc(100% - 8px)',
                background: done
                  ? 'var(--grad-brand)'
                  : 'rgba(255,255,255,0.08)',
                transition: 'background 0.5s',
              }} />
            )}

            {/* Icon circle */}
            <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: active
                ? 'var(--grad-brand)'
                : done
                  ? 'rgba(255,107,74,0.22)'
                  : 'rgba(255,255,255,0.06)',
              border: active
                ? 'none'
                : done
                  ? '1px solid rgba(255,107,74,0.30)'
                  : '1px solid rgba(255,255,255,0.10)',
              color: active || done ? '#fff' : 'var(--text-faint)',
              boxShadow: active ? '0 0 18px rgba(255,107,74,0.35)' : 'none',
              transition: 'all 0.4s var(--ease-out-expo)',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.875rem',
              zIndex: 1,
            }}>
              {done ? <CheckCircle2 size={16} /> : s.n}
            </div>

            {/* Labels */}
            <div style={{ paddingBottom: i < STEPS.length - 1 ? 32 : 0, paddingTop: 6 }}>
              <p style={{
                fontFamily: 'var(--font-display)', fontWeight: 700,
                fontSize: '0.9375rem', letterSpacing: '-0.01em',
                color: active ? 'var(--text-primary)' : done ? 'var(--text-secondary)' : 'var(--text-faint)',
                transition: 'color 0.3s', lineHeight: 1.2,
              }}>
                {s.label}
              </p>
              <p style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
                color: 'var(--text-faint)', letterSpacing: '0.04em', marginTop: 3,
              }}>
                {s.sub}
              </p>
            </div>
          </div>
        )
      })}

      {/* Privacy note */}
      <div style={{
        marginTop: 40,
        padding: '14px 16px',
        background: 'rgba(255,107,74,0.06)',
        border: '1px solid rgba(255,107,74,0.14)',
        borderRadius: 'var(--r-sm)',
      }}>
        <p style={{
          fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
          color: 'var(--text-muted)', lineHeight: 1.6,
        }}>
          <><AlertTriangle size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6, color: 'var(--result-caution)' }} />AI-assisted screening support. No data is stored. Results require professional interpretation.</>
        </p>
      </div>
    </div>
  )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// STEP 1 ”” UPLOAD DROPZONE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
interface UploadZoneProps {
  imageFile:    File | null
  imagePreview: string | null
  imageError:   string | null
  onFile:   (file: File) => void
  onRemove: () => void
  onNext:   () => void
}

function StepUpload({ imageFile, imagePreview, imageError, onFile, onRemove, onNext }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false)
  const [brightness, setBrightness] = useState(100)
  const [contrast,   setContrast]   = useState(100)
  const imgRef = useRef<HTMLImageElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]; if (file) onFile(file)
  }, [onFile])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) onFile(file); e.target.value = ''
  }

  const resetViewer = () => { setBrightness(100); setContrast(100) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <p style={{
          fontFamily: 'var(--font-display)', fontWeight: 700,
          fontSize: 'clamp(1.125rem, 1rem + 0.5vw, 1.375rem)',
          letterSpacing: '-0.01em', marginBottom: 6,
        }}>
          Upload Chest X-ray <span style={{ color: 'var(--result-review)' }}>*</span>
        </p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
          JPEG · PNG · Max {MAX_FILE_SIZE_MB} MB · PA or AP view recommended
        </p>
      </div>

      {!imageFile ? (
        /* ── Empty dropzone ─────────────────────────────── */
        <motion.label
          htmlFor="xray-upload"
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          animate={{ borderColor: dragOver ? 'rgba(255,107,74,0.65)' : 'rgba(255,255,255,0.14)' }}
          style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            minHeight: 300,
            cursor: 'pointer',
            background: dragOver
              ? 'rgba(255,107,74,0.06)'
              : 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(24px)',
            border: '2px dashed rgba(255,255,255,0.14)',
            borderRadius: 'var(--r-lg)',
            gap: 14,
            transition: 'background 0.25s, border-color 0.25s, box-shadow 0.25s',
            boxShadow: dragOver
              ? '0 0 40px rgba(255,107,74,0.18), 0 24px 64px rgba(0,0,0,0.55)'
              : '0 16px 48px rgba(0,0,0,0.45)',
          }}
          whileHover={{ scale: 1.008 }}
          transition={{ duration: 0.2 }}
        >
          {/* Animated upload icon */}
          <motion.div
            animate={{ y: dragOver ? -6 : 0 }}
            transition={{ duration: 0.3, ease: [0.16,1,0.3,1] }}
            style={{
              width: 72, height: 72, borderRadius: 20,
              background: dragOver
                ? 'var(--grad-brand)'
                : 'rgba(255,107,74,0.10)',
              border: '1px solid rgba(255,107,74,0.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: dragOver ? '#fff' : 'var(--ember)',
              boxShadow: dragOver ? '0 0 32px rgba(255,107,74,0.35)' : 'none',
              transition: 'background 0.25s, box-shadow 0.25s',
            }}
          >
            <Upload size={28} />
          </motion.div>

          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: '1.0625rem', marginBottom: 4 }}>
              {dragOver ? 'Drop to upload' : 'Drag & drop a chest X-ray'}
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              or click to{' '}
              <span style={{ color: 'var(--ember)', fontWeight: 600 }}>browse files</span>
            </p>
          </div>

          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'var(--text-faint)',
            padding: '4px 14px',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 999,
          }}>
            JPEG · PNG · Max {MAX_FILE_SIZE_MB} MB
          </span>

          <input
            id="xray-upload"
            type="file"
            accept=".jpg,.jpeg,.png"
            className="sr-only"
            onChange={handleFileChange}
            aria-label="Upload chest X-ray image"
          />
        </motion.label>
      ) : (
        /* ── Preview after file selected ────────────────── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Image display */}
          <div style={{
            background: 'rgba(0,0,0,0.65)',
            borderRadius: 'var(--r-lg)',
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.08)',
            minHeight: 240,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            {imagePreview && (
              <img
                ref={imgRef}
                src={imagePreview}
                alt="Uploaded chest X-ray ”” view only, not for diagnosis"
                style={{
                  maxHeight: 280, maxWidth: '100%',
                  objectFit: 'contain', display: 'block',
                  filter: `brightness(${brightness}%) contrast(${contrast}%)`,
                  transition: 'filter 0.15s',
                }}
              />
            )}
            {/* View-only badge */}
            <span style={{
              position: 'absolute', top: 10, right: 10,
              fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
              letterSpacing: '0.10em', textTransform: 'uppercase',
              background: 'rgba(0,0,0,0.75)', color: 'var(--text-muted)',
              padding: '3px 10px', borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              View only
            </span>
          </div>

          {/* Brightness/Contrast viewer controls ”” view only, does NOT change submission */}
          <div style={{
            padding: '14px 16px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 'var(--r-sm)',
          }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem',
              color: 'var(--text-faint)', textTransform: 'uppercase',
              letterSpacing: '0.08em', marginBottom: 10 }}>
              <Eye size={10} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
              Viewer controls ”” does not alter the submitted file
            </p>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 120 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem',
                  color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Sun size={10} /> Brightness {brightness}%
                </span>
                <input type="range" min={40} max={200} value={brightness}
                  onChange={e => setBrightness(Number(e.target.value))}
                  style={{ accentColor: 'var(--ember)', width: '100%' }}
                  aria-label="Adjust brightness for viewing only"
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 120 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem',
                  color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Contrast size={10} /> Contrast {contrast}%
                </span>
                <input type="range" min={40} max={200} value={contrast}
                  onChange={e => setContrast(Number(e.target.value))}
                  style={{ accentColor: 'var(--ember)', width: '100%' }}
                  aria-label="Adjust contrast for viewing only"
                />
              </label>
              <button onClick={resetViewer}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-faint)', display: 'flex', alignItems: 'center',
                  gap: 5, fontFamily: 'var(--font-mono)', fontSize: '0.68rem',
                  padding: '4px 0', alignSelf: 'flex-end',
                }}
                aria-label="Reset viewer to defaults"
              >
                <RotateCcw size={10} /> Reset
              </button>
            </div>
          </div>

          {/* File metadata */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 'var(--r-sm)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ImageIcon size={16} style={{ color: 'var(--ember)', flexShrink: 0 }} />
              <div>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600,
                  fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  {imageFile.name}
                </p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  {(imageFile.size / 1024 / 1024).toFixed(2)} MB · {imageFile.type.replace('image/', '').toUpperCase()}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <label htmlFor="xray-replace"
                style={{
                  cursor: 'pointer', padding: '6px 12px',
                  fontFamily: 'var(--font-mono)', fontSize: '0.68rem',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  color: 'var(--text-muted)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 'var(--r-sm)',
                }}
              >
                Replace
                <input id="xray-replace" type="file" accept=".jpg,.jpeg,.png"
                  className="sr-only" onChange={handleFileChange} aria-label="Replace image" />
              </label>
              <button onClick={onRemove}
                style={{
                  padding: '6px 10px', background: 'rgba(251,113,133,0.10)',
                  border: '1px solid rgba(251,113,133,0.20)',
                  borderRadius: 'var(--r-sm)', cursor: 'pointer', color: 'var(--result-review)',
                }}
                aria-label="Remove image"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File error */}
      <AnimatePresence>
        {imageError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{
              display: 'flex', gap: 10, padding: '12px 14px',
              background: 'rgba(251,113,133,0.08)',
              border: '1px solid rgba(251,113,133,0.22)',
              borderRadius: 'var(--r-sm)',
            }}
          >
            <AlertTriangle size={14} style={{ color: 'var(--result-review)', flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--result-review)' }}>
              {imageError}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Next step */}
      {imageFile && !imageError && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <Button variant="primary" size="lg" onClick={onNext}
            iconRight={<ChevronRight size={16} />}
            style={{ width: '100%' }}
          >
            Continue to Symptoms
          </Button>
        </motion.div>
      )}
    </div>
  )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// STEP 2 ”” SYMPTOMS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const SYMPTOM_LIST = [
  { id: 'persistentCough' as const, label: 'Persistent cough',            sub: '2+ weeks'        },
  { id: 'fever'           as const, label: 'Unexplained fever',           sub: 'Low-grade, evenings' },
  { id: 'nightSweats'     as const, label: 'Night sweats',                sub: 'Drenching sleep sweats' },
  { id: 'weightLoss'      as const, label: 'Unintentional weight loss',   sub: 'No known cause'  },
  { id: 'fatigue'         as const, label: 'Fatigue & malaise',           sub: 'Persistent tiredness' },
  { id: 'hemoptysis'      as const, label: 'Blood in sputum',             sub: 'Seek care promptly'   },
]

interface StepSymptomsProps {
  symptoms: SymptomData
  onChange: (id: keyof SymptomData, value: boolean | string) => void
  onNext: () => void
  onBack: () => void
}

function StepSymptoms({ symptoms, onChange, onNext, onBack }: StepSymptomsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700,
          fontSize: 'clamp(1.125rem, 1rem + 0.5vw, 1.375rem)',
          letterSpacing: '-0.01em', marginBottom: 6 }}>
          Clinical Symptoms
        </p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
          color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
          Select any currently present or recently experienced. Symptoms provide context ”” not proof of TB.
        </p>
      </div>

      {/* Pill toggles */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {SYMPTOM_LIST.map((s) => {
          const on = symptoms[s.id]
          return (
            <motion.button
              key={s.id}
              onClick={() => onChange(s.id, !on)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: '10px 18px',
                borderRadius: 'var(--r-pill)',
                background: on
                  ? 'linear-gradient(110deg, rgba(255,138,91,0.22), rgba(255,77,109,0.18))'
                  : 'rgba(255,255,255,0.05)',
                border: on
                  ? '1px solid rgba(255,107,74,0.40)'
                  : '1px solid rgba(255,255,255,0.10)',
                color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
                textAlign: 'left',
                minHeight: 56,
                boxShadow: on ? '0 0 20px rgba(255,107,74,0.12)' : 'none',
                transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
              }}
              role="checkbox"
              aria-checked={on}
              aria-label={s.label}
            >
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                {on && <CheckCircle2 size={13} style={{ color: 'var(--ember)' }} />}
                {s.label}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: on ? 'rgba(250,246,244,0.60)' : 'var(--text-faint)' }}>
                {s.sub}
              </span>
            </motion.button>
          )
        })}
      </div>

      {/* Cough duration ”” only if cough selected */}
      <AnimatePresence>
        {symptoms.persistentCough && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <label htmlFor="cough-duration" style={{
              display: 'block', fontFamily: 'var(--font-body)', fontWeight: 600,
              fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: 8,
            }}>
              Cough duration <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
            </label>
            <input
              id="cough-duration"
              type="text"
              placeholder="e.g. 3 weeks, 2 months"
              value={symptoms.coughDuration}
              onChange={e => onChange('coughDuration', e.target.value)}
              style={{
                width: '100%', padding: '12px 16px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 'var(--r-sm)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-body)', fontSize: '0.9375rem',
                outline: 'none', transition: 'border-color 0.2s',
                minHeight: 48,
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(255,107,74,0.45)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.10)'}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Additional notes */}
      <div>
        <label htmlFor="additional-notes" style={{
          display: 'block', fontFamily: 'var(--font-body)', fontWeight: 600,
          fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: 8,
        }}>
          Additional notes <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
        </label>
        <textarea
          id="additional-notes"
          rows={3}
          placeholder="Any other relevant clinical information..."
          value={symptoms.additionalNotes}
          onChange={e => onChange('additionalNotes', e.target.value)}
          style={{
            width: '100%', padding: '12px 16px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 'var(--r-sm)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-body)', fontSize: '0.9375rem',
            outline: 'none', resize: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => e.target.style.borderColor = 'rgba(255,107,74,0.45)'}
          onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.10)'}
        />
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 12 }}>
        <Button variant="glass" size="lg" onClick={onBack} style={{ flex: 1 }}>
          â† Back
        </Button>
        <Button variant="primary" size="lg" onClick={onNext}
          iconRight={<ChevronRight size={16} />} style={{ flex: 2 }}>
          Review & Submit
        </Button>
      </div>
    </div>
  )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// STEP 3 ”” REVIEW & SUBMIT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
interface StepReviewProps {
  form:        FormState
  submitting:  boolean
  submitError: string | null
  onBack:      () => void
  onSubmit:    (e: React.FormEvent) => void
  onConsent:   (v: boolean) => void
}

function StepReview({ form, submitting, submitError, onBack, onSubmit, onConsent }: StepReviewProps) {
  const selectedSymptoms = SYMPTOM_LIST.filter(s => form.symptoms[s.id])
  const isValid = form.imageFile !== null && form.consent && !form.imageError

  return (
    <form onSubmit={onSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700,
          fontSize: 'clamp(1.125rem, 1rem + 0.5vw, 1.375rem)',
          letterSpacing: '-0.01em', marginBottom: 6 }}>
          Review & Submit
        </p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
          color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
          Confirm the details below before submitting for analysis.
        </p>
      </div>

      {/* Summary */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 'var(--r-md)',
        overflow: 'hidden',
      }}>
        {/* Image row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <FileCheck size={16} style={{ color: 'var(--ember)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.875rem' }}>
              {form.imageFile?.name}
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {form.imageFile && (form.imageFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'var(--result-success)',
            padding: '3px 10px', borderRadius: 999,
            background: 'rgba(74,222,128,0.10)',
            border: '1px solid rgba(74,222,128,0.20)',
          }}>
            Ready
          </span>
        </div>

        {/* Symptoms row */}
        <div style={{ padding: '14px 18px' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'var(--text-faint)', marginBottom: 10 }}>
            Symptoms selected ({selectedSymptoms.length})
          </p>
          {selectedSymptoms.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              None selected ”” result may be marked "Analysis Limited"
            </p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {selectedSymptoms.map(s => (
                <span key={s.id} style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
                  padding: '4px 12px', borderRadius: 999,
                  background: 'rgba(255,107,74,0.10)',
                  border: '1px solid rgba(255,107,74,0.22)',
                  color: 'var(--ember)',
                }}>
                  {s.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Consent */}
      <label style={{
        display: 'flex', alignItems: 'flex-start', gap: 14, cursor: 'pointer',
        padding: '16px 18px',
        background: form.consent ? 'rgba(255,107,74,0.05)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${form.consent ? 'rgba(255,107,74,0.25)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 'var(--r-sm)',
        transition: 'background 0.2s, border-color 0.2s',
      }}>
        <input
          type="checkbox"
          checked={form.consent}
          onChange={e => onConsent(e.target.checked)}
          style={{ accentColor: 'var(--ember)', width: 18, height: 18, flexShrink: 0, marginTop: 1 }}
          aria-label="Acknowledge AI screening support disclaimer"
        />
        <div>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600,
            fontSize: '0.875rem', marginBottom: 4 }}>
            I understand this is an AI screening support tool{' '}
            <span style={{ color: 'var(--result-review)' }}>*</span>
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8125rem',
            color: 'var(--text-muted)', lineHeight: 1.6 }}>
            SwasthyaScan AI does not diagnose TB. The uploaded image and responses are
            processed locally for this session only and are not stored. I will seek
            professional interpretation for any result this application provides.
          </p>
        </div>
      </label>

      {/* Submit error */}
      <AnimatePresence>
        {submitError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{
              display: 'flex', gap: 10, padding: '12px 14px',
              background: 'rgba(251,113,133,0.08)',
              border: '1px solid rgba(251,113,133,0.22)',
              borderRadius: 'var(--r-sm)',
            }}
          >
            <AlertTriangle size={14} style={{ color: 'var(--result-review)', flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--result-review)' }}>
              {submitError}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 12 }}>
        <Button variant="glass" size="lg" onClick={onBack} type="button" style={{ flex: 1 }}>
          â† Back
        </Button>
        <Button
          variant="primary" size="lg" type="submit"
          disabled={!isValid}
          loading={submitting}
          iconRight={submitting ? undefined : <ChevronRight size={16} />}
          style={{ flex: 2 }}
        >
          {submitting ? 'Analysing”¦' : 'Run Analysis'}
        </Button>
      </div>

      {/* Model note */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <Info size={12} style={{ color: 'var(--text-faint)', flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem',
          color: 'var(--text-faint)', lineHeight: 1.6 }}>
          If the AI model is not yet configured, the backend will return an honest
          "Unable to Assess" result ”” this is expected behaviour until the model is verified.
        </p>
      </div>
    </form>
  )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MAIN PAGE (all API/validation logic from original ”” untouched)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export const ScreeningPage: React.FC = () => {
  const navigate   = useNavigate()
  const [step, setStep] = useState(1)
  const [submitting,  setSubmitting]  = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({
    imageFile: null, imagePreview: null, imageError: null,
    symptoms: {
      persistentCough: false, fever: false, nightSweats: false,
      weightLoss: false, fatigue: false, hemoptysis: false,
      coughDuration: '', additionalNotes: '',
    },
    consent: false,
  })

  /* ── File handler ”” identical to original ─────────────────── */
  const handleFile = useCallback((file: File) => {
    const error = validateFile(file)
    if (error) {
      setForm(f => ({ ...f, imageFile: null, imagePreview: null, imageError: error }))
      return
    }
    const reader = new FileReader()
    reader.onload = e => {
      setForm(f => ({
        ...f,
        imageFile: file,
        imagePreview: e.target?.result as string,
        imageError: null,
      }))
    }
    reader.readAsDataURL(file)
  }, [])

  const handleRemoveImage = () =>
    setForm(f => ({ ...f, imageFile: null, imagePreview: null, imageError: null }))

  const handleSymptom = (id: keyof SymptomData, value: boolean | string) =>
    setForm(f => ({ ...f, symptoms: { ...f.symptoms, [id]: value } }))

  /* ── Submit ”” identical to original ──────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.imageFile || !form.consent || form.imageError) return
    setSubmitting(true); setSubmitError(null)

    try {
      const formData = new FormData()
      formData.append('image', form.imageFile!)
      formData.append('symptoms', JSON.stringify(form.symptoms))

      let response: Response | null = null
      try {
        response = await fetch('/api/screening/analyze', {
          method: 'POST', body: formData,
          signal: AbortSignal.timeout(30000),
        })
      } catch {
        navigate('/results', {
          state: {
            status: 'unavailable',
            message: 'The backend service is not currently available. No analysis was performed.',
            symptoms: form.symptoms,
            imageName: form.imageFile!.name,
          },
        })
        return
      }

      if (response && response.ok) {
        const data = await response.json()
        navigate('/results', { state: data })
      } else if (response) {
        const err = await response.json().catch(() => ({ detail: 'Unexpected error from server.' }))
        setSubmitError(err.detail || 'Server returned an error. Please try again.')
      }
    } catch {
      setSubmitError('Something went wrong. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <>
      {/* Lung video ”” heavy scrim for form readability, no blur on video */}
      <BackgroundVideo scrimBase={0.78} scrimMax={0.88} />

      <div style={{
        minHeight: '100dvh',
        paddingTop: 'calc(var(--navbar-h) + 32px)',
        paddingBottom: 64,
        position: 'relative', zIndex: 1,
      }}>
        {/* Faint grid overlay ”” decorative depth behind form */}
        <div aria-hidden="true" style={{
          position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }} />

        <div className="container" style={{ position: 'relative', zIndex: 1, maxWidth: 1100 }}>
          {/* Page heading */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16,1,0.3,1] }}
            style={{ marginBottom: 40 }}
          >
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 'var(--text-mono)',
              letterSpacing: '0.10em', textTransform: 'uppercase',
              color: 'var(--ember)', display: 'block', marginBottom: 8,
            }}>
              New Screening
            </span>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: 'clamp(1.75rem, 1.3rem + 1.8vw, 2.75rem)',
              lineHeight: 1.1, letterSpacing: '-0.02em',
            }}>
              TB Screening{' '}
              <span className="gradient-text">Input Form</span>
            </h1>
          </motion.div>

          {/* Two-column layout */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'clamp(200px, 28%, 320px) 1fr',
            gap: 'clamp(24px, 4vw, 56px)',
            alignItems: 'start',
          }}>
            {/* Left: vertical stepper */}
            <motion.div
              initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1, duration: 0.55, ease: [0.16,1,0.3,1] }}
              style={{
                position: 'sticky', top: 'calc(var(--navbar-h) + 24px)',
              }}
            >
              <VerticalStepper current={step} />
            </motion.div>

            {/* Right: step panel */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.55, ease: [0.16,1,0.3,1] }}
            >
              <div style={{
                background: 'rgba(14,11,10,0.82)',
                backdropFilter: 'blur(32px) saturate(160%)',
                WebkitBackdropFilter: 'blur(32px) saturate(160%)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderTop: '1px solid rgba(255,255,255,0.13)',
                borderRadius: 'var(--r-lg)',
                padding: 'clamp(24px, 3.5vw, 44px)',
                boxShadow: '0 2px 0 rgba(255,255,255,0.08) inset, 0 40px 100px rgba(0,0,0,0.75)',
              }}>
                <AnimatePresence mode="wait">
                  {step === 1 && (
                    <motion.div key="step1"
                      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.35, ease: [0.16,1,0.3,1] }}
                    >
                      <StepUpload
                        imageFile={form.imageFile}
                        imagePreview={form.imagePreview}
                        imageError={form.imageError}
                        onFile={handleFile}
                        onRemove={handleRemoveImage}
                        onNext={() => setStep(2)}
                      />
                    </motion.div>
                  )}
                  {step === 2 && (
                    <motion.div key="step2"
                      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.35, ease: [0.16,1,0.3,1] }}
                    >
                      <StepSymptoms
                        symptoms={form.symptoms}
                        onChange={handleSymptom}
                        onNext={() => setStep(3)}
                        onBack={() => setStep(1)}
                      />
                    </motion.div>
                  )}
                  {step === 3 && (
                    <motion.div key="step3"
                      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.35, ease: [0.16,1,0.3,1] }}
                    >
                      <StepReview
                        form={form}
                        submitting={submitting}
                        submitError={submitError}
                        onBack={() => setStep(2)}
                        onSubmit={handleSubmit}
                        onConsent={v => setForm(f => ({ ...f, consent: v }))}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  )
}

