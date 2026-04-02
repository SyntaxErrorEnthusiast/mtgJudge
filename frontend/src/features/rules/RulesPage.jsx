// RulesPage.jsx — flat scrollable list of all MTG comprehensive rules.
//
// Each rule has an id matching its rule_number so anchor links work:
//   /rules#702.19b scrolls directly to that rule.
//
// Use getElementById(), NOT querySelector(), for JS scroll — dots in
// id attributes break CSS selector syntax.

import { useState, useEffect } from 'react'
import { getRules } from '../../api/client'

export function RulesPage() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  useEffect(() => {
    getRules()
      .then(data => {
        setRules(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  function copyRuleLink(ruleNumber) {
    const url = `${window.location.origin}/rules#${ruleNumber}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(ruleNumber)
      setTimeout(() => setCopiedId(null), 1500)
    })
  }

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center flex-grow-1">
        <div className="spinner-border text-warning" role="status">
          <span className="visually-hidden">Loading rules…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="d-flex justify-content-center align-items-center flex-grow-1">
        <p className="text-danger">Failed to load rules: {error}</p>
      </div>
    )
  }

  return (
    <div className="rules-page flex-grow-1 overflow-y-auto">
      <div className="rules-page__list">
        {rules.map(rule => (
          <div
            key={rule.rule_number}
            id={rule.rule_number}
            className="rules-page__rule"
          >
            <div className="rules-page__rule-header">
              <h3 className="rules-page__rule-number">{rule.rule_number}</h3>
              <button
                className="rules-page__copy-btn"
                onClick={() => copyRuleLink(rule.rule_number)}
                aria-label={`Copy link to rule ${rule.rule_number}`}
                title="Copy link"
              >
                {copiedId === rule.rule_number ? '✓' : '🔗'}
              </button>
            </div>
            <p className="rules-page__rule-text">{rule.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
