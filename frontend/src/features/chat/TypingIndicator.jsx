/**
 * TypingIndicator — shows animated dots and the current pipeline step.
 * @param {{ step: string|null }} props
 */
export function TypingIndicator({ step }) {
  return (
    <div className="message message--agent">
      <div className="message__text typing-indicator" aria-label={step ?? 'Thinking…'}>
        <span className="typing-indicator__dot" />
        <span className="typing-indicator__dot" />
        <span className="typing-indicator__dot" />
        {step && <span className="typing-indicator__step">{step}</span>}
      </div>
    </div>
  )
}
