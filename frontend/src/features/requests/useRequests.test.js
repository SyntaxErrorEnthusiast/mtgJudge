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
})
