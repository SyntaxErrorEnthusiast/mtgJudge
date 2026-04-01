// Message.jsx — renders a single chat message bubble.
//
// Agent messages are rendered through react-markdown so headers, bold,
// bullet lists, and the ## Sources block display correctly.
// User and error messages are plain text.

import ReactMarkdown from 'react-markdown'

/**
 * @param {{ role: string, text: string, timestamp: string }} props
 */
export function Message({ role, text, timestamp }) {
  const formattedTime = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className={`message message--${role}`}>
      {/* Use <div> not <p> — react-markdown outputs block elements (p, h2, ul)
          which cannot be nested inside a <p> tag. */}
      <div className="message__text">
        {role === 'agent' ? (
          <ReactMarkdown>{text}</ReactMarkdown>
        ) : (
          text
        )}
      </div>
      <span className="message__time">{formattedTime}</span>
    </div>
  )
}
