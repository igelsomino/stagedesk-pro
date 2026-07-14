import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthGate } from './AuthGate.tsx'
import { diagnosticLog } from './diagnostics.ts'

const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
diagnosticLog('page-boot', {
  navigationType: navigationEntry?.type ?? 'unknown',
  visibilityState: document.visibilityState,
  url: window.location.href,
})

window.addEventListener('pageshow', (event) => diagnosticLog('page-show', { persisted: event.persisted }))
window.addEventListener('pagehide', (event) => diagnosticLog('page-hide', { persisted: event.persisted }))
window.addEventListener('focus', () => diagnosticLog('window-focus'))
window.addEventListener('blur', () => diagnosticLog('window-blur'))
document.addEventListener('visibilitychange', () => diagnosticLog('visibility-change', { state: document.visibilityState }))

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', (payload) => {
    diagnosticLog('vite-before-update', {
      updates: payload.updates?.map((update) => update.path),
    })
  })
  import.meta.hot.on('vite:afterUpdate', () => diagnosticLog('vite-after-update'))
  import.meta.hot.on('vite:beforeFullReload', (payload) => diagnosticLog('vite-before-full-reload', { path: payload.path }))
  import.meta.hot.on('vite:error', (payload) => diagnosticLog('vite-error', { message: payload.err?.message }))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </StrictMode>,
)
