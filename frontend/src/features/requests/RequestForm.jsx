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
  const [title, setTitle]             = useState('')
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
    // Bootstrap modal backdrop pattern:
    //   position-fixed inset-0 — covers the whole viewport
    //   d-flex align-items-center justify-content-center — centres the dialog
    //   bg-black bg-opacity-50 — semi-transparent dark overlay
    //   z-index is set inline so it always sits above everything else
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1050 }}
    >
      {/* Bootstrap modal-dialog sizing. The card gives us the border/shadow. */}
      <div className="card p-4" style={{ minWidth: '420px', maxWidth: '90vw' }}>
        <h5 className="card-title text-warning mb-3">Submit a Feature Request</h5>

        {submitted ? (
          // Show this instead of the form once submitted.
          // The component will auto-close after 1500ms (see useEffect above).
          <p className="text-success fw-semibold">Request submitted! Thank you.</p>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* mb-3 adds bottom margin between each field group.
                htmlFor on <label> and id on <input> must match — this links them
                so clicking the label focuses the input, and screen readers know
                which label describes which input. */}
            <div className="mb-3">
              <label htmlFor="req-title" className="form-label small text-secondary">
                Title
              </label>
              <input
                id="req-title"
                type="text"
                className="form-control"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="mb-3">
              <label htmlFor="req-description" className="form-label small text-secondary">
                Description
              </label>
              <textarea
                id="req-description"
                className="form-control"
                style={{ minHeight: '90px', resize: 'vertical' }}
                value={description}
                onChange={e => setDescription(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            <button
              type="submit"
              className="btn btn-warning fw-bold"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>

            {/* Error message — only rendered when error is true.
                Lives below the submit button as specified in the design. */}
            {error && (
              <p className="text-danger small mt-2 mb-0">
                Failed to submit. Please try again.
              </p>
            )}
          </form>
        )}

        {/* btn-outline-secondary for a low-key close button that doesn't compete
            with the Submit action. d-block mt-3 adds separation from the form. */}
        <button
          className="btn btn-outline-secondary btn-sm mt-3"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  )
}
