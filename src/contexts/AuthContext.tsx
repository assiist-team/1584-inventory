import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
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
    let isInitialLoad = true
    let authStateUnsubscribe: { data: { subscription: any } } | null = null
    let loadingTimeout: NodeJS.Timeout | null = null
    let isMounted = true

    // Safety timeout
    loadingTimeout = setTimeout(() => {
      if (isMounted && isInitialLoad) {
        console.warn('⚠️ Auth initialization timeout - setting loading to false')
        setLoading(false)
        isInitialLoad = false
      }
    }, 5000)

    // Initialize Supabase and auth persistence
    const initializeAuth = async () => {
      try {
        // Initialize Supabase
        await initializeSupabase()
        console.log('🔥 Supabase initialized')

        // Set auth persistence
        await initializeAuthPersistence()
        console.log('🔐 Auth persistence initialized')
      } catch (error) {
        console.error('❌ Failed to initialize Supabase/auth persistence:', error)
        if (isMounted) {
          setLoading(false)
        }
      }

      // Wait for auth state to be restored
      await new Promise(resolve => setTimeout(resolve, 300))

      // Check if user is already authenticated
      const { data: { session } } = await supabase.auth.getSession()
      const currentUser = session?.user || null
      
      console.log('🔍 Current Supabase user from localStorage:', {
        exists: !!currentUser,
        email: currentUser?.email || 'none',
        uid: currentUser?.id || 'none',
        source: 'localStorage persistence'
      })

      // Set initial state if user exists
      if (currentUser) {
        setSupabaseUser(currentUser)
        try {
          await createOrUpdateUserDocument(currentUser)
          const { appUser } = await getCurrentUserWithData()
          if (isMounted) {
            setUser(appUser)
            if (appUser?.email) {
              console.log('✅ User restored from localStorage persistence:', appUser.email)
            }
          }
        } catch (error) {
          console.error('❌ Error loading user from localStorage:', error)
          if (isMounted) {
            setUser(null)
            setSupabaseUser(null)
          }
        }
      }

      // Set up auth state listener
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!isMounted) return

        const authUser = session?.user || null

        console.log('🔄 AuthContext: Auth state changed:', {
          event,
          hasUser: !!authUser,
          email: authUser?.email || 'none',
          uid: authUser?.id || 'none',
          isInitialLoad,
          source: isInitialLoad ? 'initial load' : 'auth change'
        })

        // Skip duplicate initial calls
        if (isInitialLoad && authUser && currentUser && authUser.id === currentUser.id) {
          console.log('⏭️ Skipping duplicate initial auth state from localStorage')
          if (loadingTimeout) {
            clearTimeout(loadingTimeout)
            loadingTimeout = null
          }
          setLoading(false)
          isInitialLoad = false
          return
        }

        setSupabaseUser(authUser)

        if (authUser) {
          try {
            await createOrUpdateUserDocument(authUser)
            const { appUser } = await getCurrentUserWithData()
            if (isMounted) {
              setUser(appUser)
              if (appUser?.email) {
                console.log('✅ Auth state change - user authenticated:', appUser.email)
              }
            }
          } catch (error) {
            console.error('❌ Error loading authenticated user:', error)
            if (isMounted) {
              setUser(null)
            }
          }
        } else {
          console.log('🚪 User signed out or auth cleared')
          if (isMounted) {
            setUser(null)
          }
        }

        // Mark loading as complete after initial processing
        if (isInitialLoad) {
          if (loadingTimeout) {
            clearTimeout(loadingTimeout)
            loadingTimeout = null
          }
          setLoading(false)
          isInitialLoad = false
        }
      })

      authStateUnsubscribe = { data: { subscription } }
    }

    initializeAuth()

    return () => {
      isMounted = false
      if (loadingTimeout) {
        clearTimeout(loadingTimeout)
      }
      if (authStateUnsubscribe?.data?.subscription) {
        authStateUnsubscribe.data.subscription.unsubscribe()
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

  const value: AuthContextType = {
    supabaseUser,
    user,
    loading,
    signIn,
    signOut,
    isAuthenticated: !!supabaseUser,
    hasRole,
    isOwner
  }

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
