import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatWindow } from './ChatWindow'
import * as client from '../../api/client'

describe('ChatWindow', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the MTG Judge header', () => {
    render(<ChatWindow />)
    expect(screen.getByRole('heading', { name: /MTG Judge/i })).toBeInTheDocument()
  })

  it('renders the message input', () => {
    render(<ChatWindow />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('shows user message in the chat after submitting', async () => {
    vi.spyOn(client, 'askAgent').mockResolvedValue('You can respond.')
    vi.spyOn(client, 'trackUsage').mockImplementation(() => {})

    render(<ChatWindow />)

    await userEvent.type(screen.getByRole('textbox'), 'Can I cast a spell?')
    await userEvent.click(screen.getByRole('button', { name: /send/i }))

    expect(screen.getByText('Can I cast a spell?')).toBeInTheDocument()
  })

  it('shows agent response after the API resolves', async () => {
    vi.spyOn(client, 'askAgent').mockResolvedValue('Yes, you can.')
    vi.spyOn(client, 'trackUsage').mockImplementation(() => {})

    render(<ChatWindow />)

    await userEvent.type(screen.getByRole('textbox'), 'Can I cast?')
    await userEvent.click(screen.getByRole('button', { name: /send/i }))

    expect(screen.getByText('Yes, you can.')).toBeInTheDocument()
  })
})
