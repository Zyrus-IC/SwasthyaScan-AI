import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail,
  Shield,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  RotateCcw,
  Sparkles,
  User,
  Lock,
  Eye,
  EyeOff,
  AtSign,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

interface HeroAuthCardProps {
  onSuccess?: () => void
}

export const HeroAuthCard: React.FC<HeroAuthCardProps> = ({ onSuccess }) => {
  const { sendOtp, verifyOtp, loginWithPassword, setProfile } = useAuth()
  const { t } = useLanguage()

  // Mode: 'otp' (Sign Up / Sign In via Gmail) vs 'password' (Sign In via Username & Password)
  const [authMode, setAuthMode] = useState<'otp' | 'password'>('otp')

  // OTP flow steps: 'email' -> 'otp' -> 'username'
  const [otpStep, setOtpStep] = useState<'email' | 'otp' | 'username'>('email')
  const [emailInput, setEmailInput] = useState('')
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])

  // Username setup state (Step 3)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')

  // Password mode state
  const [loginIdent, setLoginIdent] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Status states
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(300)

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Countdown timer for OTP
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (otpStep === 'otp' && countdown > 0) {
      timer = setInterval(() => setCountdown(c => c - 1), 1000)
    }
    return () => clearInterval(timer)
  }, [otpStep, countdown])

  // Auto-focus first digit input when entering OTP step
  useEffect(() => {
    if (otpStep === 'otp') {
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100)
    }
  }, [otpStep])

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // ── Step 1: Send Email OTP ──
  const handleSendEmailOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    const email = emailInput.trim().toLowerCase()
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address (e.g., yourname@gmail.com).')
      return
    }

    const [username, domain] = email.split('@')
    if (!username || username.length < 3) {
      setError('Email username is too short. Please enter a valid email address.')
      return
    }

    const typos: Record<string, string> = {
      'gmai.com': 'gmail.com',
      'gamil.com': 'gmail.com',
      'gmial.com': 'gmail.com',
      'gmaill.com': 'gmail.com',
      'yaho.com': 'yahoo.com',
      'hotmial.com': 'hotmail.com',
      'outlok.com': 'outlook.com',
    }
    if (typos[domain]) {
      setError(`Did you mean @${typos[domain]}? Please check your email.`)
      return
    }

    // Detect random keyboard mash / fake emails like cjhghcgcghc
    if (username.length >= 6 && !/[aeiou0123456789]/i.test(username)) {
      setError('This email address appears to be invalid. Please enter your real active email.')
      return
    }
    if (/[bcdfghjklmnpqrstvwxyz]{7,}/i.test(username)) {
      setError('Invalid email username pattern. Please enter a valid email address.')
      return
    }

    setLoading(true)
    const res = await sendOtp(email)
    setLoading(false)

    if (res.success) {
      setOtpStep('otp')
      setCountdown(300)
      setDevOtp(res.dev_otp || null)
      setSuccessMsg(res.message)
    } else {
      setError(res.message)
    }
  }

  // ── Step 2: Handle OTP Digit Change & Verification ──
  const handleDigitChange = (index: number, val: string) => {
    const digit = val.slice(-1).replace(/\D/g, '')
    const updated = [...otpDigits]
    updated[index] = digit
    setOtpDigits(updated)

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus()
    }

    if (updated.every(d => d !== '') && index === 5) {
      executeOtpVerification(updated.join(''))
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus()
    }
  }

  const executeOtpVerification = async (code: string) => {
    setError(null)
    setLoading(true)
    const res = await verifyOtp(emailInput, code)
    setLoading(false)

    if (res.success) {
      if (res.needs_username) {
        setOtpStep('username')
      } else {
        if (onSuccess) onSuccess()
      }
    } else {
      setError(res.message)
    }
  }

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const code = otpDigits.join('')
    if (code.length !== 6) {
      setError('Please enter all 6 digits of the verification code.')
      return
    }
    executeOtpVerification(code)
  }

  // Auto-fill dev code helper
  const handleAutoFillDevOtp = () => {
    if (devOtp && devOtp.length === 6) {
      const arr = devOtp.split('')
      setOtpDigits(arr)
      executeOtpVerification(devOtp)
    }
  }

  // ── Step 3: Handle Username & Optional Password Setup ──
  const handleSetProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const cleaned = newUsername.trim().toLowerCase()
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(cleaned)) {
      setError('Username must be 3-24 characters (letters, numbers, underscore only).')
      return
    }

    if (newPassword && newPassword.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    setLoading(true)
    const res = await setProfile(cleaned, newPassword || undefined)
    setLoading(false)

    if (res.success) {
      if (onSuccess) onSuccess()
    } else {
      setError(res.message)
    }
  }

  // ── Password Login Mode ──
  const handlePasswordLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!loginIdent.trim()) {
      setError('Please enter your username or email address.')
      return
    }
    if (!loginPass) {
      setError('Please enter your password.')
      return
    }

    setLoading(true)
    const res = await loginWithPassword(loginIdent.trim(), loginPass)
    setLoading(false)

    if (res.success) {
      if (onSuccess) onSuccess()
    } else {
      setError(res.message)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="hero-auth-card"
      style={{
        width: '100%',
        maxWidth: 480,
        background: 'linear-gradient(165deg, rgba(22, 17, 15, 0.95) 0%, rgba(12, 9, 8, 0.98) 100%)',
        backdropFilter: 'blur(36px) saturate(180%)',
        WebkitBackdropFilter: 'blur(36px) saturate(180%)',
        border: '1.5px solid rgba(255, 107, 74, 0.3)',
        borderRadius: 24,
        padding: '28px 24px',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85), 0 0 40px rgba(255, 107, 74, 0.15)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top glowing brand line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: 'linear-gradient(90deg, #FF6B4A 0%, #FF4D6D 50%, #E040A0 100%)',
          boxShadow: '0 0 16px rgba(255, 107, 74, 0.8)',
        }}
      />

      {/* Header Pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 10px',
            borderRadius: 20,
            background: 'rgba(255, 107, 74, 0.12)',
            border: '1px solid rgba(255, 107, 74, 0.3)',
            color: '#FFC2A8',
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'var(--font-mono, monospace)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          <Shield size={12} style={{ color: '#FF6B4A' }} />
          SECURE CLINICAL & PATIENT GATEWAY
        </span>
      </div>

      {/* Title & Subtitle */}
      <h2
        style={{
          fontSize: '1.5rem',
          fontWeight: 800,
          fontFamily: 'var(--font-display, inherit)',
          letterSpacing: '-0.02em',
          color: '#FAF6F4',
          margin: '0 0 6px 0',
        }}
      >
        {authMode === 'password'
          ? 'Sign In with Password'
          : otpStep === 'username'
          ? 'Set Up Your Profile'
          : otpStep === 'otp'
          ? 'Enter Verification Code'
          : 'Sign In or Register'}
      </h2>

      <p
        style={{
          fontSize: '0.86rem',
          color: '#C4BBB7',
          lineHeight: 1.5,
          margin: '0 0 20px 0',
        }}
      >
        {authMode === 'password'
          ? 'Enter your registered username or email and password.'
          : otpStep === 'username'
          ? 'Choose a unique username to personalize your patient profile.'
          : otpStep === 'otp'
          ? 'We sent a 6-digit real OTP code to your Gmail inbox.'
          : 'Enter your Gmail to sign in or create an account. No phone number required.'}
      </p>

      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#FCA5A5',
              fontSize: '0.84rem',
              lineHeight: 1.45,
              marginBottom: 16,
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2, color: '#EF4444' }} />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODE 1: EMAIL OTP FLOW ── */}
      {authMode === 'otp' && (
        <>
          {/* STEP 1: Enter Gmail */}
          {otpStep === 'email' && (
            <form onSubmit={handleSendEmailOtp}>
              <div style={{ marginBottom: 18 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 650,
                    color: '#FAF6F4',
                    marginBottom: 6,
                    letterSpacing: '0.02em',
                  }}
                >
                  Gmail or Email Address
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(10, 8, 7, 0.65)',
                    border: '1.5px solid rgba(255, 255, 255, 0.14)',
                    borderRadius: 14,
                    padding: '2px 14px',
                    transition: 'border-color 0.2s',
                  }}
                >
                  <Mail size={16} style={{ color: '#FF6B4A', marginRight: 10, flexShrink: 0 }} />
                  <input
                    type="email"
                    value={emailInput}
                    placeholder="yourname@gmail.com"
                    maxLength={80}
                    onChange={e => setEmailInput(e.target.value)}
                    disabled={loading}
                    autoFocus
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      color: '#FAF6F4',
                      fontSize: '0.95rem',
                      padding: '11px 4px',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !emailInput.trim()}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '13px 20px',
                  borderRadius: 14,
                  border: 'none',
                  background: emailInput.trim() && !loading
                    ? 'linear-gradient(110deg, #FF6B4A 0%, #FF4D6D 55%, #E040A0 100%)'
                    : 'rgba(255, 255, 255, 0.08)',
                  color: emailInput.trim() && !loading ? '#FAF6F4' : 'rgba(255, 255, 255, 0.3)',
                  cursor: emailInput.trim() && !loading ? 'pointer' : 'not-allowed',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  boxShadow: emailInput.trim() && !loading ? '0 8px 24px rgba(255, 107, 74, 0.4)' : 'none',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                {loading ? (
                  <Loader2 size={18} className="spin-loader" />
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 2: 6-Box OTP Input */}
          {otpStep === 'otp' && (
            <form onSubmit={handleVerifySubmit}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                  background: 'rgba(10, 8, 7, 0.5)',
                  padding: '8px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}>
                  <KeyRound size={14} style={{ color: '#FF6B4A' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Code sent to:</span>
                  <strong style={{ color: '#FAF6F4' }}>{emailInput}</strong>
                </div>

                <button
                  type="button"
                  onClick={() => { setOtpStep('email'); setOtpDigits(['','','','','','']); setError(null) }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#FF6B4A',
                    fontSize: '0.78rem',
                    fontWeight: 650,
                    cursor: 'pointer',
                  }}
                >
                  Change
                </button>
              </div>

              {/* Real Email Dispatch Success Indicator */}
              {!devOtp && successMsg && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 12px',
                    borderRadius: 10,
                    background: 'rgba(74, 222, 128, 0.1)',
                    border: '1px solid rgba(74, 222, 128, 0.35)',
                    marginBottom: 16,
                    fontSize: '0.82rem',
                    color: '#4ADE80',
                    lineHeight: 1.4,
                  }}
                >
                  <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Dev OTP Helper Badge */}
              {devOtp && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 12px',
                    borderRadius: 10,
                    background: 'rgba(74, 222, 128, 0.12)',
                    border: '1px solid rgba(74, 222, 128, 0.3)',
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#4ADE80' }}>
                    <Sparkles size={13} />
                    <span>Demo Code: <strong>{devOtp}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAutoFillDevOtp}
                    style={{
                      background: 'rgba(74, 222, 128, 0.2)',
                      border: '1px solid rgba(74, 222, 128, 0.4)',
                      borderRadius: 6,
                      padding: '2px 8px',
                      color: '#4ADE80',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Auto-Fill
                  </button>
                </div>
              )}

              {/* 6-box OTP input (Centered, neat squares) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  marginBottom: 20,
                  boxSizing: 'border-box',
                }}
              >
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => (otpInputRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleDigitChange(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    disabled={loading}
                    style={{
                      width: 50,
                      height: 54,
                      minWidth: 0,
                      maxWidth: 54,
                      flex: '1 1 0',
                      boxSizing: 'border-box',
                      textAlign: 'center',
                      fontSize: '1.4rem',
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono, monospace)',
                      color: '#FAF6F4',
                      background: digit ? 'rgba(255, 107, 74, 0.1)' : 'rgba(10, 8, 7, 0.85)',
                      border: digit ? '2px solid #FF6B4A' : '1.5px solid rgba(255, 255, 255, 0.18)',
                      borderRadius: 12,
                      outline: 'none',
                      boxShadow: digit ? '0 0 16px rgba(255, 107, 74, 0.4)' : 'none',
                      transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  />
                ))}
              </div>

              {/* Verify button */}
              <button
                type="submit"
                disabled={loading || otpDigits.some(d => !d)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '13px 20px',
                  borderRadius: 14,
                  border: 'none',
                  background: !otpDigits.some(d => !d) && !loading
                    ? 'linear-gradient(110deg, #FF6B4A 0%, #FF4D6D 55%, #E040A0 100%)'
                    : 'rgba(255, 255, 255, 0.08)',
                  color: !otpDigits.some(d => !d) && !loading ? '#FAF6F4' : 'rgba(255, 255, 255, 0.3)',
                  cursor: !otpDigits.some(d => !d) && !loading ? 'pointer' : 'not-allowed',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  boxShadow: !otpDigits.some(d => !d) && !loading ? '0 8px 24px rgba(255, 107, 74, 0.4)' : 'none',
                  transition: 'all 0.2s',
                  marginBottom: 16,
                }}
              >
                {loading ? (
                  <Loader2 size={18} className="spin-loader" />
                ) : (
                  <>
                    <CheckCircle2 size={17} />
                    <span>Verify & Continue</span>
                  </>
                )}
              </button>

              {/* Resend & Timer */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                }}
              >
                <span>Expires in: <strong style={{ color: '#FAF6F4', fontFamily: 'var(--font-mono)' }}>{formatTimer(countdown)}</strong></span>
                <button
                  type="button"
                  onClick={() => handleSendEmailOtp()}
                  disabled={loading || countdown > 240}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'transparent',
                    border: 'none',
                    color: countdown > 240 ? 'rgba(255, 255, 255, 0.25)' : '#FF6B4A',
                    fontSize: '0.8rem',
                    fontWeight: 650,
                    cursor: countdown > 240 ? 'not-allowed' : 'pointer',
                  }}
                >
                  <RotateCcw size={12} />
                  <span>Resend Code</span>
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Setup Username Screen (for new accounts) */}
          {otpStep === 'username' && (
            <form onSubmit={handleSetProfileSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 650,
                    color: '#FAF6F4',
                    marginBottom: 6,
                  }}
                >
                  Choose Your Username
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(10, 8, 7, 0.65)',
                    border: '1.5px solid rgba(255, 255, 255, 0.14)',
                    borderRadius: 14,
                    padding: '2px 14px',
                  }}
                >
                  <AtSign size={16} style={{ color: '#FF6B4A', marginRight: 8, flexShrink: 0 }} />
                  <input
                    type="text"
                    value={newUsername}
                    placeholder="e.g. alex_pulmo"
                    maxLength={24}
                    onChange={e => setNewUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    disabled={loading}
                    autoFocus
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      color: '#FAF6F4',
                      fontSize: '0.95rem',
                      padding: '11px 4px',
                      outline: 'none',
                    }}
                  />
                </div>
                <span style={{ fontSize: '0.74rem', color: '#A89F9C', marginTop: 4, display: 'block' }}>
                  Letters, numbers, and underscores only (3-24 chars).
                </span>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 650,
                    color: '#FAF6F4',
                    marginBottom: 6,
                  }}
                >
                  Create Password <span style={{ color: '#A89F9C', fontWeight: 400 }}>(Optional)</span>
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(10, 8, 7, 0.65)',
                    border: '1.5px solid rgba(255, 255, 255, 0.14)',
                    borderRadius: 14,
                    padding: '2px 14px',
                  }}
                >
                  <Lock size={16} style={{ color: '#FF6B4A', marginRight: 8, flexShrink: 0 }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    placeholder="At least 6 characters"
                    maxLength={64}
                    onChange={e => setNewPassword(e.target.value)}
                    disabled={loading}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      color: '#FAF6F4',
                      fontSize: '0.95rem',
                      padding: '11px 4px',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ background: 'transparent', border: 'none', color: '#A89F9C', cursor: 'pointer', padding: 4 }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span style={{ fontSize: '0.74rem', color: '#A89F9C', marginTop: 4, display: 'block' }}>
                  Allows you to log in directly next time with username & password.
                </span>
              </div>

              <button
                type="submit"
                disabled={loading || newUsername.trim().length < 3}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '13px 20px',
                  borderRadius: 14,
                  border: 'none',
                  background: newUsername.trim().length >= 3 && !loading
                    ? 'linear-gradient(110deg, #FF6B4A 0%, #FF4D6D 55%, #E040A0 100%)'
                    : 'rgba(255, 255, 255, 0.08)',
                  color: newUsername.trim().length >= 3 && !loading ? '#FAF6F4' : 'rgba(255, 255, 255, 0.3)',
                  cursor: newUsername.trim().length >= 3 && !loading ? 'pointer' : 'not-allowed',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  boxShadow: newUsername.trim().length >= 3 && !loading ? '0 8px 24px rgba(255, 107, 74, 0.4)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {loading ? (
                  <Loader2 size={18} className="spin-loader" />
                ) : (
                  <>
                    <span>Complete Setup & Enter</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}
        </>
      )}

      {/* ── MODE 2: USERNAME & PASSWORD SIGN IN ── */}
      {authMode === 'password' && (
        <form onSubmit={handlePasswordLoginSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 650,
                color: '#FAF6F4',
                marginBottom: 6,
              }}
            >
              Username or Email
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(10, 8, 7, 0.65)',
                border: '1.5px solid rgba(255, 255, 255, 0.14)',
                borderRadius: 14,
                padding: '2px 14px',
              }}
            >
              <User size={16} style={{ color: '#FF6B4A', marginRight: 8, flexShrink: 0 }} />
              <input
                type="text"
                value={loginIdent}
                placeholder="Username or yourname@gmail.com"
                maxLength={80}
                onChange={e => setLoginIdent(e.target.value)}
                disabled={loading}
                autoFocus
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: '#FAF6F4',
                  fontSize: '0.95rem',
                  padding: '11px 4px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 650,
                color: '#FAF6F4',
                marginBottom: 6,
              }}
            >
              Password
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(10, 8, 7, 0.65)',
                border: '1.5px solid rgba(255, 255, 255, 0.14)',
                borderRadius: 14,
                padding: '2px 14px',
              }}
            >
              <Lock size={16} style={{ color: '#FF6B4A', marginRight: 8, flexShrink: 0 }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={loginPass}
                placeholder="Enter your password"
                maxLength={64}
                onChange={e => setLoginPass(e.target.value)}
                disabled={loading}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: '#FAF6F4',
                  fontSize: '0.95rem',
                  padding: '11px 4px',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ background: 'transparent', border: 'none', color: '#A89F9C', cursor: 'pointer', padding: 4 }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !loginIdent.trim() || !loginPass}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '13px 20px',
              borderRadius: 14,
              border: 'none',
              background: loginIdent.trim() && loginPass && !loading
                ? 'linear-gradient(110deg, #FF6B4A 0%, #FF4D6D 55%, #E040A0 100%)'
                : 'rgba(255, 255, 255, 0.08)',
              color: loginIdent.trim() && loginPass && !loading ? '#FAF6F4' : 'rgba(255, 255, 255, 0.3)',
              cursor: loginIdent.trim() && loginPass && !loading ? 'pointer' : 'not-allowed',
              fontSize: '0.92rem',
              fontWeight: 700,
              boxShadow: loginIdent.trim() && loginPass && !loading ? '0 8px 24px rgba(255, 107, 74, 0.4)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {loading ? (
              <Loader2 size={18} className="spin-loader" />
            ) : (
              <>
                <span>Sign In to Account</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      )}

      {/* ── FOOTER TOGGLE: Already have an account / Sign in with OTP ── */}
      <div
        style={{
          marginTop: 20,
          paddingTop: 16,
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          textAlign: 'center',
        }}
      >
        {authMode === 'otp' ? (
          <p style={{ margin: 0, fontSize: '0.84rem', color: '#C4BBB7' }}>
            Already set a password?{' '}
            <button
              type="button"
              onClick={() => {
                setAuthMode('password')
                setError(null)
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#FF6B4A',
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}
            >
              Sign In with Username & Password
            </button>
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: '0.84rem', color: '#C4BBB7' }}>
            Prefer passwordless?{' '}
            <button
              type="button"
              onClick={() => {
                setAuthMode('otp')
                setOtpStep('email')
                setError(null)
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#FF6B4A',
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}
            >
              Sign In or Register with Email OTP
            </button>
          </p>
        )}
      </div>

      {/* Security Footer Note */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          marginTop: 14,
          fontSize: '0.74rem',
          color: '#6E6562',
        }}
      >
        <Shield size={12} style={{ color: '#FF6B4A' }} />
        <span>End-to-End Encrypted & HIPAA/NDHM Aligned</span>
      </div>
    </motion.div>
  )
}
