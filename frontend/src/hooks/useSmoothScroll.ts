import { useEffect } from 'react'
import Lenis from 'lenis'

/**
 * useSmoothScroll — Lenis smooth scroll, optionally disabled.
 * Pass disabled=true on pages that use CSS scroll-snap (LandingPage),
 * because Lenis intercepts window scroll and fights the snap container.
 */
export function useSmoothScroll(disabled = false) {
  useEffect(() => {
    if (disabled) {
      // Destroy any existing Lenis instance from previous route
      const existing = (window as unknown as Record<string, unknown>).lenis as
        { destroy?: () => void } | undefined
      existing?.destroy?.()
      ;(window as unknown as Record<string, unknown>).lenis = undefined
      return
    }

    const lenis = new Lenis({
      duration: 1.3,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.8,
    })

    function raf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    const rafId = requestAnimationFrame(raf)
    ;(window as unknown as Record<string, unknown>).lenis = lenis

    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
      ;(window as unknown as Record<string, unknown>).lenis = undefined
    }
  }, [disabled])
}
