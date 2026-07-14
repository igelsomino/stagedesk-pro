export const STAGEDESK_DIAGNOSTIC_LOG_KEY = 'stagedesk-pro.diagnostic-log'

export type DiagnosticLogEntry = {
  timestamp: string
  action: string
  details?: Record<string, unknown>
}

type DiagnosticWindow = Window & {
  __STAGEDESK_DIAGNOSTIC_LOGS__?: DiagnosticLogEntry[]
}

const sanitizeDetails = (details?: Record<string, unknown>) => {
  if (!details) return undefined
  try {
    return JSON.parse(JSON.stringify(details)) as Record<string, unknown>
  } catch {
    return { raw: String(details) }
  }
}

const readDiagnosticLogs = (): DiagnosticLogEntry[] => {
  try {
    const raw = window.localStorage.getItem(STAGEDESK_DIAGNOSTIC_LOG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as DiagnosticLogEntry[] : []
  } catch {
    return []
  }
}

export const diagnosticLog = (action: string, details?: Record<string, unknown>) => {
  if (typeof window === 'undefined') return
  const entry: DiagnosticLogEntry = {
    timestamp: new Date().toISOString(),
    action,
    details: sanitizeDetails(details),
  }
  const logs = [...readDiagnosticLogs(), entry].slice(-400)
  try {
    window.localStorage.setItem(STAGEDESK_DIAGNOSTIC_LOG_KEY, JSON.stringify(logs))
    ;(window as DiagnosticWindow).__STAGEDESK_DIAGNOSTIC_LOGS__ = logs
    document.documentElement.setAttribute('data-stagedesk-diagnostic-log', JSON.stringify(logs.slice(-20)))
  } catch {
    // Diagnostics must never interrupt editing or persistence.
  }
  console.info('[StageDesk diagnostic]', entry)
  window.dispatchEvent(new CustomEvent('stagedesk-diagnostic-log', { detail: entry }))
}
