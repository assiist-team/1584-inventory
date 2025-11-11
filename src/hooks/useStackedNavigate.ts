import { useCallback } from 'react'
import { useNavigate, useLocation, To, NavigateOptions } from 'react-router-dom'
import { useNavigationStack } from '../contexts/NavigationStackContext'

// A small wrapper around react-router's navigate that records the current
// location on the navigation stack before navigating (so Back behaves natively).
export function useStackedNavigate() {
  const navigate = useNavigate()
  const location = useLocation()
  const navigationStack = useNavigationStack()

  const stackedNavigate = useCallback(
    (to: To, options?: NavigateOptions) => {
      try {
        navigationStack.push(location.pathname + location.search)
      } catch {
        // ignore if stack not available
      }

      navigate(to, options)
    },
    [navigate, navigationStack, location.pathname, location.search]
  )

  return stackedNavigate
}


