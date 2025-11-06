import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'supabase.auth.token'
  }
})

// Helper to check if Supabase is ready
export const isSupabaseReady = (): boolean => {
  return supabase !== null && typeof supabase === 'object'
}

// Initialize Supabase (replaces initializeFirebase)
export const initializeSupabase = async (): Promise<void> => {
  if (typeof window !== 'undefined') {
    // Supabase initializes automatically, but we can verify
    if (!isSupabaseReady()) {
      throw new Error('Supabase client is not properly initialized')
    }
    console.log('✅ Supabase initialized')
  }
}

// Initialize auth persistence (replaces initializeAuthPersistence)
export const initializeAuthPersistence = async (): Promise<void> => {
  if (typeof window !== 'undefined') {
    // Supabase handles persistence automatically via localStorage
    // Just verify session exists
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      console.log('✅ Auth session restored from localStorage')
    }
  }
}

// Get current user
export const getCurrentUser = async (): Promise<User | null> => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Get current session
export const getCurrentSession = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// Check if authenticated
export const isAuthenticated = async (): Promise<boolean> => {
  const { data: { session } } = await supabase.auth.getSession()
  return !!session
}

// Auth state change listener (replaces onAuthStateChanged)
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user ?? null)
  })
}

