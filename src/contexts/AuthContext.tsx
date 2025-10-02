import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User as FirebaseUser } from 'firebase/auth'
import {
  onAuthStateChange,
  signInWithGoogle,
  signOutUser,
  getCurrentUserWithData,
  createOrUpdateUserDocument,
  initializeAuthPersistence
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

    // Initialize auth persistence first, then set up auth state listener
    const initializeAuth = async () => {
      try {
        // Ensure auth persistence is properly configured before listening to auth state
        await initializeAuthPersistence()
        console.log('Auth persistence initialized successfully')
      } catch (error) {
        console.error('Failed to initialize auth persistence:', error)
        // Continue anyway - the auth state listener should still work
      }

      // Listen for auth state changes
      const unsubscribe = onAuthStateChange(async (firebaseUser) => {
        setFirebaseUser(firebaseUser)

        if (firebaseUser) {
          try {
            // First, ensure the user document exists
            await createOrUpdateUserDocument(firebaseUser)

            // Then fetch the user data - this is critical for proper authentication
            const { appUser } = await getCurrentUserWithData()
            setUser(appUser)

            // Ensure we have a valid user with email before considering auth complete
            if (appUser?.email) {
              console.log('User authentication completed successfully:', appUser.email)
            } else {
              console.warn('User document created but no email found in user data')
              setUser(null)
            }
          } catch (error) {
            console.error('Error fetching user data:', error)
            setUser(null)
          }
        } else {
          setUser(null)
        }

        // Only set loading to false on the initial load
        if (isInitialLoad) {
          setLoading(false)
          isInitialLoad = false
        }
      })

      return unsubscribe
    }

    const cleanup = initializeAuth()

    return () => {
      cleanup.then(unsubscribe => unsubscribe?.())
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
    return user?.role === role || user?.role === UserRole.OWNER || user?.role === UserRole.ADMIN
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
