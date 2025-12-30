import { useState, useEffect } from 'react'

interface NetworkState {
  isOnline: boolean
  isSlowConnection: boolean
  lastOnline: Date | null
  connectionType: string
}

export function useNetworkState(): NetworkState {
  const [networkState, setNetworkState] = useState<NetworkState>({
    isOnline: navigator.onLine,
    isSlowConnection: false,
    lastOnline: navigator.onLine ? new Date() : null,
    connectionType: 'unknown'
  })

  useEffect(() => {
    const updateNetworkState = async () => {
      const isOnline = navigator.onLine

      let isSlowConnection = false
      let connectionType = 'unknown'

      // Check connection quality if Network Information API is available
      if ('connection' in navigator) {
        const conn = (navigator as any).connection
        connectionType = conn.effectiveType || 'unknown'
        isSlowConnection = conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g'
      }

      // Test actual connectivity with a ping
      let actualOnline = isOnline
      if (isOnline) {
        try {
          const response = await fetch('/ping', {
            method: 'HEAD',
            cache: 'no-cache',
            signal: AbortSignal.timeout(5000)
          })
          actualOnline = response.ok
        } catch {
          actualOnline = false
        }
      }

      setNetworkState({
        isOnline: actualOnline,
        isSlowConnection,
        lastOnline: actualOnline ? new Date() : networkState.lastOnline,
        connectionType
      })
    }

    // Initial check
    updateNetworkState()

    // Listen for network changes
    window.addEventListener('online', updateNetworkState)
    window.addEventListener('offline', updateNetworkState)

    // Periodic connectivity checks (every 30 seconds)
    const interval = setInterval(updateNetworkState, 30000)

    return () => {
      window.removeEventListener('online', updateNetworkState)
      window.removeEventListener('offline', updateNetworkState)
      clearInterval(interval)
    }
  }, [])

  return networkState
}