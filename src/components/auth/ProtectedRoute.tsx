import React from 'react'
import { useAuth } from '../../contexts/AuthContext'
import Login from './Login'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading, user } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Login />
  }

  // Check if user has proper authentication
  // We check for user.email instead of just firebaseUser to ensure we have complete user data
  if (!user?.email) {
    return <Login />
  }

  return <>{children}</>
}
