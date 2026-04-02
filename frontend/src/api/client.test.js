// client.test.js — tests for the API client module.
//
// We test client.js by mocking globalThis.fetch — the browser's built-in
// HTTP function. This lets us simulate API responses without a real server.
//
// vi.fn() creates a "mock function" that we can program with fake behavior.
// vi.restoreAllMocks() resets all mocks between tests so they don't bleed over.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { askAgent, trackUsage } from './client'

describe('askAgent', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('POSTs the message and returns the response object', async () => {
    // mockResolvedValue makes fetch() return a resolved Promise with this value.
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'You can respond to a spell.', retrieved_rules: [] }),
    })

    const result = await askAgent('Can I respond to a spell?')

    expect(fetch).toHaveBeenCalledWith('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Can I respond to a spell?', format: 'commander', history: [] }),
    })
    expect(result).toEqual({ response: 'You can respond to a spell.', retrieved_rules: [] })
  })

  it('throws when the response is not ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })

    // rejects.toThrow() asserts that the promise rejects with a matching error.
    await expect(askAgent('test')).rejects.toThrow('API error: 500')
  })
})

describe('trackUsage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('fires a POST to /api/usage and returns undefined (fire-and-forget)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true })

    const result = trackUsage('2026-03-23T10:00:00Z')

    // trackUsage is fire-and-forget — it does NOT return a Promise.
    expect(result).toBeUndefined()

    // Wait one microtask tick for the internal async IIFE to fire.
    await new Promise(r => setTimeout(r, 0))

    expect(fetch).toHaveBeenCalledWith('/api/usage', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ timestamp: '2026-03-23T10:00:00Z' }),
    }))
  })

  it('does not throw when fetch rejects', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network error'))

    // This should not throw — errors are silently swallowed inside client.js.
    expect(() => trackUsage('2026-03-23T10:00:00Z')).not.toThrow()

    // Wait a tick for the internal async IIFE to fire.
    await new Promise(r => setTimeout(r, 0))

    // Confirm fetch was actually called (not silently skipped).
    expect(fetch).toHaveBeenCalled()
  })
})
