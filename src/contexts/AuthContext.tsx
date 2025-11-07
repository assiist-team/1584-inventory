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
    let authStateUnsubscribe: { data: { subscription: any } } | null = null
    let loadingTimeout: NodeJS.Timeout | null = null

    // Safety timeout to prevent infinite loading state
    loadingTimeout = setTimeout(() => {
      if (isMounted && loading) {
        console.warn('Auth initialization timed out. Forcing loading to false.')
        setLoading(false)
      }
    }, 7000) // 7-second timeout

    const initializeAuth = async () => {
      // First, check for an existing session
      const { data: { session } } = await supabase.auth.getSession()
      if (isMounted && session) {
        const authUser = session.user
        setSupabaseUser(authUser)
        try {
          // Ensure user document exists and fetch app-specific data
          await createOrUpdateUserDocument(authUser)
          const { appUser } = await getCurrentUserWithData()
          if (isMounted) {
            setUser(appUser)
          }
        } catch (error) {
          console.error('Error loading initial user session:', error)
          if (isMounted) {
            setUser(null)
            setSupabaseUser(null)
          }
        }
      }

      // Then, set up the listener for future auth state changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!isMounted) return

        const authUser = session?.user || null
        setSupabaseUser(authUser)

        if (authUser) {
          try {
            // On sign-in, create/update user doc and fetch app-specific user data
            if (event === 'SIGNED_IN') {
              await createOrUpdateUserDocument(authUser)
            }
            const { appUser } = await getCurrentUserWithData()
            if (isMounted) {
              setUser(appUser)
            }
          } catch (error) {
            console.error('Error handling auth state change:', error)
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

        // Initial load is complete
        if (isMounted) {
          if (loadingTimeout) clearTimeout(loadingTimeout)
          setLoading(false)
        }
      })

      authStateUnsubscribe = { data: { subscription } }

      // If there was no initial session, the listener will set loading to false.
      // If there was an initial session, we can set loading to false now.
      if (isMounted) {
        if (loadingTimeout) clearTimeout(loadingTimeout)
        setLoading(false)
      }
    }

    initializeAuth()

    return () => {
      isMounted = false
      if (loadingTimeout) clearTimeout(loadingTimeout)
      if (authStateUnsubscribe?.data?.subscription) {
        authStateUnsubscribe.data.subscription.unsubscribe()
      }
    }
  }, [])

  const signIn = useCallback(async () => {
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
  }, [])

  const signOut = useCallback(async () => {
    try {
      setLoading(true)
      await signOutUser()
    } catch (error) {
      console.error('Sign out error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

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
  }), [supabaseUser, user, loading, hasRole, isOwner, signIn, signOut])

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
