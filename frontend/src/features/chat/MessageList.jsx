import { useEffect, useRef } from 'react'
import { Message } from './Message'

/**
 * @param {{
 *   messages: Array<{id: number, role: string, text: string, timestamp: string}>,
 *   onRuleClick: (ruleNumber: string) => void
 * }} props
 */
export function MessageList({ messages, onRuleClick }) {
  const listRef = useRef(null)
  const bottomRef = useRef(null)
  const prevCountRef = useRef(messages.length)

  useEffect(() => {
    const list = listRef.current
    if (!list) return

    const newMessageAdded = messages.length > prevCountRef.current
    prevCountRef.current = messages.length

    const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight
    // Always scroll on a new message; otherwise only scroll if already near the bottom
    if (newMessageAdded || distanceFromBottom <= 100) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  return (
    <div className="message-list flex-grow-1" ref={listRef}>
      {messages.map(msg => (
        <Message
          key={msg.id}
          role={msg.role}
          text={msg.text}
          timestamp={msg.timestamp}
          onRuleClick={onRuleClick}
        />
      ))}
      <div ref={bottomRef} aria-hidden="true" />
    </div>
  )
}
