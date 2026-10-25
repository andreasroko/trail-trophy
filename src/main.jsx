import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './data/auth.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* "/" new or demo hike · "/h/:id" one of your saved hikes · "/t/:slug" public share link */}
          <Route path="/" element={<App />} />
          <Route path="/h/:hikeId" element={<App />} />
          <Route path="/t/:shareSlug" element={<App />} />
          <Route path="*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>,
)
