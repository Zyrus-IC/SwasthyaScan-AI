import React, { useEffect, useRef, useCallback } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

interface CursorState {
  hovered: boolean
}

export const CustomCursor: React.FC = () => {
  const dotRef  = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<CursorState>({ hovered: false })

  // Raw mouse position
  const mouseX = useMotionValue(-100)
  const mouseY = useMotionValue(-100)

  // Ring follows with spring lag (feels premium)
  const ringX = useSpring(mouseX, { stiffness: 160, damping: 22, mass: 0.4 })
  const ringY = useSpring(mouseY, { stiffness: 160, damping: 22, mass: 0.4 })

  const onMove = useCallback((e: MouseEvent) => {
    mouseX.set(e.clientX)
    mouseY.set(e.clientY)
  }, [mouseX, mouseY])

  const onEnter = useCallback(() => {
    dotRef.current?.classList.add('hovered')
    ringRef.current?.classList.add('hovered')
    stateRef.current.hovered = true
  }, [])

  const onLeave = useCallback(() => {
    dotRef.current?.classList.remove('hovered')
    ringRef.current?.classList.remove('hovered')
    stateRef.current.hovered = false
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', onMove, { passive: true })

    // Attach hover listeners to all interactive elements
    const attachListeners = () => {
      const targets = document.querySelectorAll(
        'a, button, [role="button"], input, textarea, label, [data-cursor-hover]'
      )
      targets.forEach((el) => {
        el.addEventListener('mouseenter', onEnter)
        el.addEventListener('mouseleave', onLeave)
      })
      return targets
    }

    let targets = attachListeners()

    // Re-attach on DOM changes (SPA navigation)
    const observer = new MutationObserver(() => {
      targets.forEach((el) => {
        el.removeEventListener('mouseenter', onEnter)
        el.removeEventListener('mouseleave', onLeave)
      })
      targets = attachListeners()
    })

    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      window.removeEventListener('mousemove', onMove)
      targets.forEach((el) => {
        el.removeEventListener('mouseenter', onEnter)
        el.removeEventListener('mouseleave', onLeave)
      })
      observer.disconnect()
    }
  }, [onMove, onEnter, onLeave])

  return (
    <div className="custom-cursor" aria-hidden="true">
      {/* Dot — follows mouse exactly */}
      <motion.div
        ref={dotRef}
        className="cursor-dot"
        style={{
          position: 'fixed',
          x: mouseX,
          y: mouseY,
        }}
      />
      {/* Ring — lags behind with spring */}
      <motion.div
        ref={ringRef}
        className="cursor-ring"
        style={{
          position: 'fixed',
          x: ringX,
          y: ringY,
        }}
      />
    </div>
  )
}
