// useRequests.js — manages feature request form state.
//
// Calls POST /api/requests, which forwards the submission to Discord via webhook.

import { useState } from 'react'
import { submitRequest } from '../../api/client'

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

  /** @param {{ title: string, description: string }} data */
  async function submit({ title, description }) {
    setIsSubmitting(true)
    setError(false)

    try {
      await submitRequest({ title, description })
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
