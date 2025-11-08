import React from 'react'
import { useAuth } from '../../contexts/AuthContext'
import Login from './Login'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading, user, timedOutWithoutAuth } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  // If auth timed out without establishing authentication, show login
  if (timedOutWithoutAuth || !isAuthenticated || !user) {
    return <Login />
  }

  return <>{children}</>
}
