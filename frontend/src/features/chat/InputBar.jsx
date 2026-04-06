import { useState } from 'react'

/**
 * @param {{
 *   onSend: (text: string) => void,
 *   isLoading: boolean,
 *   isBlocked?: boolean,
 *   quotaLine?: string | null,
 *   onFormatChange?: (format: string) => void
 * }} props
 */
export function InputBar({ onSend, isLoading, isBlocked = false, quotaLine = null, onFormatChange }) {
  const [inputText, setInputText] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = inputText.trim()
    if (!trimmed) return
    onSend(trimmed)
    setInputText('')
  }

  const isDisabled = isLoading || isBlocked

  return (
    <div>
      <form className="d-flex gap-2 p-3 border-top" onSubmit={handleSubmit}>
        <input
          className="form-control"
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder="Ask a rules question..."
          disabled={isDisabled}
          aria-label="Message input"
        />
        <button
          className="btn btn-warning fw-bold"
          type="submit"
          disabled={isDisabled || !inputText.trim()}
          aria-label="Send message"
        >
          {isLoading ? 'Thinking...' : 'Send'}
        </button>
      </form>
      {quotaLine && (
        <p className={`px-3 pb-2 mb-0 small ${isBlocked ? 'text-danger' : 'text-secondary'}`}>
          {quotaLine}
        </p>
      )}
    </div>
  )
}
