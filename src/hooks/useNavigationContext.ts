import { useLocation } from 'react-router-dom'

export interface NavigationContext {
  getBackDestination: (defaultPath: string) => string
  getNavigationSource: () => string | null
  buildContextUrl: (targetPath: string, additionalParams?: Record<string, string>) => string
}

export function useNavigationContext(): NavigationContext {
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)

  return {
    getBackDestination: (defaultPath: string) => {
      // Check for returnTo parameter first (highest priority)
      const returnTo = searchParams.get('returnTo')
      if (returnTo) return returnTo

      // Check for from parameter and handle accordingly
      const from = searchParams.get('from')
      switch (from) {
        case 'business-inventory-item':
          // If we're on a project page and came from business inventory item
          if (location.pathname.startsWith('/project/')) {
            return returnTo || '/business-inventory'
          }
          break
        case 'transaction':
          // If we're on an item page and came from transaction
          if (location.pathname.startsWith('/item/')) {
            const projectId = searchParams.get('project')
            const transactionId = searchParams.get('transactionId')
            if (projectId && transactionId) {
              return `/project/${projectId}/transaction/${transactionId}`
            }
          }
          break
      }

      return defaultPath
    },

    getNavigationSource: () => {
      return searchParams.get('from')
    },

    buildContextUrl: (targetPath: string, additionalParams?: Record<string, string>) => {
      const url = new URL(targetPath, window.location.origin)
      const currentParams = new URLSearchParams(location.search)

      // Preserve navigation context
      const from = currentParams.get('from')
      if (from) url.searchParams.set('from', from)

      // Add current path as returnTo for back navigation
      // Always set returnTo to current path to maintain navigation stack
      url.searchParams.set('returnTo', location.pathname + location.search)

      // Add any additional parameters
      if (additionalParams) {
        Object.entries(additionalParams).forEach(([key, value]) => {
          url.searchParams.set(key, value)
        })
      }

      return url.pathname + url.search
    }
  }
}
