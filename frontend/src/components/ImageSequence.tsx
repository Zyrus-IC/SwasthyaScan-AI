/**
 * ImageSequence.tsx — D2: Scroll-driven image sequence (canvas)
 * 50 frames: /frames/ezgif-frame-001.jpg … ezgif-frame-050.jpg
 */
import React, { useEffect, useRef, useCallback } from 'react'
import { useScroll, useMotionValueEvent } from 'framer-motion'

const TOTAL_FRAMES = 50
const LERP_SPEED   = 0.10
const pad3 = (n: number) => String(n).padStart(3, '0')
const src  = (i: number) => `/frames/ezgif-frame-${pad3(i)}.jpg`

function loadImg(i: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.src = src(i)
    img.onload = () => resolve(img)
    img.onerror = reject
  })
}

export function ImageSequence() {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const images       = useRef<(HTMLImageElement | null)[]>(new Array(TOTAL_FRAMES + 1).fill(null))
  const current      = useRef(0)      // float, displayed frame index (0-based)
  const target       = useRef(0)      // scroll-driven target (0-based)
  const rafRef       = useRef(0)
  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const { scrollYProgress } = useScroll()

  /* ── Draw ─────────────────────────────────────────────────── */
  const draw = useCallback((frameFloat: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // pick nearest loaded frame
    const idx = Math.round(frameFloat)
    let img = images.current[idx + 1] // 1-based storage

    // search nearby if exact isn't loaded
    if (!img) {
      for (let d = 1; d < TOTAL_FRAMES; d++) {
        const a = images.current[idx + 1 + d]
        const b = images.current[idx + 1 - d]
        if (a) { img = a; break }
        if (b) { img = b; break }
      }
    }
    if (!img) return

    const cw = canvas.width, ch = canvas.height
    const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight)
    const dw = img.naturalWidth * scale
    const dh = img.naturalHeight * scale
    const dx = (cw - dw) / 2
    const dy = (ch - dh) / 2

    ctx.clearRect(0, 0, cw, ch)
    ctx.drawImage(img, dx, dy, dw, dh)
  }, [])

  /* ── Resize ───────────────────────────────────────────────── */
  const resize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75)
    canvas.width  = canvas.offsetWidth  * dpr
    canvas.height = canvas.offsetHeight * dpr
    draw(current.current)
  }, [draw])

  /* ── RAF loop ─────────────────────────────────────────────── */
  const loop = useCallback(() => {
    const diff = target.current - current.current
    if (Math.abs(diff) > 0.01) {
      current.current += diff * LERP_SPEED
      draw(current.current)
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [draw])

  /* ── Scroll → target frame ────────────────────────────────── */
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (reducedMotion) return
    const clamped = Math.max(0, Math.min(1, v / 0.45))
    target.current = clamped * (TOTAL_FRAMES - 1)
  })

  /* ── Mount: load priority frames then the rest ─────────────── */
  useEffect(() => {
    resize()
    window.addEventListener('resize', resize)

    // Load frame 1 FIRST so hero shows immediately
    loadImg(1).then(img => {
      images.current[1] = img
      resize()                   // draw immediately
      if (!reducedMotion) {
        rafRef.current = requestAnimationFrame(loop)
      }
    })

    // Then load 2–10 quickly
    const priority = [2,3,4,5,6,7,8,9,10]
    priority.forEach(i => loadImg(i).then(img => { images.current[i] = img }))

    // Rest after short delay
    const t = setTimeout(() => {
      for (let i = 11; i <= TOTAL_FRAMES; i++) {
        const ii = i
        setTimeout(() => loadImg(ii).then(img => { images.current[ii] = img }), (ii - 11) * 30)
      }
    }, 600)

    return () => {
      clearTimeout(t)
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        opacity: 0.92,
      }}
    />
  )
}

export function LungFallback() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 70% 80% at 75% 50%, rgba(255,107,74,0.20) 0%, rgba(255,77,109,0.12) 40%, transparent 75%)',
      }}
    />
  )
}
