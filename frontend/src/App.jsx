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
    // .app caps the max-width (see App.css). Bootstrap utilities handle the rest:
    //   d-flex flex-column — vertical stack
    //   vh-100             — fill the full viewport height
    //   mx-auto            — centre horizontally
    //   px-3 py-3 gap-2    — padding and spacing between children
    <div className="app d-flex flex-column vh-100 mx-auto px-3 py-3 gap-2">
      {/* The main chat interface — always visible */}
      <ChatWindow />

      {/* Button to open the feature request form.
          align-self-end pushes it to the right edge of the flex column.
          btn-outline-secondary gives a subtle look that doesn't compete with Send. */}
      <button
        className="btn btn-outline-secondary btn-sm align-self-end"
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
