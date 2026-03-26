// Message.test.jsx
//
// render() mounts a React component into a virtual DOM.
// screen.getByText() finds elements by their text content.
// screen.queryByText() is like getByText but returns null instead of throwing.
// toHaveClass() checks that an element has a specific CSS class.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Message } from './Message'

const TIMESTAMP = '2026-03-23T10:05:00.000Z'

describe('Message', () => {
  it('renders the message text', () => {
    render(<Message role="user" text="Hello there!" timestamp={TIMESTAMP} />)
    expect(screen.getByText('Hello there!')).toBeInTheDocument()
  })

  it('applies message--user class for user role', () => {
    const { container } = render(<Message role="user" text="hi" timestamp={TIMESTAMP} />)
    expect(container.firstChild).toHaveClass('message--user')
  })

  it('applies message--agent class for agent role', () => {
    const { container } = render(<Message role="agent" text="hi" timestamp={TIMESTAMP} />)
    expect(container.firstChild).toHaveClass('message--agent')
  })

  it('applies message--error class for error role', () => {
    const { container } = render(<Message role="error" text="oops" timestamp={TIMESTAMP} />)
    expect(container.firstChild).toHaveClass('message--error')
  })

  it('renders a formatted time (not raw ISO string)', () => {
    render(<Message role="user" text="hi" timestamp={TIMESTAMP} />)
    // The raw ISO string should not appear — it should be formatted
    expect(screen.queryByText(TIMESTAMP)).not.toBeInTheDocument()
  })
})
