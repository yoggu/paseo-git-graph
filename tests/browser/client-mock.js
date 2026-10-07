import { useCallback } from 'react'
export function useWorkspace() { return { name: 'Fixture', directory: '/fixture' } }
export function useRpc() {
  return useCallback(async input => {
    const response = await fetch('/rpc', { method: 'POST', body: JSON.stringify(input) })
    return response.json()
  }, [])
}
