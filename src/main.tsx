import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthGuard } from './components/AuthGuard'

import { HashRouter } from 'react-router-dom'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AuthGuard>
        <App />
      </AuthGuard>
    </HashRouter>
  </StrictMode>,
)
