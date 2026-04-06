import { useEffect, useRef } from 'react'
import { Message } from './Message'
import { TypingIndicator } from './TypingIndicator'

/**
 * @param {{
 *   messages: Array<{id: number, role: string, text: string, timestamp: string}>,
 *   isLoading: boolean,
 *   onRuleClick: (ruleNumber: string) => void
 * }} props
 */
export function MessageList({ messages, isLoading, onRuleClick }) {
  const listRef = useRef(null)
  const bottomRef = useRef(null)
  const prevCountRef = useRef(messages.length)

  useEffect(() => {
    const list = listRef.current
    if (!list) return

    const newMessageAdded = messages.length > prevCountRef.current
    prevCountRef.current = messages.length

    const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight
    // Always scroll on a new message or when loading starts; otherwise only scroll if near bottom
    if (newMessageAdded || isLoading || distanceFromBottom <= 100) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading])

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
      {isLoading && <TypingIndicator />}
      <div ref={bottomRef} aria-hidden="true" />
    </div>
  )
}
