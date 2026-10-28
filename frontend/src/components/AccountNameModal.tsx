import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AtSign, Lock, Eye, EyeOff, Loader2, ArrowRight, Shield, AlertCircle, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export const AccountNameModal: React.FC = () => {
  const { user, isAuthenticated, setProfile } = useAuth()
  const [accountName, setAccountName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Only show when authenticated and user has NO username set
  const shouldShow = Boolean(isAuthenticated && user && (!user.username || user.username.trim() === ''))

  if (!shouldShow) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const cleaned = accountName.trim().replace(/\s+/g, '_').toLowerCase()
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(cleaned)) {
      setError('Account name must be 3-24 characters (letters, numbers, underscores only).')
      return
    }

    if (password && password.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    setLoading(true)
    const res = await setProfile(cleaned, password || undefined)
    setLoading(false)

    if (!res.success) {
      setError(res.message)
    }
  }

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          background: 'rgba(5, 3, 3, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 20 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: '100%',
            maxWidth: 460,
            background: 'linear-gradient(165deg, rgba(24, 18, 16, 0.98) 0%, rgba(12, 9, 8, 0.99) 100%)',
            border: '1.5px solid rgba(255, 107, 74, 0.4)',
            borderRadius: 24,
            padding: '32px 26px',
            boxShadow: '0 25px 70px rgba(0, 0, 0, 0.9), 0 0 50px rgba(255, 107, 74, 0.2)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Top glowing gradient stripe */}
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

          {/* Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 20,
                background: 'rgba(255, 107, 74, 0.12)',
                border: '1px solid rgba(255, 107, 74, 0.3)',
                color: '#FFC2A8',
                fontSize: 11,
                fontWeight: 700,
                fontFamily: 'var(--font-mono, monospace)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <Sparkles size={12} style={{ color: '#FF6B4A' }} />
              ACCOUNT SETUP REQUIRED
            </span>
          </div>

          <h3
            style={{
              fontSize: '1.45rem',
              fontWeight: 800,
              color: '#FAF6F4',
              fontFamily: 'var(--font-display, inherit)',
              letterSpacing: '-0.02em',
              margin: '0 0 8px 0',
            }}
          >
            What Should We Call You?
          </h3>

          <p
            style={{
              fontSize: '0.86rem',
              color: '#C4BBB7',
              lineHeight: 1.5,
              margin: '0 0 20px 0',
            }}
          >
            Please set your unique <strong>Account Name</strong>. This will be displayed on your profile and header instead of your email.
          </p>

          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 12,
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#FCA5A5',
                fontSize: '0.84rem',
                marginBottom: 16,
              }}
            >
              <AlertCircle size={16} style={{ color: '#EF4444', flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 650,
                  color: '#FAF6F4',
                  marginBottom: 6,
                }}
              >
                Account Name / Username
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(10, 8, 7, 0.7)',
                  border: '1.5px solid rgba(255, 107, 74, 0.4)',
                  borderRadius: 14,
                  padding: '2px 14px',
                }}
              >
                <AtSign size={16} style={{ color: '#FF6B4A', marginRight: 8, flexShrink: 0 }} />
                <input
                  type="text"
                  value={accountName}
                  placeholder="e.g. thanga or thanganarayanan"
                  maxLength={24}
                  onChange={e => setAccountName(e.target.value)}
                  disabled={loading}
                  autoFocus
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: '#FAF6F4',
                    fontSize: '1rem',
                    padding: '12px 4px',
                    outline: 'none',
                    fontWeight: 600,
                  }}
                />
              </div>
              <span style={{ fontSize: '0.74rem', color: '#A89F9C', marginTop: 4, display: 'block' }}>
                Letters, numbers, and underscores (3-24 characters).
              </span>
            </div>

            <div style={{ marginBottom: 22 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 650,
                  color: '#FAF6F4',
                  marginBottom: 6,
                }}
              >
                Password <span style={{ color: '#A89F9C', fontWeight: 400 }}>(Optional)</span>
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(10, 8, 7, 0.7)',
                  border: '1.5px solid rgba(255, 255, 255, 0.14)',
                  borderRadius: 14,
                  padding: '2px 14px',
                }}
              >
                <Lock size={16} style={{ color: '#FF6B4A', marginRight: 8, flexShrink: 0 }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  placeholder="Optional: set password for 1-click login"
                  maxLength={64}
                  onChange={e => setPassword(e.target.value)}
                  disabled={loading}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: '#FAF6F4',
                    fontSize: '0.95rem',
                    padding: '12px 4px',
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
              disabled={loading || accountName.trim().length < 3}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '14px 20px',
                borderRadius: 14,
                border: 'none',
                background: accountName.trim().length >= 3 && !loading
                  ? 'linear-gradient(110deg, #FF6B4A 0%, #FF4D6D 55%, #E040A0 100%)'
                  : 'rgba(255, 255, 255, 0.08)',
                color: accountName.trim().length >= 3 && !loading ? '#FAF6F4' : 'rgba(255, 255, 255, 0.3)',
                cursor: accountName.trim().length >= 3 && !loading ? 'pointer' : 'not-allowed',
                fontSize: '0.95rem',
                fontWeight: 750,
                boxShadow: accountName.trim().length >= 3 && !loading ? '0 8px 24px rgba(255, 107, 74, 0.45)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              {loading ? (
                <Loader2 size={18} className="spin-loader" />
              ) : (
                <>
                  <span>Save Account Name & Enter</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

