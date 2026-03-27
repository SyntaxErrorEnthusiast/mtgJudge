// Message.jsx — renders a single chat message bubble.
//
// Props:
//   role      — "user" | "agent" | "error"
//   text      — the message content
//   timestamp — ISO 8601 string (e.g. "2026-03-23T10:00:00Z")
//
// The role prop drives both alignment (via CSS class) and meaning:
//   user  → right-aligned, the human's message
//   agent → left-aligned, the AI's response
//   error → highlighted, something went wrong
//
// We keep the semantic message--{role} classes so CSS rules and tests
// can target them reliably. Bootstrap utilities then handle spacing.

/**
 * @param {{ role: string, text: string, timestamp: string }} props
 */
export function Message({ role, text, timestamp }) {
  // Format the ISO timestamp into a short, readable time like "10:05 AM".
  // toLocaleTimeString uses the browser's locale settings automatically.
  const formattedTime = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  // The CSS class is dynamic: message--user, message--agent, or message--error.
  // This drives all visual differences (alignment, colour) through CSS,
  // keeping the component logic clean and making restyling easy later.
  return (
    <div className={`message message--${role}`}>
      <p className="message__text">{text}</p>
      <span className="message__time">{formattedTime}</span>
    </div>
  )
}
