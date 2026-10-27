import React, { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'

import { Navbar }           from './components/Navbar'
import { ScrollProgressBar } from './components/ScrollProgressBar'
import { CustomCursor }     from './components/CustomCursor'
import { ChatBot }          from './components/ChatBot'
import { useSmoothScroll }  from './hooks/useSmoothScroll'
import { useReport }        from './hooks/ReportContext'
import { LandingPage }      from './pages/LandingPage'
import { DashboardPage }    from './pages/DashboardPage'
import { ScreeningPage }    from './pages/ScreeningPage'
import { ResultsPage }      from './pages/ResultsPage'
import { AboutPage }        from './pages/AboutPage'
import { DesignSystemPage } from './pages/DesignSystemPage'

// Environment pages
import { JoinEnvironmentPage }    from './pages/env/JoinEnvironmentPage'
import { ConsentPage }            from './pages/env/ConsentPage'
import { PatientSubmissionPage }  from './pages/env/PatientSubmissionPage'
import { PatientConfirmationPage } from './pages/env/PatientConfirmationPage'
import { DoctorPortalPage }       from './pages/doctor/DoctorPortalPage'
import { DoctorDashboardPage }    from './pages/doctor/DoctorDashboardPage'
import { SubmissionDetailPage }   from './pages/doctor/SubmissionDetailPage'

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.25, ease: 'easeIn' } },
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    if (pathname === '/') {
      const snap = document.querySelector('.snap-container')
      if (snap) { snap.scrollTop = 0; return }
    }
    const lenis = (window as Record<string, unknown>).lenis as
      { scrollTo?: (target: number, opts?: Record<string, unknown>) => void } | undefined
    if (lenis?.scrollTo) {
      lenis.scrollTo(0, { immediate: true })
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    }
  }, [pathname])
  return null
}

function App() {
  const location  = useLocation()
  const isLanding = location.pathname === '/'
  const { report } = useReport()

  // Env pages don't need smooth scroll
  const isEnvPage = location.pathname.startsWith('/env/')
  useSmoothScroll(isLanding || isEnvPage)

  return (
    <>
      <CustomCursor />
      {!isLanding && <ScrollProgressBar />}
      <Navbar />
      <ScrollToTop />
      <ChatBot report={report} />

      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <Routes location={location}>
            {/* ── Core pages ── */}
            <Route path="/"             element={<LandingPage />}      />
            <Route path="/dashboard"    element={<DashboardPage />}    />
            <Route path="/screening"    element={<ScreeningPage />}    />
            <Route path="/results"      element={<ResultsPage />}      />
            <Route path="/about"        element={<AboutPage />}        />
            <Route path="/design-system" element={<DesignSystemPage />} />

            {/* ── Patient flow ── */}
            <Route path="/env/join"           element={<JoinEnvironmentPage />}    />
            <Route path="/env/consent"        element={<ConsentPage />}            />
            <Route path="/env/patient-submit" element={<PatientSubmissionPage />}  />
            <Route path="/env/confirmation"   element={<PatientConfirmationPage />} />

            {/* ── Doctor flow ── */}
            <Route path="/env/doctor"                        element={<DoctorPortalPage />}      />
            <Route path="/env/doctor/dashboard"              element={<DoctorDashboardPage />}   />
            <Route path="/env/doctor/submission/:subId"      element={<SubmissionDetailPage />}  />

            {/* 404 */}
            <Route path="*" element={
              <div className="min-h-screen flex items-center justify-center"
                style={{ background: 'var(--bg-base)' }}>
                <div className="text-center">
                  <p className="text-8xl font-bold gradient-text mb-4">404</p>
                  <p className="text-xl mb-8" style={{ color: 'var(--text-muted)' }}>Page not found</p>
                  <a href="/" className="text-sm font-medium" style={{ color: 'var(--ember)' }}>
                    ← Back to home
                  </a>
                </div>
              </div>
            } />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </>
  )
}

export default App
