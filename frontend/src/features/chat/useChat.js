import { useState, useRef } from 'react'
import { askAgent, trackUsage } from '../../api/client'

export function useChat() {
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentRetrievedRules, setCurrentRetrievedRules] = useState([])
  const nextIdRef = useRef(0)

  function serializeHistory(msgs) {
    return msgs
      .filter(m => m.role === 'user' || m.role === 'agent')
      .map(m => ({
        role: m.role === 'agent' ? 'assistant' : 'user',
        content: m.text,
      }))
  }

  async function sendMessage(text, format = 'commander') {
    if (!text.trim()) return

    const timestamp = new Date().toISOString()
    const userMessage = {
      id: nextIdRef.current++,
      role: 'user',
      text,
      timestamp,
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    // Reset retrieved rules when a new answer begins loading
    setCurrentRetrievedRules([])
    trackUsage(timestamp)

    try {
      const history = serializeHistory(messages)
      const { response: responseText, retrieved_rules } = await askAgent(text, format, history)

      setCurrentRetrievedRules(retrieved_rules)
      setMessages(prev => [...prev, {
        id: nextIdRef.current++,
        role: 'agent',
        text: responseText,
        timestamp: new Date().toISOString(),
      }])
    } catch {
      setMessages(prev => [...prev, {
        id: nextIdRef.current++,
        role: 'error',
        text: 'Something went wrong. Please try again.',
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return { messages, isLoading, sendMessage, currentRetrievedRules }
}
