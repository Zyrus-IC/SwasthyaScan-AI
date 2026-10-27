import React, { useRef, useCallback, useState } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'
import { Loader2, Check } from 'lucide-react'

/* ─────────────────────────────────────────────────────────────
   Button — Ember Noir reusable button with:
   • primary (brand-gradient + shine sweep + glow)
   • glass (frosted surface)
   • ghost (transparent outlined)
   • danger (red-tinted)
   • Magnetic hover effect (cursor follows within ~12px)
   • Cursor spotlight highlight inside button
   • Press spring scale + click ripple
   • Loading spinner + success tick
   • Keyboard focus ring (ember colour)
   • Min touch target 44px
───────────────────────────────────────────────────────────── */

type ButtonVariant = 'primary' | 'glass' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  success?: boolean
  icon?: React.ReactNode
  iconRight?: React.ReactNode
  href?: string
  className?: string
  children?: React.ReactNode
}

const sizeClass: Record<ButtonSize, string> = {
  sm: 'text-xs px-4 py-2 min-h-[36px]',
  md: 'text-sm px-6 py-3 min-h-[44px]',
  lg: 'text-base px-8 py-4 min-h-[52px]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  success = false,
  icon,
  iconRight,
  href,
  className = '',
  children,
  onClick,
  ...props
}: ButtonProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([])

  /* ── Magnetic effect ────────────────────────────────────────── */
  const springX = useSpring(0, { stiffness: 200, damping: 20 })
  const springY = useSpring(0, { stiffness: 200, damping: 20 })
  const magnetX = useTransform(springX, v => v)
  const magnetY = useTransform(springY, v => v)

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = (e.clientX - cx) * 0.25
    const dy = (e.clientY - cy) * 0.25
    springX.set(dx)
    springY.set(dy)

    /* spotlight */
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    ref.current.style.setProperty('--mx', `${x}%`)
    ref.current.style.setProperty('--my', `${y}%`)
  }, [springX, springY])

  const onMouseLeave = useCallback(() => {
    springX.set(0)
    springY.set(0)
  }, [springX, springY])

  /* ── Click ripple ────────────────────────────────────────────── */
  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const id = Date.now()
    setRipples(r => [...r, { id, x, y }])
    setTimeout(() => setRipples(r => r.filter(rip => rip.id !== id)), 600)
    onClick?.(e)
  }, [onClick])

  const variantCls = {
    primary: 'btn btn-primary',
    glass:   'btn btn-glass spotlight-card',
    ghost:   'btn btn-ghost',
    danger:  'btn btn-danger',
  }[variant]

  const cls = [variantCls, sizeClass[size], loading ? 'btn-loading' : '', className].filter(Boolean).join(' ')

  const content = (
    <>
      {/* Ripple container */}
      {ripples.map(rip => (
        <span
          key={rip.id}
          className="pointer-events-none absolute rounded-full animate-ripple"
          style={{
            left: rip.x,
            top: rip.y,
            width: 8,
            height: 8,
            marginLeft: -4,
            marginTop: -4,
            background: 'rgba(255,255,255,0.35)',
          }}
        />
      ))}

      {/* Icon left / loading / success */}
      {loading ? (
        <Loader2 size={15} className="animate-spin shrink-0" />
      ) : success ? (
        <Check size={15} className="shrink-0" style={{ color: '#4ADE80' }} />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}

      {children}

      {/* Icon right */}
      {iconRight && !loading && !success && (
        <span className="shrink-0">{iconRight}</span>
      )}
    </>
  )

  if (href) {
    return (
      <motion.a
        href={href}
        className={cls.replace('btn-loading', '')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', x: magnetX, y: magnetY }}
        whileTap={{ scale: 0.97 }}
      >
        {content}
      </motion.a>
    )
  }

  return (
    <motion.button
      ref={ref}
      className={cls}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={handleClick}
      style={{ x: magnetX, y: magnetY, position: 'relative', overflow: 'hidden' }}
      whileTap={{ scale: 0.97 }}
      disabled={loading || props.disabled}
      {...props}
    >
      {content}
    </motion.button>
  )
}
