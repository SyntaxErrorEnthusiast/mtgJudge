import { useState, useEffect, useCallback } from 'react'
import { getQuota } from '../../api/client'

export function useQuota() {
  const [quota, setQuota] = useState(null)

  useEffect(() => {
    getQuota().then(setQuota).catch(() => {})
  }, [])

  const updateFromAskResponse = useCallback((quotaData) => {
    if (quotaData) setQuota(quotaData)
  }, [])

  const isBlocked = quota !== null && !quota.is_admin && quota.used >= quota.limit

  return { quota, isBlocked, updateFromAskResponse }
}
