import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import App from './app/App.jsx'
import { ThemeProvider } from './hooks/useTheme.jsx'
import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/leaflet-overrides.css'
import './components/ui/ui.css'
import './styles/map.css'
import './styles/report.css'
import './styles/pages.css'
import './styles/admin.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
)
