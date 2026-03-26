import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// vite.config.js — Vite configuration file.
//
// Vite is both a dev server and a build tool.
// This file configures:
//   1. Which plugins to use (React JSX transformation)
//   2. The dev server proxy (so /api/* hits your FastAPI)
//   3. Vitest (the test runner) settings

export default defineConfig({
  plugins: [react()],

  // Why this block exists:
  // Vitest 3 bundles its own Vite v7 internally for running tests.
  // The project uses @vitejs/plugin-react v6 (which targets Vite v8),
  // so Vitest's internal Vite v7 pipeline doesn't pick up the plugin's
  // Babel JSX configuration. Without this esbuild block, JSX in test
  // files causes "React is not defined" errors.
  // This tells esbuild (used by Vitest's Vite v7) how to handle JSX.
  esbuild: {
    jsxImportSource: 'react',
    jsx: 'automatic',
  },

  server: {
    // The proxy rewrites any request starting with /api
    // to your FastAPI backend running on port 8000.
    //
    // Example: fetch('/api/ask') in your React code becomes
    //          http://localhost:8000/ask behind the scenes.
    //
    // Why? Browsers block cross-origin requests (CORS) unless
    // the server explicitly allows them. The proxy sidesteps this
    // in development by making both frontend and API appear to
    // come from the same origin (localhost:5173).
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        // changeOrigin: true rewrites the Host header on the proxied request
        // to match the target (localhost:8000). Some servers reject requests
        // whose Host header doesn't match their own address — this prevents that.
        changeOrigin: true,
        // Strip the /api prefix before forwarding.
        // /api/ask → /ask (which FastAPI handles)
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },

  // Vitest configuration — the test runner for Vite projects.
  // Vitest uses the same config as Vite, so you don't need a separate file.
  test: {
    // jsdom simulates a browser DOM environment for testing React components.
    // Without this, document.getElementById() and similar calls would fail.
    environment: 'jsdom',

    // globals: true lets you use describe/it/expect without importing them.
    // It mimics Jest's global API — fewer imports in every test file.
    globals: true,

    // Run this file before every test suite (before each test file).
    setupFiles: './src/test-setup.js',

    // Exit cleanly when no test files exist yet (avoids non-zero exit code).
    passWithNoTests: true,
  },
})
