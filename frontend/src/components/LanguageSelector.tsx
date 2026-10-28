import React from 'react'
import { motion } from 'framer-motion'
import { Globe } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import type { Language } from '../context/LanguageContext'

const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'hi', label: 'हिंदी' },
]

export const LanguageSelector: React.FC = () => {
  const { language, setLanguage } = useLanguage()

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        padding: '3px 6px',
        borderRadius: 999,
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(16px)',
      }}
      aria-label="Select Language"
    >
      <Globe size={13} style={{ color: 'var(--ember)', opacity: 0.9, marginLeft: 3, marginRight: 2 }} />
      {LANGUAGES.map(item => {
        const isActive = language === item.code
        return (
          <button
            key={item.code}
            onClick={() => setLanguage(item.code)}
            style={{
              position: 'relative',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '3px 8px',
              fontSize: 11.5,
              fontWeight: isActive ? 650 : 500,
              color: isActive ? '#FAF6F4' : 'var(--text-muted)',
              borderRadius: 999,
              transition: 'color 0.2s ease',
              outline: 'none',
              fontFamily: 'var(--font-body)',
            }}
          >
            {isActive && (
              <motion.div
                layoutId="activeLangPill"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 999,
                  background: 'linear-gradient(135deg, rgba(255, 107, 74, 0.35) 0%, rgba(255, 77, 109, 0.35) 100%)',
                  border: '1px solid rgba(255, 107, 74, 0.55)',
                  boxShadow: '0 0 12px rgba(255, 107, 74, 0.3)',
                  zIndex: -1,
                }}
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              />
            )}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
