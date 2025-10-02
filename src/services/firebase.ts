import { initializeApp } from 'firebase/app'
import { getFirestore, Timestamp, doc, setDoc, getDoc, collection, getDocs, query, where, updateDoc } from 'firebase/firestore'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth'
import { getStorage } from 'firebase/storage'
import { getAnalytics } from 'firebase/analytics'
import { User as AppUser, UserRole } from '../types'

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
}

// Clear any potentially corrupted Firebase cache
const clearFirebaseCache = async (): Promise<void> => {
  if (typeof window !== 'undefined') {
    try {
      // Clear localStorage Firebase entries
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.includes('firebase') || key.includes('firebaseLocalStorageDb'))) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))

      // Clear sessionStorage Firebase entries
      const sessionKeysToRemove: string[] = []
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key && key.includes('firebase')) {
          sessionKeysToRemove.push(key)
        }
      }
      sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key))

      console.log('Cleared Firebase cache from localStorage and sessionStorage')
    } catch (error) {
      console.warn('Error clearing Firebase cache:', error)
    }
  }
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase services
export const db = getFirestore(app)
export const auth = getAuth(app)
export const storage = getStorage(app)

// Ensure Firebase app is ready before using services
export const isFirebaseReady = (): boolean => {
  return app !== null && typeof app === 'object'
}

// Initialize Firebase with cache clearing
export const initializeFirebase = async (): Promise<void> => {
  if (typeof window !== 'undefined') {
    await clearFirebaseCache()

    // Small delay to ensure cache is cleared before Firebase operations
    await new Promise(resolve => setTimeout(resolve, 100))
  }
}

// Configure Firebase Auth to use local persistence for persistent login
// This ensures users stay logged in across browser sessions
export const initializeAuthPersistence = async (): Promise<void> => {
  if (typeof window !== 'undefined') {
    try {
      // Wait a bit for Firebase to be fully initialized
      await new Promise(resolve => setTimeout(resolve, 100))

      if (!isFirebaseReady()) {
        throw new Error('Firebase app is not properly initialized')
      }

      await setPersistence(auth, browserLocalPersistence)
      console.log('Firebase Auth persistence set to LOCAL - users will stay logged in across browser sessions')
    } catch (error) {
      console.error('Error setting Firebase Auth persistence:', error)
      // Don't throw - allow the app to continue even if persistence fails
      console.warn('Continuing without auth persistence - users may need to re-authenticate on page reload')
    }
  }
}


// Initialize Analytics (only in browser)
let analytics: any = null
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app)
}

export { analytics }

// Configure Firestore with offline persistence
if (typeof window !== 'undefined') {
  try {
    // In Firebase v9+, offline persistence is enabled by default
    // But we can configure it explicitly if needed
    console.log('Firestore initialized with offline persistence enabled by default')
  } catch (error) {
    console.warn('Error configuring Firestore offline persistence:', error)
  }
}

// Helper function to get current user (returns null if not authenticated)
export const getCurrentUser = (): Promise<User | null> => {
  return new Promise((resolve, reject) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe()
      resolve(user) // Resolve with user or null
    }, reject)
  })
}

// Utility function to convert Firestore Timestamp to JavaScript Date
export const timestampToDate = (timestamp: any): Date => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate()
  }
  if (timestamp instanceof Date) {
    return timestamp
  }
  if (typeof timestamp === 'string') {
    // Handle date-only strings (YYYY-MM-DD) by creating date at midnight local time
    const dateStr = timestamp.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      // It's a date-only string, create Date object for that date at midnight local time
      // This avoids timezone conversion issues
      const [year, month, day] = dateStr.split('-').map(Number)
      return new Date(year, month - 1, day) // month is 0-indexed
    }
    return new Date(timestamp)
  }
  // If it's already a number (milliseconds), create a Date from it
  if (typeof timestamp === 'number') {
    return new Date(timestamp)
  }
  // If it's null or undefined, return current date
  if (!timestamp) {
    return new Date()
  }
  // Try to parse as ISO string
  try {
    return new Date(timestamp)
  } catch (error) {
    console.warn('Failed to convert timestamp to date:', timestamp, error)
    return new Date()
  }
}

// Utility function to convert Firestore document data with Timestamp conversion
export const convertTimestamps = (data: any): any => {
  console.log('convertTimestamps - input data:', data)
  console.log('convertTimestamps - transaction_images in input:', data.transaction_images)

  if (!data || typeof data !== 'object') {
    return data
  }

  const converted: any = { ...data }

  // Convert known timestamp fields (transaction_date should remain as string)
  const timestampFields = ['createdAt', 'updatedAt', 'lastActivity', 'uploadedAt', 'generatedAt', 'lastScanned']

  const convertObject = (obj: any): any => {
    if (!obj || typeof obj !== 'object') {
      return obj
    }

    const result: any = { ...obj }

    // Handle arrays of objects FIRST
    if (Array.isArray(result)) {
      console.log('convertTimestamps - processing array:', result)
      return result.map((item: any) => {
        console.log('convertTimestamps - processing array item:', item)
        return convertObject(item)
      })
    }

    // Convert timestamp fields
    timestampFields.forEach(field => {
      if (result[field]) {
        console.log('convertTimestamps - converting timestamp field:', field, result[field])
        result[field] = timestampToDate(result[field])
      }
    })

    // Handle nested objects and arrays (but arrays get special treatment)
    Object.keys(result).forEach(key => {
      if (result[key] && typeof result[key] === 'object') {
        if (Array.isArray(result[key])) {
          console.log('convertTimestamps - processing array field:', key, result[key])
          result[key] = result[key].map((item: any) => convertObject(item))
        } else {
          console.log('convertTimestamps - recursing into nested object:', key, result[key])
          result[key] = convertObject(result[key])
        }
      }
    })

    return result
  }

  const finalResult = convertObject(converted)
  console.log('convertTimestamps - final result:', finalResult)
  console.log('convertTimestamps - transaction_images in final result:', finalResult.transaction_images)
  return finalResult
}

// Removed anonymous authentication - all users must sign in with Google
// This ensures all actions are traceable to specific users

// Get current authenticated user (waits for auth state to be ready)
export const getCurrentUserAsync = async (): Promise<any> => {
  return new Promise((resolve, reject) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe()
      resolve(user)
    })

    // Timeout after 5 seconds
    setTimeout(() => {
      unsubscribe()
      reject(new Error('Authentication state check timeout'))
    }, 5000)
  })
}

// Enhanced authentication check for storage operations
export const ensureAuthenticatedForStorage = async (): Promise<void> => {
  try {
    console.log('Ensuring authentication for storage operations...')

    // Wait for authentication to be ready (with timeout)
    const user = await getCurrentUserAsync()

    if (!user) {
      console.warn('No authenticated user found for storage operations')
      // Don't throw error immediately - allow operations to proceed and fail naturally if needed
      return
    }

    // Verify the user has a valid ID token (but don't fail hard if token refresh fails)
    try {
      const token = await user.getIdToken()
      if (!token) {
        console.warn('User authenticated but no valid token, attempting refresh...')
        try {
          await user.reload()
          const newToken = await user.getIdToken()
          if (!newToken) {
            console.warn('Token refresh failed, but proceeding with current auth state')
          }
        } catch (refreshError) {
          console.warn('Token refresh error:', refreshError)
          // Continue anyway - the operation might still work
        }
      }
    } catch (tokenError) {
      console.warn('Token verification error:', tokenError)
      // Don't throw - allow the operation to proceed
    }

    console.log('Storage authentication check completed for user:', user.uid)
  } catch (error) {
    console.error('Error during storage authentication check:', error)
    // Don't throw - allow operations to proceed and fail naturally if needed
  }
}

// Get current authenticated user synchronously
export const getCurrentUserSync = (): User | null => {
  return auth.currentUser
}

// Google Authentication Provider
const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({
  prompt: 'select_account'
})

// Sign in with Google
export const signInWithGoogle = async (): Promise<User> => {
  try {
    const result = await signInWithPopup(auth, googleProvider)
    const user = result.user

    // Create or update user document in Firestore
    await createOrUpdateUserDocument(user)

    return user
  } catch (error) {
    console.error('Google sign-in error:', error)
    throw error
  }
}

// Sign out
export const signOutUser = async (): Promise<void> => {
  try {
    await signOut(auth)
  } catch (error) {
    console.error('Sign-out error:', error)
    throw error
  }
}

// Create or update user document in Firestore
export const createOrUpdateUserDocument = async (firebaseUser: User): Promise<void> => {
  try {
    const userDocRef = doc(db, 'users', firebaseUser.uid)
    const userDoc = await getDoc(userDocRef)

    const userData: Partial<AppUser> = {
      id: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
      lastLogin: new Date(),
    }

    if (userDoc.exists()) {
      // Update existing user
      await setDoc(userDocRef, userData, { merge: true })
    } else {
      // Check for pending invitation
      let assignedRole = UserRole.VIEWER // Default role

      if (firebaseUser.email) {
        const invitation = await checkUserInvitation(firebaseUser.email)
        if (invitation) {
          assignedRole = invitation.role
          // Accept the invitation
          await acceptUserInvitation(invitation.invitationId)
          console.log('User invited with role:', assignedRole)
        } else {
          // Check if this is the first user (for owner assignment)
          const usersCollection = collection(db, 'users')
          const usersSnapshot = await getDocs(usersCollection)
          const isFirstUser = usersSnapshot.empty

          if (isFirstUser) {
            assignedRole = UserRole.OWNER // First user becomes owner
          }
        }
      }

      // Create new user
      const newUserData: AppUser = {
        ...userData as AppUser,
        role: assignedRole,
        createdAt: new Date(),
        lastLogin: new Date(),
      }
      await setDoc(userDocRef, newUserData)
    }
  } catch (error) {
    console.error('Error creating/updating user document:', error)
    throw error
  }
}

// Create user invitation
export const createUserInvitation = async (email: string, role: UserRole, invitedBy: string): Promise<void> => {
  try {
    const invitationId = `${email.replace('@', '_').replace('.', '_')}_${Date.now()}`
    const invitationRef = doc(db, 'invitations', invitationId)

    await setDoc(invitationRef, {
      email,
      role,
      invitedBy,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    })

    console.log('Invitation created for:', email)
  } catch (error) {
    console.error('Error creating invitation:', error)
    throw error
  }
}

// Check if user has pending invitation
export const checkUserInvitation = async (email: string): Promise<{ role: UserRole; invitationId: string } | null> => {
  try {
    const invitationsRef = collection(db, 'invitations')
    const q = query(
      invitationsRef,
      where('email', '==', email),
      where('status', '==', 'pending')
    )

    const querySnapshot = await getDocs(q)
    if (!querySnapshot.empty) {
      const invitation = querySnapshot.docs[0].data()
      const invitationId = querySnapshot.docs[0].id

      // Check if invitation is expired
      if (invitation.expiresAt.toDate() < new Date()) {
        // Mark as expired
        await updateDoc(doc(db, 'invitations', invitationId), {
          status: 'expired'
        })
        return null
      }

      return {
        role: invitation.role,
        invitationId
      }
    }

    return null
  } catch (error) {
    console.error('Error checking invitation:', error)
    return null
  }
}

// Accept user invitation
export const acceptUserInvitation = async (invitationId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'invitations', invitationId), {
      status: 'accepted',
      acceptedAt: new Date(),
    })

    console.log('Invitation accepted:', invitationId)
  } catch (error) {
    console.error('Error accepting invitation:', error)
    throw error
  }
}

// Get user data from Firestore
export const getUserData = async (uid: string): Promise<AppUser | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid))
    if (userDoc.exists()) {
      return userDoc.data() as AppUser
    }
    return null
  } catch (error) {
    console.error('Error fetching user data:', error)
    return null
  }
}

// Auth state observer
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback)
}

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  return auth.currentUser !== null
}

// Get current user with app user data
export const getCurrentUserWithData = async (): Promise<{ firebaseUser: User | null; appUser: AppUser | null }> => {
  const firebaseUser = auth.currentUser
  if (!firebaseUser) {
    return { firebaseUser: null, appUser: null }
  }

  const appUser = await getUserData(firebaseUser.uid)
  return { firebaseUser, appUser }
}


export default app
