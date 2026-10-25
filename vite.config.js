import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the site from /<repo>/; everywhere else (dev, Vercel, Netlify) from /
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/trail-trophy/' : '/',
  plugins: [react()],
})
