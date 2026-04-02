import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'

// Regex matching "rule 702.19b" (case-insensitive, captures the number)
const RULE_CITATION_RE = /rule (\d+\.\d+[a-z]?)/i

/**
 * Custom react-markdown renderer that turns rule citation text into
 * clickable buttons that open the side panel.
 */
function makeCitationRenderer(onRuleClick) {
  return {
    p({ children }) {
      return <p>{processChildren(children, onRuleClick)}</p>
    },
    li({ children }) {
      return <li>{processChildren(children, onRuleClick)}</li>
    },
  }
}

function processChildren(children, onRuleClick) {
  if (!onRuleClick) return children
  return Array.isArray(children)
    ? children.map((child, i) =>
        typeof child === 'string' ? linkifyCitations(child, onRuleClick, i) : child
      )
    : typeof children === 'string'
    ? linkifyCitations(children, onRuleClick, 0)
    : children
}

function linkifyCitations(text, onRuleClick, keyBase) {
  const parts = []
  let lastIndex = 0
  let match
  const re = new RegExp(RULE_CITATION_RE.source, 'gi')

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const ruleNumber = match[1]
    parts.push(
      <button
        key={`${keyBase}-${match.index}`}
        className="rule-citation-link"
        onClick={() => onRuleClick(ruleNumber)}
      >
        {match[0]}
      </button>
    )
    lastIndex = re.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts
}

/**
 * @param {{ role: string, text: string, timestamp: string, onRuleClick: (ruleNumber: string) => void }} props
 */
export function Message({ role, text, timestamp, onRuleClick }) {
  const formattedTime = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  // Memoize so react-markdown gets a stable components reference —
  // a new object on every render causes it to unmount/remount the output.
  const citationComponents = useMemo(
    () => makeCitationRenderer(onRuleClick),
    [onRuleClick]
  )

  return (
    <div className={`message message--${role}`}>
      <div className="message__text">
        {role === 'agent' ? (
          <ReactMarkdown components={citationComponents}>
            {text}
          </ReactMarkdown>
        ) : (
          text
        )}
      </div>
      <span className="message__time">{formattedTime}</span>
    </div>
  )
}
