import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './app/app.css'
import { AppView } from './app/App.view.tsx'
import { Providers } from './app/Providers.tsx'
import { createQueryClient } from './app/query-client.ts'
import { installLogging, logger } from './shared/observability/logger.ts'

installLogging({ target: window, intervalMs: 3000 })
logger.info({ msg: 'ui.started', userAgent: navigator.userAgent })

const root = document.getElementById('root')
if (root === null) throw new Error('Missing #root element')

createRoot(root).render(
  <StrictMode>
    <Providers queryClient={createQueryClient()}>
      <AppView />
    </Providers>
  </StrictMode>,
)
