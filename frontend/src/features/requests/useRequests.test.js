import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRequests } from './useRequests'

describe('useRequests', () => {
  it('starts with all state false', () => {
    const { result } = renderHook(() => useRequests())
    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.submitted).toBe(false)
    expect(result.current.error).toBe(false)
  })

  it('sets submitted to true after stubbed submit completes', async () => {
    const { result } = renderHook(() => useRequests())

    await act(async () => {
      await result.current.submit({ title: 'Dark mode', description: 'Please add it' })
    })

    expect(result.current.submitted).toBe(true)
    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.error).toBe(false)
  })

  it('sets error to true when submit throws', async () => {
    const { result } = renderHook(() => useRequests())

    // Temporarily spy on setTimeout to make the stub throw instead of resolving.
    // We replace the stub behaviour by spying on Promise to force a rejection.
    // Simplest approach: patch the hook's internal setTimeout via vi.spyOn.
    vi.spyOn(globalThis, 'setTimeout').mockImplementationOnce((fn) => {
      throw new Error('simulated failure')
    })

    await act(async () => {
      await result.current.submit({ title: 'Test', description: 'Test' })
    })

    expect(result.current.error).toBe(true)
    expect(result.current.submitted).toBe(false)
    expect(result.current.isSubmitting).toBe(false)

    vi.restoreAllMocks()
  })
})
