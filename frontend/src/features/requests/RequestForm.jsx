// RequestForm.jsx — form for submitting feature requests.
//
// Props:
//   onClose — called when the form should close
//
// This component is currently wired to a stubbed submit function.
// The full UI works: you can fill in the form and see a success message.
// It just doesn't reach a real backend yet.
//
// Note on unmounting vs hiding:
//   App.jsx conditionally renders this component (not just hides it with CSS).
//   When isRequestFormOpen becomes false, React unmounts this component entirely.
//   That means React automatically discards all local state (title, description).
//   When it reopens, it mounts fresh — no manual reset needed.

import { useEffect, useState } from 'react'
import { useRequests } from './useRequests'

/**
 * @param {{ onClose: () => void }} props
 */
export function RequestForm({ onClose }) {
  const { submit, isSubmitting, submitted, error } = useRequests()

  // These are controlled inputs — React owns their values.
  const [title, setTitle]           = useState('')
  const [description, setDescription] = useState('')

  // Auto-close after 1500ms once submitted successfully.
  // useEffect with [submitted, onClose] runs whenever submitted or onClose changes.
  useEffect(() => {
    if (!submitted) return

    // setTimeout returns a timer ID we can use to cancel it.
    const timer = setTimeout(onClose, 1500)

    // The cleanup function runs if the component unmounts before the timer fires.
    // Without this, calling onClose on an unmounted component would cause a React warning.
    return () => clearTimeout(timer)
  }, [submitted, onClose])

  function handleSubmit(e) {
    e.preventDefault()
    submit({ title, description })
  }

  return (
    // Overlay: covers the screen behind the form
    <div className="request-form-overlay">
      <div className="request-form">
        <h2>Submit a Feature Request</h2>

        {submitted ? (
          // Show this instead of the form once submitted.
          // The component will auto-close after 1500ms (see useEffect above).
          <p className="request-form__success">Request submitted! Thank you.</p>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* htmlFor on <label> and id on <input> must match.
                This links them so clicking the label focuses the input,
                and screen readers know which label describes which input. */}
            <label htmlFor="req-title">Title</label>
            <input
              id="req-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              disabled={isSubmitting}
            />

            <label htmlFor="req-description">Description</label>
            <textarea
              id="req-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
              disabled={isSubmitting}
            />

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>

            {/* Error message — only rendered when error is true.
                Lives below the submit button as specified in the design. */}
            {error && (
              <p className="request-form__error">Failed to submit. Please try again.</p>
            )}
          </form>
        )}

        <button className="request-form__close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
