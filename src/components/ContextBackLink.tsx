import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useNavigationStack } from '@/contexts/NavigationStackContext'

interface ContextBackLinkProps {
  fallback: string
  className?: string
  children?: React.ReactNode
  title?: string
}

export default function ContextBackLink({ fallback, className, children, title }: ContextBackLinkProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const navigationStack = useNavigationStack()

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    try {
      const target = navigationStack.pop(location.pathname + location.search) || fallback
      navigate(target)
    } catch {
      // fallback if stack not available
      navigate(fallback)
    }
  }

  return (
    // use an anchor so keyboard/assistive tech recognize it as a link
    <a href={fallback} onClick={handleClick} className={className} title={title}>
      {children}
    </a>
  )
}


