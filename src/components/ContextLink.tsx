import React from 'react'
import { Link, LinkProps, useLocation } from 'react-router-dom'
import { useNavigationStack } from '@/contexts/NavigationStackContext'

export default function ContextLink(props: LinkProps) {
  const { onClick, ...rest } = props as any
  const location = useLocation()
  const navigationStack = useNavigationStack()

  const handleClick = (e: React.MouseEvent) => {
    try {
      navigationStack.push(location.pathname + location.search)
    } catch {
      // noop if stack not available
    }
    if (typeof onClick === 'function') {
      onClick(e)
    }
  }

  return <Link {...(rest as LinkProps)} onClick={handleClick} />
}


