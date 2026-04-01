import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageList } from './MessageList'

const MESSAGES = [
  { id: 1, role: 'user',  text: 'Hello',    timestamp: '2026-03-23T10:00:00Z' },
  { id: 2, role: 'agent', text: 'Hi there', timestamp: '2026-03-23T10:01:00Z' },
  { id: 3, role: 'error', text: 'Oops',     timestamp: '2026-03-23T10:02:00Z' },
]

describe('MessageList', () => {
  it('renders all messages', () => {
    render(<MessageList messages={MESSAGES} />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('Hi there')).toBeInTheDocument()
    expect(screen.getByText('Oops')).toBeInTheDocument()
  })

  it('renders without crashing when messages is empty', () => {
    const { container } = render(<MessageList messages={[]} />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('renders messages in order', () => {
    const { container } = render(<MessageList messages={MESSAGES} />)
    const bubbles = container.querySelectorAll('.message__text')
    expect(bubbles[0].textContent).toBe('Hello')
    expect(bubbles[1].textContent).toBe('Hi there')
  })
})
