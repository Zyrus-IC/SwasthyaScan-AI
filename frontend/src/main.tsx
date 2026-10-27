/* Self-hosted fonts via @fontsource — no CDN, font-display: swap built-in */

/* ── Display: Bricolage Grotesque 700 + 800 ─────────────────── */
import '@fontsource/bricolage-grotesque/700.css'
import '@fontsource/bricolage-grotesque/800.css'

/* ── Body: Inter 400, 500, 600 ──────────────────────────────── */
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'

/* ── Mono: JetBrains Mono 400, 500 ─────────────────────────── */
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'

import './index.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ReportProvider } from './hooks/ReportContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ReportProvider>
        <App />
      </ReportProvider>
    </BrowserRouter>
  </React.StrictMode>
)
