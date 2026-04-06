import { useState } from 'react'
import { useChat } from './useChat'
import { useQuota } from './useQuota'
import { MessageList } from './MessageList'
import { InputBar } from './InputBar'
import { RulesPanel } from '../rules/RulesPanel'

export function ChatWindow() {
  const { messages, isLoading, sendMessage, allRetrievedRules } = useChat()
  const { quota, isBlocked, updateFromAskResponse } = useQuota()
  const [format, setFormat] = useState('commander')
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [activeRule, setActiveRule] = useState(null)

  async function handleSend(text) {
    const quotaResult = await sendMessage(text, format)
    if (quotaResult) updateFromAskResponse(quotaResult)
  }

  function handleRuleClick(ruleNumber) {
    setActiveRule(ruleNumber)
    setIsPanelOpen(true)
  }

  function buildQuotaLine() {
    if (!quota || quota.is_admin) return null
    if (isBlocked) return 'Daily limit reached. Resets at midnight UTC.'
    return `${quota.used} / ${quota.limit} requests used today`
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

        <MessageList messages={messages} isLoading={isLoading} onRuleClick={handleRuleClick} />

        <InputBar
          onSend={handleSend}
          isLoading={isLoading}
          isBlocked={isBlocked}
          quotaLine={buildQuotaLine()}
          onFormatChange={setFormat}
        />
      </div>

      <RulesPanel
        rules={allRetrievedRules}
        activeRule={activeRule}
        isOpen={isPanelOpen}
        onToggle={() => setIsPanelOpen(prev => !prev)}
      />
    </>
  )
}
