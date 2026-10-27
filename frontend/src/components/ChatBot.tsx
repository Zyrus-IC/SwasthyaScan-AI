/**
 * ChatBot.tsx — SwasthyaScan AI floating chatbot widget
 *
 * Features:
 * - Floating circular button at bottom-right
 * - Smooth open/close with Framer Motion
 * - Calls /api/chat (backend proxies to Groq — key never exposed)
 * - Report-aware: injects scan report context when available
 * - TB-topic focused, safety-conscious AI responses
 * - Loading indicator, retry, error state
 * - Suggested quick questions
 * - Mobile-responsive + reduced-motion support
 * - Accessible (focus trap, ARIA labels)
 */

import React, {
  useState, useRef, useEffect, useCallback, KeyboardEvent,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  MessageCircle, X, Send, Loader2, RefreshCw,
  AlertCircle, ChevronDown, Bot,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  error?: boolean
}

interface ScanReport {
  status?: string
  prediction?: string
  score?: number
  message?: string
  limitations?: string[]
  review_reasons?: string[]
}

interface ChatBotProps {
  /** Inject the current scan report for context-aware answers */
  report?: ScanReport | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API_URL = 'http://localhost:8000/api/chat'

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hi! I'm the SwasthyaScan AI Assistant. I can help explain your TB scan report, " +
    "answer Tuberculosis-related questions, and guide you toward appropriate next steps. " +
    "I provide educational information — not a confirmed diagnosis.",
  timestamp: new Date(),
}

const QUICK_QUESTIONS = [
  'Explain my TB scan report',
  'What are common TB symptoms?',
  'How is TB confirmed by a doctor?',
  'What should I do after this result?',
  'How does TB spread?',
]

const MAX_HISTORY = 10

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ChatBot: React.FC<ChatBotProps> = ({ report = null }) => {
  const [open, setOpen]           = useState(false)
  const [input, setInput]         = useState('')
  const [messages, setMessages]   = useState<Message[]>([WELCOME_MESSAGE])
  const [loading, setLoading]     = useState(false)
  const [groqAvailable, setGroqAvailable] = useState<boolean | null>(null)
  const listRef                   = useRef<HTMLDivElement>(null)
  const inputRef                  = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, open])

  // Focus input when panel opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [open])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: Message = {
      id: makeId(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    }

    // Optimistically add the user message
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // Build history (exclude welcome + last user msg)
    const history = messages
      .filter(m => m.id !== 'welcome' && !m.error)
      .slice(-MAX_HISTORY)
      .map(m => ({ role: m.role, content: m.content }))

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history,
          report: report ?? undefined,
        }),
        signal: AbortSignal.timeout(30_000),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }

      const data = await res.json()
      setGroqAvailable(data.groq_available ?? true)

      const botMsg: Message = {
        id: makeId(),
        role: 'assistant',
        content: data.reply || '(No response received)',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, botMsg])
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'TimeoutError'
      const errorMsg: Message = {
        id: makeId(),
        role: 'assistant',
        content: isTimeout
          ? 'The request timed out. Please try again.'
          : 'Something went wrong reaching the AI assistant. Please try again.',
        timestamp: new Date(),
        error: true,
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }, [loading, messages, report])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const clearConversation = () => {
    setMessages([WELCOME_MESSAGE])
    setGroqAvailable(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Floating trigger button */}
      <motion.button
        id="chatbot-trigger"
        aria-label="Open AI assistant"
        onClick={() => setOpen(o => !o)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.93 }}
        style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          zIndex: 1000,
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, var(--ember) 0%, var(--violet) 100%)',
          boxShadow: open
            ? '0 0 0 3px rgba(52,245,197,0.35), 0 8px 32px rgba(52,245,197,0.25)'
            : '0 4px 24px rgba(52,245,197,0.3)',
          transition: 'box-shadow 0.3s',
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <X size={22} color="#07080B" />
            </motion.span>
          ) : (
            <motion.span
              key="chat"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <MessageCircle size={22} color="#07080B" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="chatbot-panel"
            role="dialog"
            aria-label="SwasthyaScan AI Assistant"
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed',
              bottom: '5.5rem',
              right: '2rem',
              zIndex: 999,
              width: 'min(420px, calc(100vw - 2rem))',
              height: 'min(560px, calc(100vh - 7rem))',
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(14,17,22,0.97)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 20,
              boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '14px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              background: 'rgba(255,255,255,0.03)',
              flexShrink: 0,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'linear-gradient(135deg,var(--ember),var(--violet))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Bot size={18} color="#07080B" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                  SwasthyaScan AI Assistant
                </p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  TB Education &amp; Report Support
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  aria-label="Clear conversation"
                  onClick={clearConversation}
                  title="New conversation"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: 6, borderRadius: 8,
                    display: 'flex', alignItems: 'center', transition: 'color 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--ember)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  aria-label="Close chat"
                  onClick={() => setOpen(false)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: 6, borderRadius: 8,
                    display: 'flex', alignItems: 'center', transition: 'color 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>

            {/* Message list */}
            <div
              ref={listRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(255,255,255,0.1) transparent',
              }}
            >
              {messages.map(msg => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    gap: 4,
                  }}
                >
                  <div style={{
                    maxWidth: '85%',
                    padding: '10px 14px',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: msg.error
                      ? 'rgba(255,107,107,0.12)'
                      : msg.role === 'user'
                        ? 'linear-gradient(135deg,rgba(52,245,197,0.18),rgba(139,92,246,0.18))'
                        : 'rgba(255,255,255,0.05)',
                    border: msg.error
                      ? '1px solid rgba(255,107,107,0.3)'
                      : msg.role === 'user'
                        ? '1px solid rgba(52,245,197,0.2)'
                        : '1px solid rgba(255,255,255,0.07)',
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    color: msg.error ? '#FF9999' : 'var(--text-primary)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {msg.error && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                        <AlertCircle size={13} color="#FF6B6B" />
                      </span>
                    )}
                    {msg.content}
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', paddingInline: 4 }}>
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              ))}

              {/* Loading indicator */}
              {loading && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                  <div style={{
                    padding: '10px 14px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '16px 16px 16px 4px',
                    display: 'flex', gap: 5, alignItems: 'center',
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ember)', animation: 'chatDot 1.2s ease-in-out infinite' }} />
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ember)', animation: 'chatDot 1.2s ease-in-out 0.2s infinite' }} />
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ember)', animation: 'chatDot 1.2s ease-in-out 0.4s infinite' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Quick questions (shown when only welcome message) */}
            {messages.length === 1 && !loading && (
              <div style={{
                padding: '0 14px 10px',
                display: 'flex', flexWrap: 'wrap', gap: 6,
                flexShrink: 0,
              }}>
                {QUICK_QUESTIONS.map(q => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    style={{
                      background: 'rgba(52,245,197,0.07)',
                      border: '1px solid rgba(52,245,197,0.2)',
                      borderRadius: 20,
                      color: 'var(--ember)',
                      fontSize: 11,
                      padding: '5px 10px',
                      cursor: 'pointer',
                      transition: 'background 0.2s, border-color 0.2s',
                      fontFamily: 'var(--font-sans)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(52,245,197,0.15)'
                      e.currentTarget.style.borderColor = 'rgba(52,245,197,0.4)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(52,245,197,0.07)'
                      e.currentTarget.style.borderColor = 'rgba(52,245,197,0.2)'
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Groq unavailable notice */}
            {groqAvailable === false && (
              <div style={{
                margin: '0 14px 8px',
                padding: '8px 12px',
                background: 'rgba(251,191,36,0.08)',
                border: '1px solid rgba(251,191,36,0.2)',
                borderRadius: 10,
                fontSize: 11,
                color: '#FBBF24',
                flexShrink: 0,
              }}>
                ⚠ AI assistant not configured. Set GROQ_API_KEY in backend .env to enable.
              </div>
            )}

            {/* Input area */}
            <div style={{
              padding: '10px 14px 12px',
              borderTop: '1px solid rgba(255,255,255,0.07)',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-end',
              background: 'rgba(255,255,255,0.02)',
              flexShrink: 0,
            }}>
              <textarea
                ref={inputRef}
                id="chatbot-input"
                aria-label="Type your message"
                placeholder="Ask about TB or your scan report…"
                value={input}
                rows={1}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                style={{
                  flex: 1,
                  resize: 'none',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 12,
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  padding: '9px 12px',
                  fontFamily: 'var(--font-sans)',
                  outline: 'none',
                  maxHeight: 100,
                  lineHeight: 1.5,
                  transition: 'border-color 0.2s',
                  scrollbarWidth: 'none',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(52,245,197,0.35)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
              />
              <button
                id="chatbot-send"
                aria-label="Send message"
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                style={{
                  width: 38, height: 38,
                  borderRadius: 10,
                  border: 'none',
                  background: !input.trim() || loading
                    ? 'rgba(255,255,255,0.07)'
                    : 'linear-gradient(135deg,var(--ember),var(--violet))',
                  cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'background 0.2s, transform 0.15s',
                }}
                onMouseDown={e => { if (!loading && input.trim()) e.currentTarget.style.transform = 'scale(0.92)' }}
                onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                {loading
                  ? <Loader2 size={16} color="var(--text-muted)" style={{ animation: 'spin 1s linear infinite' }} />
                  : <Send size={16} color={input.trim() ? '#07080B' : 'var(--text-muted)'} />
                }
              </button>
            </div>

            {/* Safety disclaimer */}
            <p style={{
              margin: 0,
              padding: '0 14px 10px',
              fontSize: 10,
              color: 'var(--text-muted)',
              textAlign: 'center',
              lineHeight: 1.4,
              flexShrink: 0,
            }}>
              Educational information only — not a medical diagnosis.
              Always consult a healthcare professional.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dot animation keyframes */}
      <style>{`
        @keyframes chatDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1.1); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .chatDot { animation: none !important; }
        }
      `}</style>
    </>
  )
}
