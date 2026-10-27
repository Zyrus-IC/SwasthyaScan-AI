import React, { useState, useId } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, AlertCircle } from 'lucide-react'

/* ─────────────────────────────────────────────────────────────
   Input — Ember Noir styled input with:
   • Floating label animation
   • Glowing focus border (ember)
   • Animated validation icon (success / error)
   • glass-input base styling
───────────────────────────────────────────────────────────── */

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  valid?: boolean
  icon?: React.ReactNode
}

export function Input({
  label,
  error,
  hint,
  valid,
  icon,
  className = '',
  value,
  defaultValue,
  ...props
}: InputProps) {
  const id = useId()
  const [focused, setFocused] = useState(false)
  const hasValue = value !== undefined ? String(value).length > 0
    : defaultValue !== undefined ? String(defaultValue).length > 0
    : false

  const isFloating = focused || hasValue

  return (
    <div className="w-full">
      <div className="relative">
        {/* Floating label */}
        {label && (
          <motion.label
            htmlFor={id}
            className="absolute z-10 pointer-events-none select-none"
            animate={{
              top:      isFloating ? 6 : '50%',
              fontSize: isFloating ? '0.65rem' : '0.875rem',
              y:        isFloating ? 0 : '-50%',
              color:    focused
                ? 'rgba(255,107,74,0.90)'
                : isFloating
                  ? 'rgba(250,246,244,0.55)'
                  : 'rgba(250,246,244,0.45)',
            }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ left: icon ? 40 : 16, letterSpacing: isFloating ? '0.06em' : 0 }}
          >
            {label}
          </motion.label>
        )}

        {/* Icon */}
        {icon && (
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: focused ? 'var(--ember)' : 'var(--text-muted)', transition: 'color 0.2s' }}
          >
            {icon}
          </span>
        )}

        {/* Input element */}
        <input
          id={id}
          className={[
            'input glass-input rounded-[var(--r-sm)]',
            label ? 'pt-6 pb-2' : '',
            icon ? 'pl-10' : '',
            error ? 'input-error' : valid ? 'input-valid' : '',
            className,
          ].filter(Boolean).join(' ')}
          value={value}
          defaultValue={defaultValue}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />

        {/* Validation icon */}
        <AnimatePresence>
          {(valid || error) && (
            <motion.span
              className="absolute right-3 top-1/2 -translate-y-1/2"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
            >
              {valid && !error && <Check size={14} style={{ color: '#4ADE80' }} />}
              {error && <AlertCircle size={14} style={{ color: '#FB7185' }} />}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Error / hint text */}
      <AnimatePresence>
        {(error || hint) && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="mt-1.5 text-xs font-mono"
            style={{ color: error ? '#FB7185' : 'var(--text-muted)' }}
          >
            {error || hint}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Textarea
───────────────────────────────────────────────────────────── */
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export function Textarea({ label, error, hint, className = '', ...props }: TextareaProps) {
  const id = useId()
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-mono mb-1.5"
          style={{ color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}
        >
          {label}
        </label>
      )}
      <textarea
        id={id}
        className={['input glass-input rounded-[var(--r-sm)] resize-none', error ? 'input-error' : '', className].filter(Boolean).join(' ')}
        {...props}
      />
      {(error || hint) && (
        <p className="mt-1.5 text-xs font-mono" style={{ color: error ? '#FB7185' : 'var(--text-muted)' }}>
          {error || hint}
        </p>
      )}
    </div>
  )
}
