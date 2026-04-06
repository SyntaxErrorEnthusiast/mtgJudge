import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminPage } from './AdminPage'
import * as client from '../../api/client'

vi.mock('../../api/client')

const mockStats = [
  {
    username: 'alice',
    message_count: 20,
    last_seen: '2026-04-06T10:00:00+00:00',
    daily_limit: 30,
    avg_per_day: 5.0,
  },
]

beforeEach(() => {
  vi.resetAllMocks()
  client.getAdminStats.mockResolvedValue(mockStats)
})

describe('AdminPage', () => {
  it('shows avg_per_day column', async () => {
    render(<AdminPage />)
    await waitFor(() => expect(screen.getByText('5')).toBeDefined())
    expect(screen.getByText(/avg\/day/i)).toBeDefined()
  })

  it('shows daily limit column', async () => {
    render(<AdminPage />)
    await waitFor(() => expect(screen.getByText('30')).toBeDefined())
    expect(screen.getByText(/limit/i)).toBeDefined()
  })

  it('shows edit button per row', async () => {
    render(<AdminPage />)
    await waitFor(() => screen.getByRole('button', { name: /edit/i }))
    expect(screen.getByRole('button', { name: /edit/i })).toBeDefined()
  })

  it('saves new limit when save is clicked', async () => {
    client.setUserRateLimit.mockResolvedValue(undefined)
    render(<AdminPage />)

    await waitFor(() => screen.getByRole('button', { name: /edit/i }))
    await userEvent.click(screen.getByRole('button', { name: /edit/i }))

    const input = screen.getByRole('spinbutton')
    await userEvent.clear(input)
    await userEvent.type(input, '50')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(client.setUserRateLimit).toHaveBeenCalledWith('alice', 50))
  })
})
