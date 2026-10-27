/**
 * ReportContext.tsx
 *
 * Lightweight React context to share the current scan report state
 * with the global ChatBot component. The ResultsPage writes to this
 * context; the ChatBot reads from it to provide report-aware responses.
 *
 * No sensitive data is stored beyond the current session.
 */

import React, { createContext, useContext, useState } from 'react'

interface ScanReport {
  status?: string
  prediction?: string
  score?: number
  message?: string
  limitations?: string[]
  review_reasons?: string[]
}

interface ReportContextValue {
  report: ScanReport | null
  setReport: (r: ScanReport | null) => void
}

const ReportContext = createContext<ReportContextValue>({
  report: null,
  setReport: () => {},
})

export const ReportProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [report, setReport] = useState<ScanReport | null>(null)
  return (
    <ReportContext.Provider value={{ report, setReport }}>
      {children}
    </ReportContext.Provider>
  )
}

export const useReport = () => useContext(ReportContext)
