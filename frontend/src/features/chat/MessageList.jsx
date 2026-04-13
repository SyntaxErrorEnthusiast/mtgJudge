import { useEffect, useRef } from 'react'
import { Message } from './Message'
import { TypingIndicator } from './TypingIndicator'

/**
 * @param {{
 *   messages: Array<{id: number, role: string, text: string, timestamp: string, streaming?: boolean}>,
 *   isLoading: boolean,
 *   currentStep: string|null,
 *   onRuleClick: (ruleNumber: string) => void
 * }} props
 */
export function MessageList({ messages, isLoading, currentStep, onRuleClick }) {
  const listRef = useRef(null)
  const bottomRef = useRef(null)
  const prevCountRef = useRef(messages.length)

  useEffect(() => {
    const list = listRef.current
    if (!list) return

    const newMessageAdded = messages.length > prevCountRef.current
    prevCountRef.current = messages.length

    const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight
    if (newMessageAdded || isLoading || distanceFromBottom <= 100) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading])

  // Show TypingIndicator only while loading and before any tokens have arrived
  const streamingMsg = messages.find(m => m.streaming)
  const showTypingIndicator = isLoading && (!streamingMsg || streamingMsg.text === '')

  return (
    <div className="message-list flex-grow-1" ref={listRef}>
      {messages.map(msg => (
        <Message
          key={msg.id}
          role={msg.role}
          text={msg.text}
          timestamp={msg.timestamp}
          streaming={msg.streaming}
          onRuleClick={onRuleClick}
        />
      ))}
      {showTypingIndicator && <TypingIndicator step={currentStep} />}
      <div ref={bottomRef} aria-hidden="true" />
    </div>
  )
}
