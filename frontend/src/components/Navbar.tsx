import React, { useEffect, useState, useId } from 'react'
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Activity, Menu, X } from 'lucide-react'
import { Button } from './ui/Button'

import { Stethoscope, QrCode } from 'lucide-react'

const navLinks = [
  { label: 'Home',         href: '/'             },
  { label: 'How It Works', href: '/#how-it-works' },
  { label: 'About',        href: '/about'         },
]

const envLinks = [
  { label: 'For Doctors', href: '/env/doctor', icon: Stethoscope },
  { label: 'Join with Code', href: '/env/join',   icon: QrCode      },
]

export const Navbar: React.FC = () => {
  const [scrolled, setScrolled]       = useState(false)
  const [hidden, setHidden]           = useState(false)
  const [mobileOpen, setMobileOpen]   = useState(false)
  const [activeSection, setActiveSection] = useState('')
  const { scrollY } = useScroll()
  const location   = useLocation()
  const navigate   = useNavigate()
  const layoutId   = useId()
  let lastY = 0

  /* Hide on scroll-down, reveal on scroll-up */
  useMotionValueEvent(scrollY, 'change', (y) => {
    setScrolled(y > 40)
    if (y > lastY + 10 && y > 100) setHidden(true)
    else if (y < lastY - 6)        setHidden(false)
    lastY = y
  })

  /* Active section via IntersectionObserver */
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => { entries.forEach(e => { if (e.isIntersecting) setActiveSection(e.target.id) }) },
      { rootMargin: '-40% 0px -55% 0px' }
    )
    document.querySelectorAll('section[id]').forEach(s => observer.observe(s))
    return () => observer.disconnect()
  }, [location.pathname])

  const handleNavClick = (href: string) => {
    setMobileOpen(false)
    if (href.startsWith('/#')) {
      const id = href.replace('/#', '')
      if (location.pathname !== '/') {
        navigate('/')
        setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 120)
      } else {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
      }
    } else {
      navigate(href)
    }
  }

  return (
    <>
      {/* ── Floating pill navbar ─────────────────────────────── */}
      <motion.header
        className="fixed top-0 inset-x-0 z-[var(--z-float)] flex justify-center"
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: hidden ? -80 : 0, opacity: hidden ? 0 : 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        style={{ paddingTop: scrolled ? 10 : 16, paddingBottom: 0 }}
        aria-label="Main navigation"
      >
        <nav
          style={{
            background: scrolled
              ? 'linear-gradient(160deg, rgba(20,16,14,0.92) 0%, rgba(14,11,10,0.88) 100%)'
              : 'linear-gradient(160deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderTop: '1px solid rgba(255,255,255,0.14)',
            boxShadow: scrolled
              ? '0 2px 0 rgba(255,255,255,0.08) inset, 0 24px 64px rgba(0,0,0,0.70), 0 0 40px rgba(255,107,74,0.03)'
              : '0 1px 0 rgba(255,255,255,0.07) inset, 0 12px 40px rgba(0,0,0,0.50)',
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            transition: 'background 0.4s, box-shadow 0.4s, border-color 0.4s',
          }}
        >
          {/* Logo */}
          <button
            onClick={() => navigate('/')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px 8px', borderRadius: 12, marginRight: 4,
            }}
            aria-label="SwasthyaScan AI home"
          >
            <div style={{
              width: 26, height: 26, borderRadius: 8,
              background: 'var(--grad-brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Activity size={13} style={{ color: '#fff' }} />
            </div>
            <span style={{
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: '0.875rem', letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
            }}>
              Swasthya<span style={{ background: 'var(--grad-brand)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Scan</span>
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.72rem', marginLeft: 4 }}>AI</span>
            </span>
          </button>

          {/* Spacer */}
          <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)', marginInline: 4 }} />

          {/* Desktop nav links */}
          <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {navLinks.map(link => {
              const isActive = link.href === '/'
                ? location.pathname === '/'
                : activeSection === link.href.replace('/#', '')
              return (
                <motion.button
                  key={link.label}
                  onClick={() => handleNavClick(link.href)}
                  style={{
                    position: 'relative',
                    padding: '6px 14px',
                    borderRadius: 999,
                    background: 'none', border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    transition: 'color 0.2s',
                    whiteSpace: 'nowrap',
                  }}
                  whileHover={{ color: 'var(--text-primary)' }}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {isActive && (
                    <motion.span
                      layoutId={layoutId}
                      style={{
                        position: 'absolute', inset: 0,
                        borderRadius: 999,
                        background: 'rgba(255,107,74,0.10)',
                        border: '1px solid rgba(255,107,74,0.18)',
                      }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <span style={{ position: 'relative', zIndex: 1 }}>{link.label}</span>
                </motion.button>
              )
            })}
          </div>

          {/* Environment entry points */}
          <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
            <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.08)', marginRight: 2 }} />
            {envLinks.map(link => (
              <button
                key={link.label}
                id={`nav-${link.label.toLowerCase().replace(/ /g, '-')}`}
                onClick={() => navigate(link.href)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '5px 10px', borderRadius: 999,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer', fontSize: '0.72rem', fontWeight: 500,
                  color: 'var(--text-muted)', whiteSpace: 'nowrap',
                  transition: 'color 0.2s, background 0.2s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--ember)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(251,146,60,0.3)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
              >
                <link.icon size={11} />
                {link.label}
              </button>
            ))}
          </div>

          {/* CTA */}
          <div className="hide-mobile" style={{ marginLeft: 8 }}>
            <Button variant="primary" size="sm" onClick={() => navigate('/screening')}>
              Start Screening
            </Button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="hide-desktop"
            onClick={() => setMobileOpen(o => !o)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 8, padding: 8, cursor: 'pointer',
              color: 'var(--text-primary)', display: 'flex',
            }}
          >
            {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </nav>
      </motion.header>

      {/* ── Mobile drawer ────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed', top: 72, left: 16, right: 16,
              zIndex: 'var(--z-overlay)' as any,
              background: 'linear-gradient(160deg, rgba(20,16,14,0.96) 0%, rgba(14,11,10,0.95) 100%)',
              backdropFilter: 'blur(40px) saturate(180%)',
              WebkitBackdropFilter: 'blur(40px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 'var(--r-lg)',
              padding: 20,
              boxShadow: '0 32px 80px rgba(0,0,0,0.80)',
            }}
            role="dialog"
            aria-label="Mobile navigation"
          >
            <ul className="space-y-2">
              {navLinks.map(link => (
                <li key={link.label}>
                  <button
                    onClick={() => handleNavClick(link.href)}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '12px 16px', borderRadius: 'var(--r-sm)',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      cursor: 'pointer', color: 'var(--text-primary)',
                      fontFamily: 'var(--font-body)', fontSize: '0.9rem', fontWeight: 500,
                    }}
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 12 }}>
              <Button variant="primary" className="w-full" onClick={() => { setMobileOpen(false); navigate('/screening') }}>
                Start Screening
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
