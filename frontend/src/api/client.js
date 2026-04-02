// client.js — the single place where all HTTP calls to the backend live.
//
// Why centralise API calls here?
//   - If the backend URL or auth headers change, you update ONE file.
//   - Components and hooks never need to know about fetch(), JSON, or HTTP status codes.
//   - Easy to mock in tests — import this file and replace its exports with vi.spyOn().

// BASE_URL is empty in development because Vite's proxy rewrites /api/* for us.
// In production on the NAS, Authentik/Nginx handles routing — still no change needed.
const BASE_URL = ''

// ---------------------------------------------------------------------------
// askAgent — send a question to the MTG Judge agent
// ---------------------------------------------------------------------------

/**
 * POST /api/ask
 *
 * @param {string} message
 * @param {string} format
 * @param {Array<{role: string, content: string}>} history
 * @returns {Promise<{response: string, retrieved_rules: Array<{rule_number: string, text: string}>}>}
 */
export async function askAgent(message, format = 'commander', history = []) {
  const response = await fetch(`${BASE_URL}/api/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, format, history }),
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }

  const data = await response.json()
  return {
    response: data.response,
    retrieved_rules: data.retrieved_rules ?? [],
  }
}

// ---------------------------------------------------------------------------
// trackUsage — fire-and-forget usage ping
// ---------------------------------------------------------------------------

/**
 * POST /api/usage
 *
 * Tracks that a user sent a message. This is "fire-and-forget":
 *   - We do NOT await it (the caller doesn't wait for it to finish)
 *   - Errors are caught and silently ignored inside this function
 *   - A broken usage ping must NEVER interrupt the user's chat experience
 *
 * NOTE: The /usage backend endpoint does not exist yet.
 * Once it's built, this function will start sending real data automatically.
 *
 * @param {string} timestamp - ISO 8601 string of when the user sent their message
 */
export function trackUsage(timestamp) {
  // We use an async IIFE (Immediately Invoked Function Expression) so we can
  // use async/await inside without making trackUsage itself return a Promise.
  // The semicolon before (async... prevents ASI (Automatic Semicolon Insertion)
  // issues if this file is ever minified.
  ;(async () => {
    try {
      await fetch(`${BASE_URL}/api/usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp }),
      })
    } catch {
      // Silently swallow all errors.
      // Real failures will appear in server-side logs once the backend is built.
    }
  })()
  // trackUsage returns undefined — callers don't need to await or handle this.
}

// ---------------------------------------------------------------------------
// submitRequest — STUBBED, backend not yet implemented
// ---------------------------------------------------------------------------

/**
 * POST /api/requests
 *
 * STUBBED: This function is defined but NOT called yet.
 * The /requests backend endpoint does not exist.
 *
 * When the backend is ready:
 *   1. Remove the stub error below
 *   2. Uncomment the real fetch call
 *   3. Wire useRequests.js to call this function instead of its internal stub
 *
 * @param {{ title: string, description: string }} data
 * @returns {Promise<void>}
 */
export async function submitRequest(data) {
  const response = await fetch(`${BASE_URL}/api/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) throw new Error(`API error: ${response.status}`)
}
