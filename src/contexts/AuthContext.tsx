import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User as FirebaseUser } from 'firebase/auth'
import {
  onAuthStateChange,
  signInWithGoogle,
  signOutUser,
  getCurrentUserWithData,
  createOrUpdateUserDocument,
  initializeAuthPersistence,
  initializeFirebase,
  auth
} from '../services/firebase'
import { User, UserRole } from '../types'

interface AuthContextType {
  firebaseUser: FirebaseUser | null
  user: User | null
  loading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  isAuthenticated: boolean
  hasRole: (role: UserRole) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isInitialLoad = true
    let authStateUnsubscribe: (() => void) | null = null

    // Initialize Firebase and auth persistence
    const initializeAuth = async () => {
      try {
        // Initialize Firebase (preserves auth persistence)
        await initializeFirebase()
        console.log('🔥 Firebase initialized (auth persistence preserved)')

        // Set auth persistence to localStorage for indefinite login
        await initializeAuthPersistence()
        console.log('🔐 Auth persistence set to localStorage (indefinite)')
      } catch (error) {
        console.error('❌ Failed to initialize Firebase/auth persistence:', error)
      }

      // Wait for auth state to be restored from localStorage
      await new Promise(resolve => setTimeout(resolve, 300))

      // Check if user is already authenticated from localStorage
      const currentUser = auth.currentUser
      console.log('🔍 Current Firebase user from localStorage:', {
        exists: !!currentUser,
        email: currentUser?.email || 'none',
        uid: currentUser?.uid || 'none',
        source: 'localStorage persistence'
      })

      // Set initial state if user exists (from localStorage)
      if (currentUser) {
        setFirebaseUser(currentUser)
        try {
          await createOrUpdateUserDocument(currentUser)
          const { appUser } = await getCurrentUserWithData()
          setUser(appUser)
          if (appUser?.email) {
            console.log('✅ User restored from localStorage persistence:', appUser.email)
          }
        } catch (error) {
          console.error('❌ Error loading user from localStorage:', error)
          setUser(null)
          setFirebaseUser(null) // Clear invalid user
        }
      }

      // Set up auth state listener for future changes
      authStateUnsubscribe = onAuthStateChange(async (firebaseUser) => {
        console.log('🔄 AuthContext: Auth state changed:', {
          hasUser: !!firebaseUser,
          email: firebaseUser?.email || 'none',
          uid: firebaseUser?.uid || 'none',
          isInitialLoad,
          source: isInitialLoad ? 'initial load' : 'auth change'
        })

        // Skip duplicate initial calls
        if (isInitialLoad && firebaseUser && currentUser && firebaseUser.uid === currentUser.uid) {
          console.log('⏭️ Skipping duplicate initial auth state from localStorage')
          setLoading(false)
          isInitialLoad = false
          return
        }

        setFirebaseUser(firebaseUser)

        if (firebaseUser) {
          try {
            await createOrUpdateUserDocument(firebaseUser)
            const { appUser } = await getCurrentUserWithData()
            setUser(appUser)
            if (appUser?.email) {
              console.log('✅ Auth state change - user authenticated:', appUser.email)
            }
          } catch (error) {
            console.error('❌ Error loading authenticated user:', error)
            setUser(null)
          }
        } else {
          console.log('🚪 User signed out or auth cleared')
          setUser(null)
        }

        // Mark loading as complete after initial processing
        if (isInitialLoad) {
          setLoading(false)
          isInitialLoad = false
        }
      })

      return authStateUnsubscribe
    }

    initializeAuth()

    return () => {
      if (authStateUnsubscribe) {
        authStateUnsubscribe()
      }
    }
  }, [])

  const signIn = async () => {
    try {
      setLoading(true)
      const firebaseUser = await signInWithGoogle()

      // Ensure user document is created immediately after sign in
      await createOrUpdateUserDocument(firebaseUser)

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

  const hasRole = (role: UserRole): boolean => {
    console.log('Checking role:', role, 'for user:', user?.email, 'with role:', user?.role)
    const result = user?.role === role || user?.role === UserRole.OWNER || user?.role === UserRole.ADMIN
    console.log('hasRole result:', result)
    return result
  }

  const value: AuthContextType = {
    firebaseUser,
    user,
    loading,
    signIn,
    signOut,
    isAuthenticated: !!firebaseUser,
    hasRole
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
