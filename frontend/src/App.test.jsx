import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import * as client from './api/client'

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Stub client calls so App tests don't make real network requests
    vi.spyOn(client, 'askAgent').mockResolvedValue('ok')
    vi.spyOn(client, 'trackUsage').mockImplementation(() => {})
  })

  it('renders the chat window', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /MTG Judge/i })).toBeInTheDocument()
  })

  it('renders the Submit Feature Request button', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /submit feature request/i })).toBeInTheDocument()
  })

  it('shows the RequestForm when Submit Feature Request is clicked', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /submit feature request/i }))
    expect(screen.getByText('Submit a Feature Request')).toBeInTheDocument()
  })

  it('hides the RequestForm when Close is clicked', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /submit feature request/i }))
    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByText('Submit a Feature Request')).not.toBeInTheDocument()
  })
})
