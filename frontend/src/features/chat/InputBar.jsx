// InputBar.jsx — the text input and Send button at the bottom of the chat.
//
// Props:
//   onSend    — called with the message text when the user submits
//   isLoading — true while waiting for the agent response
//
// Why is inputText local state here instead of in useChat?
//   What the user is currently typing is only relevant to this component.
//   Lifting it up to useChat would couple two unrelated concerns.
//   Keep state as local as possible — only lift it up when other components need it.

import { useState } from 'react'

/**
 * @param {{ onSend: (text: string) => void, isLoading: boolean }} props
 */
export function InputBar({ onSend, isLoading }) {
  // inputText is the controlled value of the <input> element.
  // "Controlled" means React owns the value — the input always reflects this state.
  const [inputText, setInputText] = useState('')

  function handleSubmit(e) {
    // Prevent the browser's default form submit behaviour (which would reload the page).
    e.preventDefault()

    const trimmed = inputText.trim()

    // Guard: don't send blank messages.
    // The button is also disabled for this case, but a double-check here is harmless.
    if (!trimmed) return

    onSend(trimmed)    // Pass the text up to the parent (useChat via ChatWindow)
    setInputText('')   // Clear the input field after sending
  }

  return (
    // Using <form> + onSubmit means both button clicks AND the Enter key trigger handleSubmit.
    // This is standard HTML behaviour — no extra key listener needed.
    <form className="input-bar" onSubmit={handleSubmit}>
      <input
        className="input-bar__input"
        type="text"
        value={inputText}
        onChange={e => setInputText(e.target.value)}
        placeholder="Ask a rules question..."
        disabled={isLoading}
        aria-label="Message input"
      />
      <button
        className="input-bar__button"
        type="submit"
        // Disabled when loading (waiting for response) OR when input is blank.
        disabled={isLoading || !inputText.trim()}
        aria-label="Send message"
      >
        {/* Show "Thinking..." while loading, "Send" otherwise */}
        {isLoading ? 'Thinking...' : 'Send'}
      </button>
    </form>
  )
}
