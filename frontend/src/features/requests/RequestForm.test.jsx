// RequestForm.test.jsx
//
// waitFor() retries the assertion until it passes or times out.
// We use it for async state changes (like the success message appearing
// after the 500ms stub delay).

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RequestForm } from './RequestForm'

describe('RequestForm', () => {
  it('renders title and description fields', () => {
    render(<RequestForm onClose={vi.fn()} />)
    expect(screen.getByLabelText('Title')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
  })

  it('renders a Close button', () => {
    render(<RequestForm onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  it('calls onClose when Close is clicked', async () => {
    const onClose = vi.fn()
    render(<RequestForm onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows success message after form is submitted', async () => {
    render(<RequestForm onClose={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Title'), 'Dark mode')
    await userEvent.type(screen.getByLabelText('Description'), 'Please add it')
    await userEvent.click(screen.getByRole('button', { name: /^submit$/i }))

    await waitFor(() => {
      expect(screen.getByText('Request submitted! Thank you.')).toBeInTheDocument()
    })
  })
})
