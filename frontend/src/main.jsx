// main.jsx — the entry point for the React application.
//
// This file is the bridge between index.html and your React code.
// Vite compiles everything starting from this file.

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// Bootstrap's compiled CSS — this gives us the full design system:
// grid, utilities (d-flex, p-3, text-warning, etc.), components (card, btn, modal).
// Importing from the npm package means Vite bundles it with the rest of the app.
import 'bootstrap/dist/css/bootstrap.min.css'
import './index.css'

// ReactDOM.createRoot() creates a React "root" — a managed DOM subtree.
// We pass it the #root div from index.html.
// Everything React renders goes inside that div.
ReactDOM.createRoot(document.getElementById('root')).render(
  // StrictMode is a development-only tool.
  // It intentionally renders components twice to catch side effects
  // that should not happen during rendering (like direct DOM mutations).
  // It has ZERO effect on production builds.
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
