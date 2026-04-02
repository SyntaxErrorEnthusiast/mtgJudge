// RulesPage.jsx — flat scrollable list of all MTG comprehensive rules.
//
// Each rule has an id matching its rule_number so anchor links work:
//   /rules#702.19b scrolls directly to that rule.
//
// Use getElementById(), NOT querySelector(), for JS scroll — dots in
// id attributes break CSS selector syntax.

import { useState, useEffect } from 'react'

export function RulesPage() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/rules')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        setRules(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

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
            <h3 className="rules-page__rule-number">{rule.rule_number}</h3>
            <p className="rules-page__rule-text">{rule.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
