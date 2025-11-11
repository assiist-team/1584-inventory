import React, { createContext, useContext, useRef, useState, useEffect } from 'react'

export interface NavigationStack {
  push: (entry: string) => void
  pop: (currentLocation?: string) => string | null
  peek: (currentLocation?: string) => string | null
  clear: () => void
  size: () => number
}

interface NavigationStackProviderProps {
  children: React.ReactNode
  mirrorToSessionStorage?: boolean
  maxLength?: number
}

const SESSION_KEY = 'navStack:v1'

const NavigationStackContext = createContext<NavigationStack | null>(null)

export function NavigationStackProvider({
  children,
  mirrorToSessionStorage = true,
  maxLength = 200,
}: NavigationStackProviderProps) {
  const stackRef = useRef<string[]>([])
  const [, setVersion] = useState(0) // used to trigger re-renders when size changes
  const debugEnabled = typeof window !== 'undefined' && sessionStorage.getItem('navStack:debug') === '1'

  // Hydrate from sessionStorage on mount
  useEffect(() => {
    if (!mirrorToSessionStorage) return
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          // keep only strings
          stackRef.current = parsed.filter((e) => typeof e === 'string')
        }
      }
      if (debugEnabled) {
        console.debug('NavigationStackProvider hydrated from sessionStorage:', stackRef.current)
      }
    } catch {
      // Ignore malformed data
    }
    // notify consumers
    setVersion((v) => v + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const persist = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(stackRef.current))
      if (debugEnabled) {
        console.debug('NavigationStackProvider persisted stack to sessionStorage:', stackRef.current)
      }
    } catch {
      // ignore
    }
  }

  const push = (entry: string) => {
    if (!entry) return
    const top = stackRef.current[stackRef.current.length - 1]
    if (top === entry) return
    stackRef.current.push(entry)
    // trim to maxLength
    if (stackRef.current.length > maxLength) {
      stackRef.current = stackRef.current.slice(-maxLength)
    }
    persist()
    setVersion((v) => v + 1)
    if (debugEnabled) {
      console.debug('NavigationStackProvider push:', entry, 'stack:', stackRef.current)
    }
  }

  const pop = (currentLocation?: string): string | null => {
    while (stackRef.current.length > 0) {
      const top = stackRef.current.pop() as string
      // skip entries equal to current location if provided
      if (currentLocation && top === currentLocation) {
        continue
      }
      persist()
      setVersion((v) => v + 1)
      if (debugEnabled) {
        console.debug('NavigationStackProvider pop ->', top, 'stack:', stackRef.current)
      }
      return top
    }
    return null
  }

  const peek = (currentLocation?: string): string | null => {
    for (let i = stackRef.current.length - 1; i >= 0; i--) {
      const entry = stackRef.current[i]
      if (currentLocation && entry === currentLocation) {
        continue
      }
      return entry || null
    }
    return null
  }

  const clear = () => {
    stackRef.current = []
    persist()
    setVersion((v) => v + 1)
  }

  const size = () => stackRef.current.length

  const value: NavigationStack = {
    push,
    pop,
    peek,
    clear,
    size,
  }

  return <NavigationStackContext.Provider value={value}>{children}</NavigationStackContext.Provider>
}

export function useNavigationStack(): NavigationStack {
  const ctx = useContext(NavigationStackContext)
  if (!ctx) {
    throw new Error('useNavigationStack must be used within a NavigationStackProvider')
  }
  return ctx
}


