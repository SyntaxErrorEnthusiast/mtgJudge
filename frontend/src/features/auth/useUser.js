import { useState, useEffect } from 'react'
import { getMe } from '../../api/client'

export function useUser() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser({ username: 'anonymous', email: '', is_admin: false }))
  }, [])

  return user
}
