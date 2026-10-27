import React, { useRef, useCallback } from 'react'
import { motion } from 'framer-motion'

/* ─────────────────────────────────────────────────────────────
   GlassCard — Ember Noir glassmorphism card with:
   • Cursor-tracking spotlight (radial gradient, CSS vars)
   • 3D tilt on hover (Framer Motion, max 6deg)
   • Shimmer overlay
   • Ember / rose / default variants
   • prefers-reduced-motion safe
───────────────────────────────────────────────────────────── */

type GlassVariant = 'default' | 'elevated' | 'interactive' | 'ember' | 'rose' | 'success' | 'caution' | 'review'

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: GlassVariant
  tilt?: boolean
  spotlight?: boolean
  shimmer?: boolean
  className?: string
  children: React.ReactNode
}

const variantClass: Record<GlassVariant, string> = {
  default:     'glass-card',
  elevated:    'glass-card',
  interactive: 'glass-card glass-shimmer spotlight-card',
  ember:       'glass-ember spotlight-card',
  rose:        'glass-rose',
  success:     'glass-card glass-success',
  caution:     'glass-card glass-caution',
  review:      'glass-card glass-review',
}

export function GlassCard({
  variant = 'default',
  tilt = false,
  spotlight = false,
  shimmer = false,
  className = '',
  children,
  style,
  ...props
}: GlassCardProps) {
  const ref = useRef<HTMLDivElement>(null)

  /* ── Cursor spotlight ──────────────────────────────────────── */
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    ref.current.style.setProperty('--mx', `${x}%`)
    ref.current.style.setProperty('--my', `${y}%`)
  }, [])

  const cl = [
    variantClass[variant],
    spotlight ? 'spotlight-card' : '',
    shimmer ? 'glass-shimmer' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <motion.div
      ref={ref}
      className={cl}
      onMouseMove={spotlight ? onMouseMove : undefined}
      whileHover={tilt ? { rotateX: 3, rotateY: 3, scale: 1.01 } : undefined}
      style={{
        perspective: tilt ? 1000 : undefined,
        transformStyle: tilt ? 'preserve-3d' : undefined,
        willChange: 'transform',
        ...style,
      }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

/* ─────────────────────────────────────────────────────────────
   GlassPanel — wider section-level glass surface
───────────────────────────────────────────────────────────── */
interface GlassPanelProps {
  className?: string
  children: React.ReactNode
  style?: React.CSSProperties
}

export function GlassPanel({ className = '', children, style }: GlassPanelProps) {
  return (
    <div
      className={`glass-panel ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   GlassNav — floating glass navbar surface
───────────────────────────────────────────────────────────── */
interface GlassNavProps {
  className?: string
  children: React.ReactNode
  style?: React.CSSProperties
}

export function GlassNav({ className = '', children, style }: GlassNavProps) {
  return (
    <div
      className={`glass-nav ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}
