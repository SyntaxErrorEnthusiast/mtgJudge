import { useState, useRef } from 'react'
import { askAgentStream } from '../../api/client'

// Human-readable labels for each pipeline step
const STEP_LABELS = {
  understand: 'Understanding your question…',
  retrieve: 'Retrieving rules and cards…',
  reason: 'Reasoning through the answer…',
  self_review: 'Verifying citations…',
  respond: 'Composing response…',
}

export function useChat() {
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(null)
  const [allRetrievedRules, setAllRetrievedRules] = useState([])
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
    if (!text.trim()) return null

    const timestamp = new Date().toISOString()
    const userMessage = { id: nextIdRef.current++, role: 'user', text, timestamp }
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    setCurrentStep(null)

    // Placeholder agent message that we'll stream tokens into
    const agentId = nextIdRef.current++
    setMessages(prev => [...prev, { id: agentId, role: 'agent', text: '', timestamp: new Date().toISOString(), streaming: true }])

    try {
      const history = serializeHistory(messages)

      const { retrieved_rules, quota } = await askAgentStream(
        text,
        format,
        history,
        {
          onStep: (step) => setCurrentStep(STEP_LABELS[step] ?? step),
          onToken: (token) => {
            setMessages(prev => prev.map(m =>
              m.id === agentId ? { ...m, text: m.text + token } : m
            ))
          },
        }
      )

      // Mark streaming done, clear step indicator
      setMessages(prev => prev.map(m =>
        m.id === agentId ? { ...m, streaming: false } : m
      ))
      setCurrentStep(null)

      setAllRetrievedRules(prev => {
        const existingNumbers = new Set(prev.map(r => r.rule_number))
        const newRules = retrieved_rules.filter(r => !existingNumbers.has(r.rule_number))
        return [...prev, ...newRules]
      })

      return quota
    } catch (err) {
      const errorText = err.status === 429
        ? 'Daily limit reached. Resets at midnight UTC.'
        : 'Something went wrong. Please try again.'

      // Replace the empty streaming placeholder with the error
      setMessages(prev => prev.map(m =>
        m.id === agentId ? { ...m, role: 'error', text: errorText, streaming: false } : m
      ))
      setCurrentStep(null)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  return { messages, isLoading, currentStep, sendMessage, allRetrievedRules }
}
