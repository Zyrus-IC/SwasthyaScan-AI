/**
 * ChatBot.tsx — SwasthyaScan AI Floating Chatbot Widget
 * Ultra-modern "Aurora Bento" design — 2025 trending UI
 *
 * Features:
 * - Animated aurora mesh background
 * - Glassmorphism with neon ember glow
 * - Animated wave typing indicator
 * - Floating particle orbs on launcher
 * - Bento-style suggestion cards with hover shimmer
 * - Smooth spring animations (Framer Motion)
 * - Trilingual UI (EN / Tamil / Hindi)
 * - Full medical knowledge via Groq backend proxy
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react'
import type { KeyboardEvent } from 'react'
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from 'framer-motion'
import {
  X,
  Send,
  Loader2,
  AlertCircle,
  RotateCcw,
  Trash2,
  Sparkles,
  Shield,
  Bot,
  Zap,
  Heart,
  Brain,
  Stethoscope,
} from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  error?: boolean
  failedPrompt?: string
}

export interface ChatBotProps {
  report?: unknown
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API_URL    = '/api/chat'
const HEALTH_URL = '/health'
const MAX_CHARS  = 500
const MAX_HISTORY = 8

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/**
 * Format markdown text into styled React elements with Aurora Bento tokens
 */
function renderFormattedContent(text: string) {
  const lines = text.split('\n')
  return lines.map((line, lineIdx) => {
    const bulletMatch = line.match(/^(\*|-|•)\s+(.*)/)
    const content = bulletMatch ? bulletMatch[2] : line

    const parts = content.split(/(\*\*.*?\*\*)/g)
    const formattedParts = parts.map((part, partIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={partIdx} style={{ color: '#FFC2A8', fontWeight: 700 }}>
            {part.slice(2, -2)}
          </strong>
        )
      }
      return part
    })

    if (bulletMatch) {
      return (
        <div
          key={lineIdx}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            margin: '5px 0',
            paddingLeft: 2,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #FF6B4A, #FF4D6D)',
              boxShadow: '0 0 10px rgba(255, 107, 74, 1)',
              marginTop: 9,
              flexShrink: 0,
            }}
          />
          <span style={{ flex: 1 }}>{formattedParts}</span>
        </div>
      )
    }

    if (!line.trim()) {
      return <div key={lineIdx} style={{ height: 6 }} />
    }

    return (
      <p key={lineIdx} style={{ margin: '3px 0' }}>
        {formattedParts}
      </p>
    )
  })
}

// ── Chip icons map ─────────────────────────────────────────────────────────────
const CHIP_ICONS = [
  <Brain size={16} key="brain" />,
  <Stethoscope size={16} key="steth" />,
  <Heart size={16} key="heart" />,
  <Zap size={16} key="zap" />,
]

// ── Component ─────────────────────────────────────────────────────────────────

export const ChatBot: React.FC<ChatBotProps> = () => {
  const { t } = useLanguage()

  const [open, setOpen]         = useState(false)
  const [input, setInput]       = useState('')
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: t.chatbot.welcome,
      timestamp: new Date(),
    },
  ])
  const [loading, setLoading]   = useState(false)
  const [isOnline, setIsOnline] = useState<boolean | null>(null)

  const listRef    = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const videoRef   = useRef<HTMLVideoElement>(null)
  const buttonRef  = useRef<HTMLButtonElement>(null)

  const prefersReducedMotion = useReducedMotion()

  // Update welcome message dynamically when user changes website language
  useEffect(() => {
    setMessages(prev => {
      if (prev.length === 1 && prev[0].id === 'welcome') {
        return [
          {
            id: 'welcome',
            role: 'assistant',
            content: t.chatbot.welcome,
            timestamp: new Date(),
          },
        ]
      }
      return prev
    })
  }, [t.chatbot.welcome])

  // ── 3D Mouse Tilt & Position Shift (Desktop only) ──────────────────────────
  const mouseTiltX  = useMotionValue(0)
  const mouseTiltY  = useMotionValue(0)
  const mouseShiftX = useMotionValue(0)
  const mouseShiftY = useMotionValue(0)

  const springTiltX  = useSpring(mouseTiltX,  { stiffness: 200, damping: 22 })
  const springTiltY  = useSpring(mouseTiltY,  { stiffness: 200, damping: 22 })
  const springShiftX = useSpring(mouseShiftX, { stiffness: 200, damping: 22 })
  const springShiftY = useSpring(mouseShiftY, { stiffness: 200, damping: 22 })

  useEffect(() => {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    if (prefersReducedMotion || open || isTouch) return

    const PROXIMITY = 280
    const TILT_MAX  = 16
    const SHIFT_MAX = 10

    const handleMouseMove = (e: MouseEvent) => {
      const btn = buttonRef.current
      if (!btn) return
      const rect = btn.getBoundingClientRect()
      const cx   = rect.left + rect.width  / 2
      const cy   = rect.top  + rect.height / 2
      const dx   = e.clientX - cx
      const dy   = e.clientY - cy
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < PROXIMITY) {
        const factor = 1 - dist / PROXIMITY
        mouseTiltX.set((dy / PROXIMITY) * TILT_MAX * factor)
        mouseTiltY.set((-dx / PROXIMITY) * TILT_MAX * factor)
        mouseShiftX.set((dx / PROXIMITY) * SHIFT_MAX * factor)
        mouseShiftY.set((dy / PROXIMITY) * SHIFT_MAX * factor)
      } else {
        mouseTiltX.set(0)
        mouseTiltY.set(0)
        mouseShiftX.set(0)
        mouseShiftY.set(0)
      }
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [prefersReducedMotion, open, mouseTiltX, mouseTiltY, mouseShiftX, mouseShiftY])

  useEffect(() => {
    if (open) {
      mouseTiltX.set(0)
      mouseTiltY.set(0)
      mouseShiftX.set(0)
      mouseShiftY.set(0)
    }
  }, [open, mouseTiltX, mouseTiltY, mouseShiftX, mouseShiftY])

  // ── Video pause/play sync ──────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (open) {
      video.pause()
    } else {
      video.play().catch(() => {})
    }
  }, [open])

  // ── Keyboard handling (Esc to close, focus back) ───────────────────────────
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  // ── Focus input when opened ───────────────────────────────────────────────
  useEffect(() => {
    if (open && inputRef.current) {
      const timer = setTimeout(() => inputRef.current?.focus(), 150)
      return () => clearTimeout(timer)
    }
  }, [open])

  // ── Auto scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, open, loading])

  // ── Live health check ─────────────────────────────────────────────────────
  useEffect(() => {
    fetch(HEALTH_URL, { signal: AbortSignal.timeout(4000) })
      .then(res => setIsOnline(res.ok))
      .catch(() => setIsOnline(false))
  }, [])

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: Message = {
      id: makeId(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const history = messages
      .filter(m => m.id !== 'welcome' && !m.error)
      .slice(-MAX_HISTORY)
      .map(m => ({ role: m.role, content: m.content }))

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history }),
        signal: AbortSignal.timeout(30_000),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const detail = (err as { detail?: string }).detail
        throw new Error(detail || `HTTP ${res.status}`)
      }

      const data = await res.json() as { reply: string; groq_available: boolean }
      const botMsg: Message = {
        id: makeId(),
        role: 'assistant',
        content: data.reply || '(No response received)',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, botMsg])
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'TimeoutError'
      const isNetwork = err instanceof TypeError
      const errorMsg: Message = {
        id: makeId(),
        role: 'assistant',
        content: isTimeout
          ? '⏱ The request timed out. Please try again.'
          : isNetwork
            ? '📡 Assistant is currently offline. Please ensure backend is running.'
            : `⚠ ${(err as Error).message || 'Something went wrong. Please try again.'}`,
        timestamp: new Date(),
        error: true,
        failedPrompt: trimmed,
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }, [loading, messages])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: t.chatbot.welcome,
        timestamp: new Date(),
      },
    ])
  }

  const toggleOpen = () => {
    setOpen(prev => {
      const next = !prev
      if (!next) {
        setTimeout(() => buttonRef.current?.focus(), 50)
      }
      return next
    })
  }

  const charsLeft = MAX_CHARS - input.length
  const charWarn  = charsLeft <= 50

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Floating Mascot Launcher ── */}
      <motion.div
        className="cb-launcher"
        style={{
          position: 'fixed',
          zIndex: 1000,
          perspective: 900,
          rotateX: prefersReducedMotion ? 0 : springTiltX,
          rotateY: prefersReducedMotion ? 0 : springTiltY,
          x: prefersReducedMotion ? 0 : springShiftX,
          y: prefersReducedMotion ? 0 : springShiftY,
        }}
      >
        {/* Outer halo rings */}
        {!open && !prefersReducedMotion && (
          <>
            <div className="cb-halo cb-halo-1" />
            <div className="cb-halo cb-halo-2" />
          </>
        )}

        {/* Floating particles */}
        {!open && !prefersReducedMotion && (
          <>
            <div className="cb-particle cb-p1" />
            <div className="cb-particle cb-p2" />
            <div className="cb-particle cb-p3" />
          </>
        )}

        {/* Smart Tooltip */}
        <AnimatePresence>
          {!open && (
            <motion.div
              className="cb-tooltip"
              initial={{ opacity: 0, x: 12, scale: 0.88 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 12, scale: 0.88 }}
              transition={{ duration: 0.22, type: 'spring', stiffness: 300, damping: 24 }}
            >
              <div className="cb-tooltip-dot" />
              <span>{t.chatbot.tooltip}</span>
              <div className="cb-tooltip-arrow" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Orb Button */}
        <motion.button
          ref={buttonRef}
          aria-label={t.chatbot.tooltip}
          aria-expanded={open}
          aria-controls="chatbot-panel"
          onClick={toggleOpen}
          whileHover={prefersReducedMotion ? {} : { scale: 1.1 }}
          whileTap={prefersReducedMotion ? {} : { scale: 0.88 }}
          className="cb-orb-btn"
        >
          {/* Spinning gradient ring */}
          <div className="cb-orb-ring-spin" />
          {/* Inner gradient glow */}
          <div className="cb-orb-inner-glow" />

          {prefersReducedMotion ? (
            <img
              src="/swasthyascan-avatar.png"
              alt="SwasthyaScan AI"
              className="cb-orb-media"
            />
          ) : (
            <video
              ref={videoRef}
              src="/videos/chatbot.mp4"
              poster="/swasthyascan-avatar.png"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="cb-orb-media"
            />
          )}

          {/* X overlay when open */}
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, scale: 0.4, rotate: -120 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.4, rotate: 120 }}
                transition={{ duration: 0.22, type: 'spring', stiffness: 340, damping: 22 }}
                className="cb-orb-close-overlay"
              >
                <X size={26} strokeWidth={2.8} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </motion.div>

      {/* ── Chat Panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="chatbot-panel"
            role="dialog"
            aria-label="SwasthyaScan AI Assistant"
            aria-modal="true"
            initial={{ opacity: 0, y: 36, scale: 0.90 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.93 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            className="cb-panel"
          >
            {/* Aurora mesh background */}
            <div className="cb-aurora" aria-hidden="true">
              <div className="cb-aurora-blob cb-aurora-blob-1" />
              <div className="cb-aurora-blob cb-aurora-blob-2" />
              <div className="cb-aurora-blob cb-aurora-blob-3" />
            </div>

            {/* Top brand shimmer line */}
            <div className="cb-top-line" />

            {/* ── Header ── */}
            <div className="cb-header">
              {/* Avatar */}
              <div className="cb-header-avatar">
                <div className="cb-header-avatar-ring" />
                <img
                  src="/swasthyascan-avatar.png"
                  alt="SwasthyaScan"
                  className="cb-header-avatar-img"
                />
                {isOnline === true && <div className="cb-header-avatar-badge" />}
              </div>

              {/* Title */}
              <div className="cb-header-info">
                <div className="cb-header-name-row">
                  <span className="cb-header-name">SwasthyaScan AI</span>
                  <span className="cb-header-pill">{t.chatbot.assistantBadge}</span>
                </div>
                <div className="cb-header-status">
                  {isOnline === true && (
                    <span className="cb-status-online">
                      <span className="cb-status-dot" />
                      {t.chatbot.liveStatus}
                    </span>
                  )}
                  {isOnline === false && (
                    <span className="cb-status-offline">⚠ {t.chatbot.offlineStatus}</span>
                  )}
                  {isOnline === null && (
                    <span className="cb-status-connecting">Connecting…</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="cb-header-actions">
                <button aria-label="Clear chat" title="Clear" onClick={clearChat} className="cb-icon-btn">
                  <Trash2 size={14} />
                </button>
                <button
                  aria-label="Close"
                  title="Close (Esc)"
                  onClick={() => { setOpen(false); buttonRef.current?.focus() }}
                  className="cb-icon-btn cb-icon-btn-close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* ── Message List ── */}
            <div ref={listRef} className="cb-messages">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className={`cb-msg-wrap ${msg.role === 'user' ? 'cb-msg-user' : 'cb-msg-bot'}`}
                >
                  {/* Bot label */}
                  {msg.role === 'assistant' && (
                    <div className="cb-msg-bot-label">
                      <Bot size={11} />
                      <span>SwasthyaScan</span>
                    </div>
                  )}

                  {/* Bubble */}
                  <div className={`cb-bubble ${msg.role === 'user' ? 'cb-bubble-user' : msg.error ? 'cb-bubble-error' : 'cb-bubble-bot'}`}>
                    {msg.error && (
                      <span className="cb-error-header">
                        <AlertCircle size={13} /> Attention
                      </span>
                    )}
                    <div className="cb-bubble-content">
                      {renderFormattedContent(msg.content)}
                    </div>

                    {msg.error && msg.failedPrompt && (
                      <button
                        onClick={() => sendMessage(msg.failedPrompt!)}
                        className="cb-retry-btn"
                      >
                        <RotateCcw size={11} /> {t.chatbot.retry}
                      </button>
                    )}
                  </div>

                  <span className="cb-msg-time">{formatTime(msg.timestamp)}</span>
                </motion.div>
              ))}

              {/* Typing wave indicator */}
              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="cb-msg-wrap cb-msg-bot"
                >
                  <div className="cb-msg-bot-label">
                    <Bot size={11} />
                    <span>SwasthyaScan</span>
                  </div>
                  <div className="cb-bubble cb-bubble-bot cb-typing-bubble">
                    <div className="cb-wave">
                      {[0,1,2,3,4].map(i => (
                        <span key={i} className="cb-wave-bar" style={{ animationDelay: `${i * 0.08}s` }} />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* ── Suggestion Chips (Bento grid) ── */}
            {messages.length === 1 && !loading && (
              <div className="cb-chips-wrap">
                <div className="cb-chips-label">
                  <Sparkles size={11} />
                  <span>{t.chatbot.suggestedTitle}</span>
                </div>
                <div className="cb-chips-grid">
                  {t.chatbot.chips.map((chip, i) => (
                    <motion.button
                      key={chip.text}
                      onClick={() => sendMessage(chip.text)}
                      className="cb-chip"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.96 }}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                    >
                      <span className="cb-chip-icon">{CHIP_ICONS[i % CHIP_ICONS.length]}</span>
                      <span className="cb-chip-label">{chip.text}</span>
                      <div className="cb-chip-shimmer" />
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Input Bar ── */}
            <div className="cb-input-wrap">
              <div className="cb-input-island">
                <textarea
                  ref={inputRef}
                  aria-label="Type your message"
                  placeholder={t.chatbot.inputPlaceholder}
                  value={input}
                  rows={1}
                  maxLength={MAX_CHARS}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  className="cb-textarea"
                />
                <div className="cb-input-right">
                  {input.length > 0 && (
                    <span className={`cb-char-count ${charWarn ? 'warn' : ''}`}>{charsLeft}</span>
                  )}
                  <motion.button
                    aria-label="Send"
                    onClick={() => sendMessage(input)}
                    disabled={loading || !input.trim()}
                    whileHover={!loading && input.trim() ? { scale: 1.1 } : {}}
                    whileTap={!loading && input.trim() ? { scale: 0.9 } : {}}
                    className={`cb-send-btn ${input.trim() && !loading ? 'cb-send-active' : ''}`}
                  >
                    {loading ? <Loader2 size={15} className="cb-spin" /> : <Send size={14} />}
                  </motion.button>
                </div>
              </div>

              <div className="cb-input-footer">
                <span className="cb-hint">{t.chatbot.hint}</span>
                <span className="cb-powered">
                  <Zap size={9} />
                  Groq AI
                </span>
              </div>
            </div>

            {/* ── Disclaimer ── */}
            <div className="cb-disclaimer">
              <Shield size={11} />
              <span>{t.chatbot.disclaimer}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Styles ── */}
      <style>{`
        /* ════════════════════════════════════════════
           LAUNCHER
        ════════════════════════════════════════════ */
        .cb-launcher {
          bottom: 2rem;
          right: 2rem;
          position: fixed;
        }

        /* Halo rings */
        .cb-halo {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          pointer-events: none;
          border: 1.5px solid rgba(255, 107, 74, 0.5);
        }
        .cb-halo-1 { animation: cbHalo 3s cubic-bezier(0.25,1,0.5,1) infinite; }
        .cb-halo-2 { animation: cbHalo 3s cubic-bezier(0.25,1,0.5,1) 1.4s infinite; }
        @keyframes cbHalo {
          0%   { transform: scale(0.95); opacity: 0.9; }
          100% { transform: scale(1.55); opacity: 0; }
        }

        /* Floating particles */
        .cb-particle {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          background: linear-gradient(135deg, #FF6B4A, #E040A0);
        }
        .cb-p1 {
          width: 7px; height: 7px;
          top: -12px; left: 50%;
          animation: cbFloat 3.2s ease-in-out infinite;
          box-shadow: 0 0 8px rgba(255,107,74,0.9);
        }
        .cb-p2 {
          width: 5px; height: 5px;
          top: 20%; left: -14px;
          animation: cbFloat 2.8s ease-in-out 0.7s infinite;
          box-shadow: 0 0 6px rgba(224,64,160,0.9);
        }
        .cb-p3 {
          width: 4px; height: 4px;
          bottom: 10%; right: -10px;
          animation: cbFloat 3.5s ease-in-out 1.4s infinite;
          box-shadow: 0 0 5px rgba(255,77,109,0.9);
        }
        @keyframes cbFloat {
          0%,100% { transform: translateY(0) scale(1); opacity: 0.8; }
          50%      { transform: translateY(-9px) scale(1.15); opacity: 1; }
        }

        /* Tooltip */
        .cb-tooltip {
          position: absolute;
          right: calc(100% + 16px);
          top: 50%;
          transform: translateY(-50%);
          white-space: nowrap;
          background: rgba(14, 11, 10, 0.95);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 107, 74, 0.4);
          border-radius: 22px;
          padding: 8px 16px;
          font-size: 12.5px;
          font-weight: 600;
          color: #FAF6F4;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(255,107,74,0.2);
          pointer-events: none;
          font-family: var(--font-body, Inter, sans-serif);
        }
        .cb-tooltip-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #4ADE80;
          box-shadow: 0 0 8px rgba(74,222,128,0.9);
          animation: greenPulse 2s infinite;
          flex-shrink: 0;
        }
        .cb-tooltip-arrow {
          position: absolute;
          right: -6px;
          top: 50%;
          transform: translateY(-50%);
          width: 0; height: 0;
          border-top: 5px solid transparent;
          border-bottom: 5px solid transparent;
          border-left: 6px solid rgba(255,107,74,0.4);
        }

        /* Orb Button */
        .cb-orb-btn {
          width: 96px; height: 96px;
          border-radius: 50%;
          cursor: pointer;
          padding: 0;
          overflow: hidden;
          position: relative;
          display: block;
          border: none;
          background: #0A0807;
          box-shadow:
            0 0 0 2px rgba(255,107,74,0.5),
            0 0 30px rgba(255,107,74,0.45),
            0 12px 40px rgba(0,0,0,0.7);
          transition: box-shadow 0.35s cubic-bezier(0.16,1,0.3,1);
        }
        .cb-orb-btn:hover {
          box-shadow:
            0 0 0 3px rgba(255,107,74,0.7),
            0 0 50px rgba(255,107,74,0.6),
            0 20px 50px rgba(0,0,0,0.7);
        }

        /* Spinning gradient ring */
        .cb-orb-ring-spin {
          position: absolute;
          inset: -2px;
          border-radius: 50%;
          background: conic-gradient(
            from 0deg,
            #FF6B4A 0%,
            #FF4D6D 33%,
            #E040A0 66%,
            #FF6B4A 100%
          );
          animation: cbSpin 4s linear infinite;
          z-index: 0;
        }
        @keyframes cbSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        /* Inner glow */
        .cb-orb-inner-glow {
          position: absolute;
          inset: 2px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, rgba(255,107,74,0.25) 0%, #0A0807 60%);
          z-index: 1;
        }

        .cb-orb-media {
          position: absolute;
          inset: 2px;
          width: calc(100% - 4px);
          height: calc(100% - 4px);
          object-fit: cover;
          border-radius: 50%;
          z-index: 2;
        }

        .cb-orb-close-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(10, 8, 7, 0.85);
          backdrop-filter: blur(10px);
          border-radius: 50%;
          z-index: 3;
          color: #FF6B4A;
        }

        /* ════════════════════════════════════════════
           PANEL
        ════════════════════════════════════════════ */
        .cb-panel {
          position: fixed;
          z-index: 999;
          display: flex;
          flex-direction: column;
          bottom: calc(2rem + 96px + 16px);
          right: 2rem;
          width: min(420px, calc(100vw - 2rem));
          max-height: 74vh;
          background: rgba(12, 9, 8, 0.92);
          backdrop-filter: blur(40px) saturate(180%);
          -webkit-backdrop-filter: blur(40px) saturate(180%);
          border: 1px solid rgba(255, 107, 74, 0.2);
          border-radius: 28px;
          overflow: hidden;
          box-shadow:
            0 40px 100px rgba(0,0,0,0.9),
            0 0 0 1px rgba(255,255,255,0.07),
            0 0 60px rgba(255,107,74,0.12),
            inset 0 1px 0 rgba(255,255,255,0.08);
          font-family: var(--font-body, Inter, sans-serif);
        }

        /* Aurora blobs */
        .cb-aurora {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          border-radius: inherit;
          z-index: 0;
        }
        .cb-aurora-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(60px);
          opacity: 0.08;
          animation: cbAuroraMove 8s ease-in-out infinite alternate;
        }
        .cb-aurora-blob-1 {
          width: 200px; height: 200px;
          background: #FF6B4A;
          top: -60px; left: -60px;
          animation-delay: 0s;
        }
        .cb-aurora-blob-2 {
          width: 160px; height: 160px;
          background: #E040A0;
          top: 40%; right: -40px;
          animation-delay: 2.5s;
        }
        .cb-aurora-blob-3 {
          width: 140px; height: 140px;
          background: #FF4D6D;
          bottom: -40px; left: 30%;
          animation-delay: 5s;
        }
        @keyframes cbAuroraMove {
          0%   { transform: translate(0, 0) scale(1); }
          100% { transform: translate(20px, 20px) scale(1.1); }
        }

        /* Top shimmer line */
        .cb-top-line {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent 0%, #FF6B4A 25%, #FF4D6D 55%, #E040A0 80%, transparent 100%);
          box-shadow: 0 0 20px rgba(255,107,74,0.9);
          z-index: 10;
          animation: cbShimmer 3s linear infinite;
          background-size: 200% 100%;
        }
        @keyframes cbShimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        /* ── Header ── */
        .cb-header {
          position: relative;
          z-index: 5;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 18px 18px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          background: linear-gradient(180deg, rgba(255,107,74,0.07) 0%, rgba(0,0,0,0) 100%);
          flex-shrink: 0;
        }
        .cb-header-avatar {
          position: relative;
          width: 44px; height: 44px;
          flex-shrink: 0;
        }
        .cb-header-avatar-ring {
          position: absolute;
          inset: -2px;
          border-radius: 50%;
          background: conic-gradient(from 0deg, #FF6B4A, #FF4D6D, #E040A0, #FF6B4A);
          animation: cbSpin 4s linear infinite;
          z-index: 0;
        }
        .cb-header-avatar-img {
          position: absolute;
          inset: 2px;
          width: calc(100% - 4px);
          height: calc(100% - 4px);
          object-fit: cover;
          border-radius: 50%;
          z-index: 1;
          background: #0E0B0A;
        }
        .cb-header-avatar-badge {
          position: absolute;
          bottom: 1px; right: 1px;
          width: 11px; height: 11px;
          border-radius: 50%;
          background: #4ADE80;
          border: 2px solid #0A0807;
          box-shadow: 0 0 8px rgba(74,222,128,0.9);
          z-index: 2;
          animation: greenPulse 2s infinite;
        }
        .cb-header-info { flex: 1; min-width: 0; }
        .cb-header-name-row {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-wrap: wrap;
        }
        .cb-header-name {
          font-weight: 800;
          font-size: 15px;
          font-family: var(--font-display, 'Bricolage Grotesque', sans-serif);
          color: #FAF6F4;
          letter-spacing: -0.02em;
        }
        .cb-header-pill {
          font-size: 9px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 20px;
          background: linear-gradient(135deg, rgba(255,107,74,0.2), rgba(224,64,160,0.15));
          border: 1px solid rgba(255,107,74,0.35);
          color: #FFC2A8;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          font-family: var(--font-mono, 'JetBrains Mono', monospace);
        }
        .cb-header-status { margin-top: 3px; }
        .cb-status-online {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: #4ADE80;
          font-weight: 500;
        }
        .cb-status-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #4ADE80;
          box-shadow: 0 0 8px rgba(74,222,128,1);
          animation: greenPulse 2s infinite;
          flex-shrink: 0;
        }
        .cb-status-offline {
          font-size: 11px;
          color: #FB7185;
          font-weight: 500;
        }
        .cb-status-connecting {
          font-size: 11px;
          color: rgba(255,255,255,0.35);
        }
        .cb-header-actions {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
        }
        .cb-icon-btn {
          width: 32px; height: 32px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.45);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }
        .cb-icon-btn:hover {
          background: rgba(255,107,74,0.15);
          border-color: rgba(255,107,74,0.4);
          color: #FF6B4A;
          transform: scale(1.08);
        }
        .cb-icon-btn-close:hover {
          background: rgba(251,113,133,0.15) !important;
          border-color: rgba(251,113,133,0.4) !important;
          color: #FB7185 !important;
        }

        /* ── Messages ── */
        .cb-messages {
          position: relative;
          z-index: 5;
          flex: 1;
          overflow-y: auto;
          padding: 16px 16px 10px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,107,74,0.2) transparent;
        }
        .cb-messages::-webkit-scrollbar { width: 4px; }
        .cb-messages::-webkit-scrollbar-track { background: transparent; }
        .cb-messages::-webkit-scrollbar-thumb {
          background: rgba(255,107,74,0.3);
          border-radius: 4px;
        }

        .cb-msg-wrap {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .cb-msg-user  { align-items: flex-end; }
        .cb-msg-bot   { align-items: flex-start; }

        .cb-msg-bot-label {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          font-weight: 700;
          color: rgba(255,107,74,0.85);
          padding-left: 4px;
          margin-bottom: 2px;
          font-family: var(--font-mono, monospace);
          letter-spacing: 0.3px;
        }

        .cb-bubble {
          max-width: 90%;
          padding: 12px 16px;
          font-size: 13px;
          line-height: 1.65;
          word-break: break-word;
        }
        .cb-bubble-user {
          background: linear-gradient(125deg, #FF8A5B 0%, #FF4D6D 55%, #D63BAA 100%);
          border-radius: 20px 20px 5px 20px;
          color: #FAF6F4;
          box-shadow: 0 6px 24px rgba(255,107,74,0.4), inset 0 1px 0 rgba(255,255,255,0.25);
          border: 1px solid rgba(255,255,255,0.2);
        }
        .cb-bubble-bot {
          background: linear-gradient(145deg, rgba(26,21,19,0.95) 0%, rgba(16,12,11,0.98) 100%);
          border-radius: 5px 20px 20px 20px;
          color: #FAF6F4;
          border: 1px solid rgba(255,107,74,0.18);
          box-shadow: 0 8px 28px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04);
        }
        .cb-bubble-error {
          background: rgba(251,113,133,0.1);
          border: 1px solid rgba(251,113,133,0.35);
          border-radius: 5px 20px 20px 20px;
          color: #FECDD3;
          box-shadow: 0 4px 16px rgba(251,113,133,0.15);
        }
        .cb-bubble-content { display: flex; flex-direction: column; gap: 1px; }
        .cb-error-header {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 7px;
          font-weight: 700;
          font-size: 12px;
          color: #FB7185;
        }
        .cb-retry-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          margin-top: 10px;
          padding: 5px 12px;
          border-radius: 10px;
          background: rgba(251,113,133,0.15);
          border: 1px solid rgba(251,113,133,0.4);
          color: #FECDD3;
          font-size: 11.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .cb-retry-btn:hover {
          background: rgba(251,113,133,0.28);
          transform: translateY(-1px);
        }
        .cb-msg-time {
          font-size: 9.5px;
          color: rgba(255,255,255,0.22);
          padding-inline: 6px;
          font-family: var(--font-mono, monospace);
        }

        /* Wave typing indicator */
        .cb-typing-bubble { padding: 14px 18px !important; }
        .cb-wave {
          display: flex;
          align-items: flex-end;
          gap: 3px;
          height: 18px;
        }
        .cb-wave-bar {
          display: block;
          width: 3px;
          border-radius: 3px;
          background: linear-gradient(to top, #FF6B4A, #E040A0);
          animation: cbWave 1.1s ease-in-out infinite;
          box-shadow: 0 0 6px rgba(255,107,74,0.7);
        }
        @keyframes cbWave {
          0%, 100% { height: 4px;  opacity: 0.4; }
          50%       { height: 18px; opacity: 1;   }
        }

        /* ── Chips ── */
        .cb-chips-wrap {
          position: relative;
          z-index: 5;
          padding: 8px 14px 12px;
          flex-shrink: 0;
        }
        .cb-chips-label {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          font-weight: 700;
          color: rgba(255,107,74,0.8);
          text-transform: uppercase;
          letter-spacing: 0.7px;
          margin-bottom: 8px;
          font-family: var(--font-mono, monospace);
        }
        .cb-chips-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 7px;
        }
        .cb-chip {
          position: relative;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: rgba(255,107,74,0.07);
          border: 1px solid rgba(255,107,74,0.2);
          border-radius: 14px;
          cursor: pointer;
          text-align: left;
          overflow: hidden;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }
        .cb-chip:hover {
          background: rgba(255,107,74,0.15);
          border-color: rgba(255,107,74,0.5);
          box-shadow: 0 6px 24px rgba(255,107,74,0.25);
        }
        .cb-chip-icon {
          color: #FF6B4A;
          flex-shrink: 0;
          display: flex;
          align-items: center;
        }
        .cb-chip-label {
          font-size: 11.5px;
          font-weight: 600;
          color: #FAF6F4;
          line-height: 1.3;
          flex: 1;
        }
        /* Shimmer on hover */
        .cb-chip-shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.07) 50%, transparent 60%);
          background-size: 200% 100%;
          background-position: -200% 0;
          border-radius: inherit;
          pointer-events: none;
          transition: background-position 0.5s ease;
        }
        .cb-chip:hover .cb-chip-shimmer {
          background-position: 200% 0;
        }

        /* ── Input Bar ── */
        .cb-input-wrap {
          position: relative;
          z-index: 5;
          padding: 10px 14px 8px;
          border-top: 1px solid rgba(255,255,255,0.07);
          background: rgba(10,8,7,0.6);
          flex-shrink: 0;
        }
        .cb-input-island {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(22,17,15,0.9);
          border: 1.5px solid rgba(255,107,74,0.22);
          border-radius: 18px;
          padding: 8px 8px 8px 16px;
          box-shadow: inset 0 2px 8px rgba(0,0,0,0.4);
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .cb-input-island:focus-within {
          border-color: rgba(255,107,74,0.6);
          box-shadow:
            0 0 0 3px rgba(255,107,74,0.12),
            0 0 24px rgba(255,107,74,0.2),
            inset 0 2px 8px rgba(0,0,0,0.4);
        }
        .cb-textarea {
          flex: 1;
          resize: none;
          background: transparent;
          border: none;
          color: #FAF6F4;
          font-size: 13px;
          font-family: inherit;
          outline: none;
          max-height: 90px;
          line-height: 1.55;
          padding: 2px 0;
          scrollbar-width: none;
        }
        .cb-textarea::placeholder { color: rgba(255,255,255,0.28); }
        .cb-input-right {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-shrink: 0;
        }
        .cb-char-count {
          font-size: 10px;
          font-weight: 600;
          color: rgba(255,255,255,0.3);
          font-family: var(--font-mono, monospace);
          padding: 2px 6px;
          border-radius: 6px;
          background: rgba(255,255,255,0.05);
        }
        .cb-char-count.warn { color: #FB7185; }
        .cb-send-btn {
          width: 38px; height: 38px;
          border-radius: 13px;
          border: none;
          background: rgba(255,255,255,0.07);
          color: rgba(255,255,255,0.25);
          cursor: not-allowed;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.22s ease;
          flex-shrink: 0;
        }
        .cb-send-active {
          background: linear-gradient(125deg, #FF8A5B 0%, #FF4D6D 55%, #D63BAA 100%);
          color: #FAF6F4;
          cursor: pointer;
          box-shadow: 0 0 20px rgba(255,107,74,0.55);
        }
        .cb-send-active:hover {
          box-shadow: 0 0 32px rgba(255,107,74,0.9);
          filter: brightness(1.12);
        }
        .cb-input-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 6px;
          padding-inline: 4px;
        }
        .cb-hint {
          font-size: 10px;
          color: rgba(255,255,255,0.25);
        }
        .cb-powered {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          font-weight: 600;
          color: #FFC2A8;
          font-family: var(--font-mono, monospace);
        }
        .cb-powered svg { color: #FF6B4A; }

        /* ── Disclaimer ── */
        .cb-disclaimer {
          position: relative;
          z-index: 5;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          gap: 6px;
          padding: 7px 16px 10px;
          font-size: 10px;
          color: rgba(255,255,255,0.28);
          text-align: center;
          line-height: 1.5;
          border-top: 1px solid rgba(255,255,255,0.04);
          background: rgba(10,8,7,0.4);
          flex-shrink: 0;
        }
        .cb-disclaimer svg {
          color: rgba(255,107,74,0.7);
          flex-shrink: 0;
          margin-top: 1px;
        }

        /* ── Shared Animations ── */
        @keyframes greenPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.25); }
        }
        .cb-spin {
          animation: cbSpinAnim 1s linear infinite;
        }
        @keyframes cbSpinAnim {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        /* ── Mobile ── */
        @media (max-width: 640px) {
          .cb-launcher {
            bottom: max(1.25rem, env(safe-area-inset-bottom, 1.25rem));
            right: max(1.25rem, env(safe-area-inset-right, 1.25rem));
          }
          .cb-orb-btn { width: 72px; height: 72px; }
          .cb-panel {
            bottom: 0 !important;
            right: 0 !important;
            left: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            border-radius: 24px 24px 0 0 !important;
            max-height: 82vh !important;
          }
          .cb-chips-grid { grid-template-columns: 1fr; }
        }

        /* ── Reduced Motion ── */
        @media (prefers-reduced-motion: reduce) {
          .cb-halo,
          .cb-particle,
          .cb-orb-ring-spin,
          .cb-header-avatar-ring,
          .cb-top-line,
          .cb-aurora-blob { animation: none !important; }
        }
      `}</style>
    </>
  )
}

export default ChatBot
