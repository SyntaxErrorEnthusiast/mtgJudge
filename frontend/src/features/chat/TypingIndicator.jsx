/**
 * TypingIndicator — three animated dots in an agent-style bubble,
 * mimicking the "someone is typing" indicator in messaging apps.
 */
export function TypingIndicator() {
  return (
    <div className="message message--agent">
      <div className="message__text typing-indicator" aria-label="Thinking…">
        <span className="typing-indicator__dot" />
        <span className="typing-indicator__dot" />
        <span className="typing-indicator__dot" />
      </div>
    </div>
  )
}
