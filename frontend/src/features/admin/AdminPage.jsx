import { useState, useEffect } from 'react'
import { getAdminStats } from '../../api/client'

export function AdminPage() {
  const [stats, setStats] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch(() => setError('Failed to load stats.'))
  }, [])

  return (
    <div className="card flex-grow-1 overflow-auto p-3">
      <h5 className="fw-bold text-warning mb-3">⚙ Admin — Usage Stats</h5>
      {error && <p className="text-danger">{error}</p>}
      <table className="table table-dark table-sm table-hover">
        <thead>
          <tr>
            <th>User</th>
            <th className="text-end">Messages</th>
            <th className="text-end">Last Seen</th>
          </tr>
        </thead>
        <tbody>
          {stats.map(row => (
            <tr key={row.username}>
              <td>{row.username}</td>
              <td className="text-end">{row.message_count}</td>
              <td className="text-end">
                {row.last_seen
                  ? new Date(row.last_seen).toLocaleString()
                  : '—'}
              </td>
            </tr>
          ))}
          {stats.length === 0 && !error && (
            <tr>
              <td colSpan={2} className="text-secondary text-center">No data yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
