import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRequests } from './useRequests'

// useRequests now calls submitRequest which calls fetch.
// We mock fetch at the global level so no real HTTP requests are made.

describe('useRequests', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('starts with all state false', () => {
    const { result } = renderHook(() => useRequests())
    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.submitted).toBe(false)
    expect(result.current.error).toBe(false)
  })

  it('sets submitted to true after a successful submit', async () => {
    // Mock fetch to return a successful 204 response (what the backend sends back).
    globalThis.fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 204 })

    const { result } = renderHook(() => useRequests())

    await act(async () => {
      await result.current.submit({ title: 'Dark mode', description: 'Please add it' })
    })

    expect(fetch).toHaveBeenCalledWith('/api/requests', expect.objectContaining({
      method: 'POST',
    }))
    expect(result.current.submitted).toBe(true)
    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.error).toBe(false)
  })

  it('sets error to true when the request fails', async () => {
    // Mock fetch to return a non-ok response (e.g. 500 from the server).
    globalThis.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 500 })

    const { result } = renderHook(() => useRequests())

    await act(async () => {
      await result.current.submit({ title: 'Test', description: 'Test' })
    })

    expect(result.current.error).toBe(true)
    expect(result.current.submitted).toBe(false)
    expect(result.current.isSubmitting).toBe(false)
  })
})
