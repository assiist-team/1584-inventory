import { initializeApp } from 'firebase/app'
import { getFirestore, Timestamp } from 'firebase/firestore'
import { getAuth, signInAnonymously, User } from 'firebase/auth'
import { getStorage } from 'firebase/storage'
import { getAnalytics } from 'firebase/analytics'

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

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase services
export const db = getFirestore(app)
export const auth = getAuth(app)
export const storage = getStorage(app)


// Initialize Analytics (only in browser)
let analytics: any = null
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app)
}

export { analytics }

// Enable offline persistence
if (typeof window !== 'undefined') {
  // Note: enableNetworkPersistence has been deprecated and removed in newer Firebase versions
  // This would typically be handled by Firestore's built-in offline persistence
  console.log('Firestore offline persistence is enabled by default in modern Firebase versions')
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

// Initialize anonymous authentication
export const initializeAnonymousAuth = async () => {
  try {
    const currentUser = auth.currentUser
    if (!currentUser) {
      console.log('Initializing anonymous authentication...')
      await signInAnonymously(auth)

      // Wait for auth state to propagate
      await new Promise((resolve, reject) => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
          unsubscribe()
          if (user && user.uid) {
            console.log('Anonymous authentication initialized successfully:', user.uid)
            resolve(user)
          } else {
            reject(new Error('Anonymous authentication failed - no user returned'))
          }
        })

        // Timeout after 5 seconds
        setTimeout(() => {
          unsubscribe()
          reject(new Error('Anonymous authentication timeout'))
        }, 5000)
      })
    } else {
      console.log('User already authenticated:', currentUser.uid)
    }
  } catch (error) {
    console.error('Anonymous authentication failed:', error)
    throw error
  }
}

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

    // Wait for authentication to be ready
    let user = await getCurrentUserAsync()

    if (!user) {
      console.log('No current user, initializing anonymous auth...')
      await initializeAnonymousAuth()
      user = await getCurrentUserAsync()
    }

    if (!user) {
      throw new Error('Failed to initialize authentication')
    }

    // Verify the user has a valid ID token
    try {
      const token = await user.getIdToken()
      if (!token) {
        console.warn('User authenticated but no valid token, refreshing...')
        await user.reload()
        const newToken = await user.getIdToken()
        if (!newToken) {
          throw new Error('Unable to get valid authentication token')
        }
      }
    } catch (tokenError) {
      console.warn('Token error, trying to re-authenticate:', tokenError)
      await initializeAnonymousAuth()
      const refreshedUser = await getCurrentUserAsync()
      if (!refreshedUser) {
        throw new Error('Failed to refresh authentication')
      }
    }

    console.log('Storage authentication verified for user:', user.uid)
  } catch (error) {
    console.error('Failed to ensure storage authentication:', error)
    throw new Error('Failed to authenticate for storage operations. Please check your connection and try again.')
  }
}

// Get current authenticated user synchronously
export const getCurrentUserSync = (): User | null => {
  return auth.currentUser
}


export default app
