// RulesPanel.jsx — side panel overlay showing retrieved rules for the current answer.
//
// Toggle with << / >> button on the right edge.
// Highlighted rule scrolls into view when activeRule changes.
// Panel is CSS-hidden (not unmounted) to preserve scroll position.
// Use getElementById() for scroll — not querySelector() (dots in ids break CSS selectors).

import { useEffect, useRef } from 'react'

/**
 * @param {{
 *   rules: Array<{rule_number: string, text: string}>,
 *   activeRule: string | null,
 *   isOpen: boolean,
 *   onToggle: () => void,
 * }} props
 */
export function RulesPanel({ rules, activeRule, isOpen, onToggle }) {
  const panelRef = useRef(null)

  // Scroll to and highlight the active rule when it changes
  useEffect(() => {
    if (!activeRule || !isOpen) return
    // Use getElementById — querySelector fails on ids containing dots
    const el = document.getElementById(`panel-rule-${activeRule}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeRule, isOpen])

  // ESC key minimizes the panel
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onToggle()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onToggle])

  const hasRules = rules.length > 0

  return (
    <>
      {/* Toggle tab — always visible when rules are available */}
      {hasRules && (
        <button
          className="rules-panel__toggle"
          onClick={onToggle}
          aria-label={isOpen ? 'Close rules panel' : 'Open rules panel'}
        >
          {isOpen ? '<<' : '>>'}
        </button>
      )}

      {/* Panel — CSS-hidden when closed, not unmounted */}
      <div
        ref={panelRef}
        className={`rules-panel ${isOpen ? 'rules-panel--open' : ''}`}
        aria-hidden={!isOpen}
      >
        <div className="rules-panel__header">
          <span className="rules-panel__title">Retrieved Rules</span>
        </div>
        <div className="rules-panel__body">
          {rules.map(rule => (
            <div
              key={rule.rule_number}
              id={`panel-rule-${rule.rule_number}`}
              className={`rules-panel__rule ${activeRule === rule.rule_number ? 'rules-panel__rule--active' : ''}`}
            >
              <div className="rules-panel__rule-number">{rule.rule_number}</div>
              <div className="rules-panel__rule-text">{rule.text}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
