// useRequests.js — manages feature request form state.
//
// STUBBED: The /requests backend endpoint does not exist yet.
//
// What "stubbed" means here:
//   submit() simulates a successful API call (waits 500ms, then sets submitted=true).
//   This lets the full UI work end-to-end during development without a real backend.
//
// When the backend is ready:
//   1. Import submitRequest from '../../api/client'
//   2. Replace the stub block in submit() with: await submitRequest({ title, description })
//   3. Remove the console.log and fake timeout
//   4. The rest of the hook stays the same

import { useState } from 'react'

/**
 * useRequests — manages feature request form state.
 *
 * Returns:
 *   submit      — async function to submit { title, description }
 *   isSubmitting — true while the submit is in-flight
 *   submitted   — true after a successful submit
 *   error       — true if the submit failed
 */
export function useRequests() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted]       = useState(false)
  const [error, setError]               = useState(false)

  /**
   * Submit a feature request.
   * Currently stubbed — replace with real API call when backend is ready.
   *
   * @param {{ title: string, description: string }} data
   */
  async function submit({ title, description }) {
    setIsSubmitting(true)
    setError(false)

    try {
      // -------------------------------------------------------
      // STUB — remove this block when /api/requests is built
      console.log('[useRequests] Stub: feature request received:', { title, description })
      await new Promise(resolve => setTimeout(resolve, 500))
      // -------------------------------------------------------

      // REAL API CALL — uncomment when backend is ready:
      // import { submitRequest } from '../../api/client'
      // await submitRequest({ title, description })

      setSubmitted(true)

    } catch {
      // On real API failure, set error so RequestForm can show the error message.
      // submitted stays false so the user can try again.
      setError(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  return { submit, isSubmitting, submitted, error }
}
