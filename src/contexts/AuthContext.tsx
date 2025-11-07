import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useMemo } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import {
  signInWithGoogle,
  signOutUser,
  getCurrentUserWithData,
  createOrUpdateUserDocument,
  initializeAuthPersistence,
  initializeSupabase,
  supabase
} from '../services/supabase'
import { User, UserRole } from '../types'

interface AuthContextType {
  supabaseUser: SupabaseUser | null
  user: User | null
  loading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  isAuthenticated: boolean
  hasRole: (role: UserRole) => boolean
  isOwner: () => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

      // Set up auth state listener
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!isMounted) return

        const authUser = session?.user || null
        setSupabaseUser(authUser)

        if (authUser) {
          try {
          // On initial load or sign-in, create/update user doc and fetch app-specific user data
          if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
            await createOrUpdateUserDocument(authUser)
          }
            const { appUser } = await getCurrentUserWithData()
            if (isMounted) {
              setUser(appUser)
            }
          } catch (error) {
          console.error('Error loading user data:', error)
          if (isMounted) {
            setUser(null)
          }
        }
      } else {
        // User is signed out
        if (isMounted) {
          setUser(null)
        }
      }

      // Loading is false once the initial session is handled
      if (isMounted) {
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [])

  const signIn = async () => {
    try {
      setLoading(true)
      await signInWithGoogle()

      // Note: OAuth redirect happens immediately - user will be available after redirect
      // The AuthCallback component will handle user document creation
      // This function will complete after redirect, so we don't set user here
    } catch (error) {
      console.error('Sign in error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      await signOutUser()
    } catch (error) {
      console.error('Sign out error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const hasRole = useCallback((role: UserRole): boolean => {
    // Removed excessive logging - only log in development if needed for debugging
    return user?.role === role || user?.role === UserRole.OWNER || user?.role === UserRole.ADMIN
  }, [user?.role])

  const isOwner = useCallback((): boolean => {
    return user?.role === 'owner' || false
  }, [user?.role])

  const value: AuthContextType = useMemo(() => ({
    supabaseUser,
    user,
    loading,
    signIn,
    signOut,
    isAuthenticated: !!supabaseUser,
    hasRole,
    isOwner
  }), [supabaseUser, user, loading, hasRole, isOwner, signOut, signIn])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
