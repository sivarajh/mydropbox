import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The GitHub Pages URL for this repo is https://<user>.github.io/mydropbox/
// so all assets and routes must be served from the /mydropbox/ base path.
// Override with VITE_BASE=/ when serving from a custom domain or root.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/mydropbox/',
})
