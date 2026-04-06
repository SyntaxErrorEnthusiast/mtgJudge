import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useQuota } from './useQuota'
import * as client from '../../api/client'

vi.mock('../../api/client')

const mockQuota = { used: 5, limit: 30, reset_at: '2026-04-07T00:00:00+00:00', is_admin: false }

beforeEach(() => {
  vi.resetAllMocks()
})

describe('useQuota', () => {
  it('fetches quota on mount', async () => {
    client.getQuota.mockResolvedValue(mockQuota)
    const { result } = renderHook(() => useQuota())

    await waitFor(() => expect(result.current.quota).not.toBeNull())

    expect(result.current.quota.used).toBe(5)
    expect(result.current.quota.limit).toBe(30)
    expect(result.current.isBlocked).toBe(false)
  })

  it('sets isBlocked when used >= limit', async () => {
    client.getQuota.mockResolvedValue({ ...mockQuota, used: 30, limit: 30 })
    const { result } = renderHook(() => useQuota())

    await waitFor(() => expect(result.current.isBlocked).toBe(true))
  })

  it('isBlocked is false for admins even when over limit', async () => {
    client.getQuota.mockResolvedValue({ used: 999, limit: null, reset_at: null, is_admin: true })
    const { result } = renderHook(() => useQuota())

    await waitFor(() => expect(result.current.quota).not.toBeNull())
    expect(result.current.isBlocked).toBe(false)
  })

  it('updateFromAskResponse updates quota state', async () => {
    client.getQuota.mockResolvedValue(mockQuota)
    const { result } = renderHook(() => useQuota())

    await waitFor(() => expect(result.current.quota).not.toBeNull())

    act(() => {
      result.current.updateFromAskResponse({ used: 10, limit: 30, reset_at: '2026-04-07T00:00:00+00:00', is_admin: false })
    })

    expect(result.current.quota.used).toBe(10)
  })

  it('silently handles fetch errors', async () => {
    client.getQuota.mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useQuota())

    // After a tick, quota is still null but no crash
    await waitFor(() => expect(result.current.quota).toBeNull())
    expect(result.current.isBlocked).toBe(false)
  })
})
