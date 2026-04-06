import { Navigate } from 'react-router-dom'
import { useUser } from './useUser'

export function RequireAdmin({ children }) {
  const user = useUser()

  // Still loading — render nothing to avoid flash
  if (user === null) return null

  if (!user.is_admin) return <Navigate to="/" replace />

  return children
}
