/**
 * BackgroundVideo.tsx — Continuous lung video background
 *
 * - Fixed, full-viewport layer (z-index: -1)
 * - autoPlay muted loop playsInline, preload="auto"
 * - Poster: first frame from /frames/ folder
 * - Pauses when tab is hidden (visibilitychange)
 * - prefers-reduced-motion → poster only, no video
 * - Scroll-reactive: gentle scale 1→1.06, object-position shift ONLY
 *   NO blur — the lungs must stay crisp and visible at all times
 * - Falls back to Ember Noir gradient if video fails to load
 */
import React, { useEffect, useRef, useCallback } from 'react'
import { useScroll, useMotionValueEvent, useSpring, useTransform } from 'framer-motion'

/* ─── Reduced-motion check (run once) ────────────────────────── */
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ─── Poster: first frame ─────────────────────────────────────── */
const POSTER = '/frames/ezgif-frame-001.jpg'

/* ─── Ember Noir gradient fallback ───────────────────────────── */
function GradientFallback() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0, zIndex: -1,
        background: [
          'radial-gradient(ellipse 80% 90% at 70% 45%, rgba(255,107,74,0.18) 0%, transparent 60%)',
          'radial-gradient(ellipse 60% 70% at 80% 60%, rgba(255,77,109,0.12) 0%, transparent 55%)',
          '#0A0807',
        ].join(', '),
      }}
    />
  )
}

/* ─── Main component ─────────────────────────────────────────── */
interface BackgroundVideoProps {
  /** Scrim opacity at the very top (hero scene). Keep low — let lungs show. */
  scrimBase?: number
  /** Scrim opacity when deep in text-heavy scenes. */
  scrimMax?: number
}

export function BackgroundVideo({
  scrimBase = 0.25,   // LOW — lungs must be visible in the hero
  scrimMax  = 0.62,   // Higher only for text-heavy scenes below
}: BackgroundVideoProps) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const scrimRef   = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = React.useState(false)

  /* ── Pause on hidden tab ──────────────────────────────────── */
  useEffect(() => {
    const onVisibility = () => {
      if (!videoRef.current || prefersReducedMotion) return
      if (document.hidden) videoRef.current.pause()
      else videoRef.current.play().catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  /* ── Scroll-reactive: scale + object-position ONLY, NO blur ── */
  const { scrollYProgress } = useScroll()

  // Very gentle scale — just enough to feel alive
  const scaleRaw = useTransform(scrollYProgress, [0, 1], [1.0, 1.06])
  // Scrim gets darker as user scrolls into text-heavy scenes
  const scrimRaw = useTransform(scrollYProgress, [0, 0.7], [scrimBase, scrimMax])
  // Object-position: lungs shift gently from right-centre to centre
  const posRaw   = useTransform(scrollYProgress, [0, 1], [68, 52])

  const scale  = useSpring(scaleRaw, { stiffness: 50, damping: 22, mass: 1 })
  const scrimOp = useSpring(scrimRaw, { stiffness: 50, damping: 22, mass: 1 })
  const posX   = useSpring(posRaw,  { stiffness: 50, damping: 22, mass: 1 })

  useMotionValueEvent(scale, 'change', (v) => {
    if (!videoRef.current || prefersReducedMotion) return
    videoRef.current.style.transform = `scale(${v})`
  })

  // ── NO blur event handler — blur removed entirely ──────────

  useMotionValueEvent(posX, 'change', (v) => {
    if (!videoRef.current || prefersReducedMotion) return
    videoRef.current.style.objectPosition = `${v}% 50%`
  })

  useMotionValueEvent(scrimOp, 'change', (v) => {
    if (!scrimRef.current) return
    scrimRef.current.style.opacity = String(v)
  })

  /* ── Error fallback ──────────────────────────────────────── */
  const onError = useCallback(() => setFailed(true), [])
  if (failed) return <GradientFallback />

  /* ── Reduced motion: poster only ─────────────────────────── */
  if (prefersReducedMotion) {
    return (
      <>
        <div aria-hidden="true" style={{
          position: 'fixed', inset: 0, zIndex: -1,
          backgroundImage: `url(${POSTER})`,
          backgroundSize: 'cover', backgroundPosition: '68% 50%',
        }} />
        <div aria-hidden="true" style={{
          position: 'fixed', inset: 0, zIndex: -1,
          background: `rgba(10,8,7,${scrimBase})`,
        }} />
      </>
    )
  }

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0, zIndex: -1,
        overflow: 'hidden', pointerEvents: 'none',
      }}
    >
      {/* ── Video — NO filter/blur ever applied ────────────── */}
      <video
        ref={videoRef}
        autoPlay muted loop playsInline
        preload="auto"
        poster={POSTER}
        onError={onError}
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          objectPosition: '68% 50%',
          transformOrigin: 'center center',
          willChange: 'transform, object-position',
          transform: 'scale(1.0)',
          /* filter is intentionally NOT set — lungs stay crisp */
        }}
      >
        <source src="/videos/hero.mp4" type="video/mp4" />
      </video>

      {/* ── Warm-black scrim — animates opacity with scroll ─── */}
      <div
        ref={scrimRef}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(10,8,7,1)',
          opacity: scrimBase,
          willChange: 'opacity',
        }}
      />
    </div>
  )
}

/* ─── SceneScrim — per-scene extra overlay if needed ────────── */
export function SceneScrim({ opacity = 0.4 }: { opacity?: number }) {
  return (
    <div aria-hidden="true" style={{
      position: 'absolute', inset: 0,
      background: '#0A0807', opacity,
      pointerEvents: 'none', zIndex: 0,
    }} />
  )
}
