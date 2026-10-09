import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App.tsx'
import { fetchConfig } from './api.ts'
import { t } from './i18n.ts'

document.title = t('app.title')
document.documentElement.lang = t('intl.locale')

// Only one locale ships for now; the setting is read so a mismatch shows up in the console.
fetchConfig()
  .then(({ locale }) => console.info(`[audio-logger] locale: ${locale}`))
  .catch(() => console.warn('[audio-logger] could not read /api/config'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
