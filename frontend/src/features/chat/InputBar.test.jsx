// InputBar.test.jsx
//
// userEvent from @testing-library/user-event simulates real user interactions
// (typing, clicking, pressing Enter). It's more realistic than fireEvent.

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InputBar } from './InputBar'

describe('InputBar', () => {
  it('calls onSend with the trimmed input text when Send is clicked', async () => {
    const onSend = vi.fn()
    render(<InputBar onSend={onSend} isLoading={false} />)

    await userEvent.type(screen.getByRole('textbox'), 'What is trample?')
    await userEvent.click(screen.getByRole('button', { name: /send/i }))

    expect(onSend).toHaveBeenCalledWith('What is trample?')
  })

  it('calls onSend when Enter key is pressed', async () => {
    const onSend = vi.fn()
    render(<InputBar onSend={onSend} isLoading={false} />)

    await userEvent.type(screen.getByRole('textbox'), 'test message{Enter}')

    expect(onSend).toHaveBeenCalledWith('test message')
  })

  it('clears the input after sending', async () => {
    render(<InputBar onSend={vi.fn()} isLoading={false} />)
    const input = screen.getByRole('textbox')

    await userEvent.type(input, 'Hello')
    await userEvent.click(screen.getByRole('button', { name: /send/i }))

    expect(input).toHaveValue('')
  })

  it('disables the input and button when isLoading is true', () => {
    render(<InputBar onSend={vi.fn()} isLoading={true} />)

    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('shows "Thinking..." button text when isLoading is true', () => {
    render(<InputBar onSend={vi.fn()} isLoading={true} />)
    expect(screen.getByRole('button')).toHaveTextContent('Thinking...')
  })

  it('disables the send button when input is empty', () => {
    render(<InputBar onSend={vi.fn()} isLoading={false} />)
    // Input starts empty — button should be disabled
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })

  it('does not call onSend for whitespace-only input', async () => {
    const onSend = vi.fn()
    render(<InputBar onSend={onSend} isLoading={false} />)

    await userEvent.type(screen.getByRole('textbox'), '   {Enter}')

    expect(onSend).not.toHaveBeenCalled()
  })
})

describe('InputBar quota', () => {
  it('disables input and button when isBlocked is true', () => {
    render(<InputBar onSend={vi.fn()} isLoading={false} isBlocked={true} quotaLine="Daily limit reached. Resets at midnight UTC." />)
    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('shows quota line text when provided', () => {
    render(<InputBar onSend={vi.fn()} isLoading={false} isBlocked={false} quotaLine="15 / 30 requests used today" />)
    expect(screen.getByText('15 / 30 requests used today')).toBeDefined()
  })

  it('does not show quota line when quotaLine is null', () => {
    render(<InputBar onSend={vi.fn()} isLoading={false} isBlocked={false} quotaLine={null} />)
    expect(screen.queryByText(/requests used today/i)).toBeNull()
  })
})
