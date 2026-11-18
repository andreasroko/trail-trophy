import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './data/auth.jsx'
import './index.css'

// Matches Vite's `base`: "/" locally, "/trail-trophy" on GitHub Pages
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/" element={<App />} />
        {/* Unknown paths land on the app instead of a dead end */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>,
)
