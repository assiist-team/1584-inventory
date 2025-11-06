# Task 2.1: Supabase Auth Client Setup

## Objective
Replace Firebase Auth initialization with Supabase Auth client setup.

## Steps

### 1. Update Supabase Client Configuration

Update `src/services/supabase.ts` to include proper auth configuration:

```typescript
import { createClient } from '@supabase/supabase-js'

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
    storage: window.localStorage, // Use localStorage for persistence
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
```

### 2. Configure Google OAuth in Supabase Dashboard

1. Go to Supabase Dashboard → Authentication → Providers
2. Enable Google provider
3. Add OAuth credentials:
   - Client ID (from Google Cloud Console)
   - Client Secret (from Google Cloud Console)
4. Add authorized redirect URL: `https://your-project.supabase.co/auth/v1/callback`

### 3. Create Auth Helper Functions

Add to `src/services/supabase.ts`:

```typescript
// Get current user
export const getCurrentUser = async () => {
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
export const onAuthStateChange = (callback: (user: any | null) => void) => {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user ?? null)
  })
}
```

## Verification
- [ ] Supabase client configured with auth options
- [ ] Google OAuth provider enabled in Supabase dashboard
- [ ] Helper functions created
- [ ] Can check authentication state
- [ ] Auth state change listener works

## Next Steps
- Proceed to Task 2.2: Authentication Service Migration

