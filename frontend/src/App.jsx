// App.jsx — the root of the React component tree.
//
// This is the top-level component that everything else lives inside.
// It's intentionally minimal: structural layout only, no business logic.
//
// Responsibilities:
//   1. Render the main chat interface (ChatWindow)
//   2. Own the open/closed state for the feature request form
//   3. Conditionally render RequestForm when open

import { useState } from 'react'
import { ChatWindow } from './features/chat/ChatWindow'
import { RequestForm } from './features/requests/RequestForm'
import './App.css'

export default function App() {
  // isRequestFormOpen controls whether the RequestForm is currently shown.
  // false = form is not in the DOM at all (unmounted, not just hidden).
  // This means every time it opens, it's a fresh component with reset state.
  const [isRequestFormOpen, setIsRequestFormOpen] = useState(false)

  return (
    <div className="app">
      {/* The main chat interface — always visible */}
      <ChatWindow />

      {/* Button to open the feature request form */}
      <button
        className="app__request-button"
        onClick={() => setIsRequestFormOpen(true)}
      >
        Submit Feature Request
      </button>

      {/* Conditionally render the form.
          When isRequestFormOpen is false, this component is fully unmounted —
          React discards it from the DOM and its state resets automatically.
          {condition && <Component />} is React's idiomatic conditional render. */}
      {isRequestFormOpen && (
        <RequestForm onClose={() => setIsRequestFormOpen(false)} />
      )}
    </div>
  )
}
