import { useState, useEffect } from 'react'
import { useChat } from './useChat'
import { MessageList } from './MessageList'
import { InputBar } from './InputBar'
import { RulesPanel } from '../rules/RulesPanel'

export function ChatWindow() {
  const { messages, isLoading, sendMessage, currentRetrievedRules } = useChat()
  const [format, setFormat] = useState('commander')
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [activeRule, setActiveRule] = useState(null)

  // Close panel when a new answer begins loading
  useEffect(() => {
    if (isLoading) {
      setIsPanelOpen(false)
      setActiveRule(null)
    }
  }, [isLoading])

  function handleSend(text) {
    sendMessage(text, format)
  }

  function handleRuleClick(ruleNumber) {
    setActiveRule(ruleNumber)
    setIsPanelOpen(true)
  }

  return (
    <>
      <div className="card flex-grow-1 d-flex flex-column overflow-hidden">
        <div className="card-header border-warning">
          <h5 className="mb-0 fw-bold text-warning">⚔ MTG Judge</h5>
          <p className="mb-0 mt-1 small text-secondary">
            Ask rules questions about Magic: The Gathering
          </p>
        </div>

        <MessageList messages={messages} onRuleClick={handleRuleClick} />

        <InputBar onSend={handleSend} isLoading={isLoading} onFormatChange={setFormat} />
      </div>

      <RulesPanel
        rules={currentRetrievedRules}
        activeRule={activeRule}
        isOpen={isPanelOpen}
        onToggle={() => setIsPanelOpen(prev => !prev)}
      />
    </>
  )
}
