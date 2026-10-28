import React, { useEffect, useState, useId } from 'react'
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Activity, Menu, X, Stethoscope, QrCode, LogOut, User, ChevronDown, CheckCircle2, ShieldCheck } from 'lucide-react'
import { Button } from './ui/Button'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { LanguageSelector } from './LanguageSelector'

export const Navbar: React.FC = () => {
  const { t } = useLanguage()
  const { user, isAuthenticated, logout } = useAuth()
  const [scrolled, setScrolled]       = useState(false)
  const [hidden, setHidden]           = useState(false)
  const [mobileOpen, setMobileOpen]   = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('')
  const { scrollY } = useScroll()
  const location   = useLocation()
  const navigate   = useNavigate()
  const layoutId   = useId()
  let lastY = 0

  const navLinks = [
    { label: t.nav.home,         href: '/'             },
    { label: t.nav.howItWorks,   href: '/#how-it-works' },
    { label: t.nav.about,        href: '/about'         },
  ]

  const envLinks = [
    { label: t.nav.forDoctors, href: '/env/doctor', icon: Stethoscope },
    { label: t.nav.joinCode,   href: '/env/join',   icon: QrCode      },
  ]

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
    document.querySelectorAll('.snap-scene[id], section[id]').forEach(s => observer.observe(s))
    return () => observer.disconnect()
  }, [location.pathname])

  const handleNavClick = (href: string) => {
    setMobileOpen(false)
    if (href.startsWith('/#')) {
      const id = href.replace('/#', '')
      const scrollToSection = () => {
        const el = document.getElementById(id) || document.getElementById('workflow')
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }

      if (location.pathname !== '/') {
        navigate('/')
        setTimeout(scrollToSection, 150)
      } else {
        scrollToSection()
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

          {/* Desktop nav links — only when logged in */}
          {isAuthenticated && (
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
          )}

          {/* Environment entry points — only when logged in */}
          {isAuthenticated && (
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
          )}

          {/* Language Selector */}
          <div className="hide-mobile" style={{ marginLeft: 6 }}>
            <LanguageSelector />
          </div>

          {/* User Profile & Sign Out or Start Screening */}
          {isAuthenticated ? (
            <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 6, position: 'relative' }}>
              {/* Profile Pill Trigger */}
              <button
                type="button"
                onClick={() => setProfileOpen(!profileOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 20,
                  background: profileOpen ? 'rgba(255, 107, 74, 0.22)' : 'rgba(255, 107, 74, 0.12)',
                  border: '1px solid rgba(255, 107, 74, 0.35)',
                  fontSize: '0.78rem',
                  fontWeight: 650,
                  color: '#FAF6F4',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #FF6B4A, #FF4D6D)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 800,
                    color: '#FAF6F4',
                  }}
                >
                  {(user?.username || user?.email || 'U')[0].toUpperCase()}
                </div>
                <span>{user?.username ? `@${user.username}` : (user?.identifier?.split('@')[0] || 'My Account')}</span>
                <ChevronDown size={13} style={{ transform: profileOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>

              {/* Profile Dropdown Popover */}
              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 10px)',
                      right: 0,
                      width: 280,
                      background: 'linear-gradient(165deg, rgba(24, 18, 16, 0.98) 0%, rgba(14, 11, 10, 0.98) 100%)',
                      backdropFilter: 'blur(30px)',
                      border: '1.5px solid rgba(255, 107, 74, 0.35)',
                      borderRadius: 18,
                      padding: 16,
                      boxShadow: '0 20px 50px rgba(0,0,0,0.85), 0 0 30px rgba(255, 107, 74, 0.12)',
                      zIndex: 100,
                    }}
                  >
                    {/* User Info Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #FF6B4A, #FF4D6D, #E040A0)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 18,
                          fontWeight: 800,
                          color: '#FAF6F4',
                          boxShadow: '0 0 15px rgba(255, 107, 74, 0.4)',
                        }}
                      >
                        {(user?.username || user?.email || 'U')[0].toUpperCase()}
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '0.92rem', fontWeight: 750, color: '#FAF6F4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {user?.username ? `@${user.username}` : (user?.identifier?.split('@')[0] || 'My Account')}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#A89F9C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {user?.email || user?.identifier}
                        </div>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'rgba(74, 222, 128, 0.08)', border: '1px solid rgba(74, 222, 128, 0.25)', borderRadius: 10, marginBottom: 12 }}>
                      <CheckCircle2 size={13} style={{ color: '#4ADE80' }} />
                      <span style={{ fontSize: '0.74rem', color: '#4ADE80', fontWeight: 600 }}>Verified Account</span>
                    </div>

                    {/* Account Details */}
                    <div style={{ fontSize: '0.74rem', color: '#6E6562', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div>Account ID: <strong style={{ color: '#C4BBB7', fontFamily: 'var(--font-mono)' }}>{user?.id}</strong></div>
                      <div>Joined: <strong style={{ color: '#C4BBB7' }}>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Today'}</strong></div>
                    </div>

                    {/* Sign Out Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false)
                        logout()
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '9px',
                        borderRadius: 12,
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#FCA5A5',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                    >
                      <LogOut size={13} />
                      <span>{t.auth.signOut}</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <Button variant="primary" size="sm" onClick={() => navigate('/screening')}>
                {t.nav.startScreening}
              </Button>
            </div>
          ) : (
            <div className="hide-mobile" style={{ marginLeft: 6 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 12px',
                  borderRadius: 20,
                  background: 'rgba(255, 107, 74, 0.10)',
                  border: '1px solid rgba(255, 107, 74, 0.25)',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: '#FFC2A8',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.04em',
                }}
              >
                🔒 SECURE PORTAL
              </span>
            </div>
          )}

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
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <LanguageSelector />
            </div>
            <div style={{ marginTop: 12 }}>
              <Button variant="primary" className="w-full" onClick={() => { setMobileOpen(false); navigate('/screening') }}>
                {t.nav.startScreening}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
