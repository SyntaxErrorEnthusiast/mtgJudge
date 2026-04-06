import { useState, useEffect } from 'react'
import { getAdminStats, setUserRateLimit } from '../../api/client'

export function AdminPage() {
  const [stats, setStats] = useState([])
  const [error, setError] = useState(null)
  const [editingUser, setEditingUser] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch(() => setError('Failed to load stats.'))
  }, [])

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

  return (
    <div className="card flex-grow-1 overflow-auto p-3">
      <h5 className="fw-bold text-warning mb-3">⚙ Admin — Usage Stats</h5>
      {error && <p className="text-danger">{error}</p>}
      {saveError && <p className="text-danger">{saveError}</p>}
      <table className="table table-dark table-sm table-hover">
        <thead>
          <tr>
            <th>User</th>
            <th className="text-end">Messages</th>
            <th className="text-end">Avg/day</th>
            <th className="text-end">Limit</th>
            <th className="text-end">Last Seen</th>
          </tr>
        </thead>
        <tbody>
          {stats.map(row => (
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
