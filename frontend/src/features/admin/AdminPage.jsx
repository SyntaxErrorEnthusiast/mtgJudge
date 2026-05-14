import { useState, useEffect } from 'react'
import { getAdminStats, setUserRateLimit } from '../../api/client'

const COLUMNS = [
  { key: 'username',      label: 'User',     align: '' },
  { key: 'message_count', label: 'Messages', align: 'text-end' },
  { key: 'avg_per_day',   label: 'Avg/day',  align: 'text-end' },
  { key: 'daily_limit',   label: 'Limit',    align: 'text-end' },
  { key: 'last_seen',     label: 'Last Seen',align: 'text-end' },
]

function sortRows(rows, key, dir) {
  return [...rows].sort((a, b) => {
    const av = a[key] ?? ''
    const bv = b[key] ?? ''
    if (av < bv) return dir === 'asc' ? -1 : 1
    if (av > bv) return dir === 'asc' ? 1 : -1
    return 0
  })
}

export function AdminPage() {
  const [stats, setStats] = useState([])
  const [error, setError] = useState(null)
  const [editingUser, setEditingUser] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saveError, setSaveError] = useState(null)
  const [sortKey, setSortKey] = useState('last_seen')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch(() => setError('Failed to load stats.'))
  }, [])

  function handleSort(key) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  async function handleSave(username) {
    const limit = parseInt(editValue, 10)
    if (isNaN(limit) || limit < 1) return
    try {
      await setUserRateLimit(username, limit)
      setStats(prev => prev.map(row =>
        row.username === username ? { ...row, daily_limit: limit } : row
      ))
      setEditingUser(null)
      setSaveError(null)
    } catch {
      setSaveError(`Failed to update limit for ${username}.`)
    }
  }

  const sorted = sortRows(stats, sortKey, sortDir)

  return (
    <div className="card flex-grow-1 overflow-auto p-3">
      <h5 className="fw-bold text-warning mb-3">⚙ Admin — Usage Stats</h5>
      {error && <p className="text-danger">{error}</p>}
      {saveError && <p className="text-danger">{saveError}</p>}
      <table className="table table-dark table-sm table-hover">
        <thead>
          <tr>
            {COLUMNS.map(col => (
              <th
                key={col.key}
                className={`${col.align} user-select-none`}
                style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
                onClick={() => handleSort(col.key)}
                aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                {col.label}
                {sortKey === col.key && (
                  <span className="ms-1" aria-hidden="true">
                    {sortDir === 'asc' ? '▲' : '▼'}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(row => (
            <tr key={row.username}>
              <td>{row.username}</td>
              <td className="text-end">{row.message_count}</td>
              <td className="text-end">{row.avg_per_day ?? '—'}</td>
              <td className="text-end">
                {editingUser === row.username ? (
                  <span className="d-flex gap-1 justify-content-end">
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      style={{ width: '70px' }}
                      value={editValue}
                      min={1}
                      onChange={e => setEditValue(e.target.value)}
                      aria-label="Daily limit"
                    />
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => handleSave(row.username)}
                      aria-label="Save"
                    >
                      Save
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => setEditingUser(null)}
                      aria-label="Cancel"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <span className="d-flex gap-2 justify-content-end align-items-center">
                    {row.daily_limit}
                    <button
                      className="btn btn-sm btn-outline-secondary py-0"
                      onClick={() => { setEditingUser(row.username); setEditValue(String(row.daily_limit)) }}
                      aria-label="Edit"
                    >
                      Edit
                    </button>
                  </span>
                )}
              </td>
              <td className="text-end">
                {row.last_seen ? new Date(row.last_seen).toLocaleString() : '—'}
              </td>
            </tr>
          ))}
          {stats.length === 0 && !error && (
            <tr>
              <td colSpan={5} className="text-secondary text-center">No data yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
