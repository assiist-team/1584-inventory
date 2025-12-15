# Task 2.3: Auth Context Update

## Objective
Update the AuthContext to use Supabase Auth instead of Firebase Auth, maintaining the same interface for components.

## Steps

### 1. Update `src/contexts/AuthContext.tsx`

Replace Firebase imports and update the context:

```typescript
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import {
  onAuthStateChange,
  signInWithGoogle,
  signOutUser,
  getCurrentUserWithData,
  createOrUpdateUserDocument,
  initializeAuthPersistence,
  initializeSupabase,
  supabase
} from '../services/supabase'
import { User, UserRole } from '../types'
import { accountService } from '../services/accountService'

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
      const supabaseUser = await signInWithGoogle()

      // Ensure user document is created immediately after sign in
      await createOrUpdateUserDocument(supabaseUser)

      // Fetch the complete user data
      const { appUser } = await getCurrentUserWithData()
      setUser(appUser)
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
```

### 2. Update Component Imports

If any components reference `firebaseUser`, they should now reference `supabaseUser`. However, to maintain backward compatibility, you can keep the interface the same and just update the internal implementation.

## Key Changes

1. **Import changes**: `firebase/auth` → `@supabase/supabase-js`
2. **User type**: `FirebaseUser` → `SupabaseUser`
3. **Auth state listener**: `onAuthStateChanged` → `onAuthStateChange` (Supabase)
4. **Session handling**: Supabase uses sessions instead of direct user objects
5. **State restoration**: Uses `getSession()` instead of `currentUser`

## Verification
- [ ] AuthContext updated
- [ ] Auth state listener works
- [ ] Sign in flow works
- [ ] Sign out flow works
- [ ] User state persists across page reloads
- [ ] Components using `useAuth()` still work

## Next Steps
- Proceed to Task 3.1: Core Database Service

