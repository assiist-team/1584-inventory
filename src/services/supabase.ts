import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import { User as AppUser, UserRole } from '../types'
import { accountService } from './accountService'

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

// Initialize Supabase
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

// Sign in with Google (replaces signInWithGoogle)
// Note: OAuth redirects immediately to Google, then back to /auth/callback
// The user will be available after the redirect completes in AuthCallback
export const signInWithGoogle = async (): Promise<void> => {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          prompt: 'select_account'
        }
      }
    })
    
    if (error) throw error
    
    // OAuth redirect happens immediately - user will be available after redirect
    // The AuthCallback component will handle user document creation
  } catch (error) {
    console.error('Google sign-in error:', error)
    throw error
  }
}

// Sign out (replaces signOutUser)
export const signOutUser = async (): Promise<void> => {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  } catch (error) {
    console.error('Sign-out error:', error)
    throw error
  }
}

// Create or update user document in database (replaces createOrUpdateUserDocument)
export const createOrUpdateUserDocument = async (supabaseUser: User): Promise<void> => {
  try {
    const { data: userDoc, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', supabaseUser.id)
      .single()

    const userData: Partial<AppUser> = {
      id: supabaseUser.id,
      email: supabaseUser.email || '',
      displayName: supabaseUser.user_metadata?.full_name || 
                   supabaseUser.user_metadata?.name ||
                   supabaseUser.email?.split('@')[0] || 
                   'User',
    }

    if (userDoc && !fetchError) {
      // Update existing user
      const { error: updateError } = await supabase
        .from('users')
        .update({
          display_name: userData.displayName,
          email: userData.email,
          last_login: new Date().toISOString()
        })
        .eq('id', supabaseUser.id)
      
      if (updateError) throw updateError
    } else {
      // New user: check if it's the first user
      const { data: existingUsers, error: countError } = await supabase
        .from('users')
        .select('id')
        .limit(1)

      if (countError) {
        console.error('Error checking existing users:', countError)
        throw countError
      }

      if (!existingUsers || existingUsers.length === 0) {
        // First user - grant owner permissions
        console.log('First user signing up. Granting owner permissions.')
        
        // Create user with owner role
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert({
            id: supabaseUser.id,
            email: userData.email,
            display_name: userData.displayName,
            role: 'owner',
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString()
          })
          .select()
          .single()

        if (insertError) throw insertError

        if (newUser) {
          // Create default account
          const accountId = await accountService.createAccount('Default Account', supabaseUser.id)
          
          // Add owner as admin to their default account
          await accountService.addUserToAccount(supabaseUser.id, accountId, 'admin')
          console.log('First user setup complete.')
        }
      } else {
        // Subsequent new users
        let accountId: string | null = null
        let invitationRole: 'admin' | 'user' | null = null

        if (supabaseUser.email) {
          const invitation = await checkUserInvitation(supabaseUser.email)
          if (invitation) {
            const { data: invitationData, error: invError } = await supabase
              .from('invitations')
              .select('*')
              .eq('id', invitation.invitationId)
              .single()

            if (invError) {
              console.error('Error fetching invitation:', invError)
            } else if (invitationData) {
              accountId = invitationData.account_id || null
              invitationRole = invitationData.role === UserRole.ADMIN ? 'admin' : 'user'
            }
            
            await acceptUserInvitation(invitation.invitationId)
            console.log(`User accepted invitation for account ${accountId} with role ${invitationRole}`)
          }
        }

        // Create the user document
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: supabaseUser.id,
            email: userData.email,
            display_name: userData.displayName,
            role: null,
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString()
          })

        if (insertError) throw insertError

        // If they were invited, add them to the account membership
        if (accountId && invitationRole) {
          await accountService.addUserToAccount(supabaseUser.id, accountId, invitationRole)
          console.log(`Added invited user to account ${accountId} as ${invitationRole}`)
        }
      }
    }
  } catch (error) {
    console.error('Error creating/updating user document:', error)
    throw error
  }
}

// Get user data from database (replaces getUserData)
export const getUserData = async (uid: string): Promise<AppUser | null> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', uid)
      .single()

    if (error) {
      console.log('No user document found for UID:', uid)
      return null
    }

    // Get account_id from account_members if user has one
    let accountId: string | null = null
    if (data) {
      const { data: memberships, error: membershipError } = await supabase
        .from('account_members')
        .select('account_id')
        .eq('user_id', uid)
        .limit(1)
      
      if (!membershipError && memberships && memberships.length > 0) {
        accountId = memberships[0].account_id
      }
    }

    return {
      id: data.id,
      email: data.email,
      displayName: data.display_name,
      role: data.role as 'owner' | null,
      accountId: accountId || '',
      createdAt: data.created_at ? new Date(data.created_at) : new Date(),
      lastLogin: data.last_login ? new Date(data.last_login) : new Date()
    } as AppUser
  } catch (error) {
    console.error('Error fetching user data:', error)
    return null
  }
}

// Get current user with app user data (replaces getCurrentUserWithData)
export const getCurrentUserWithData = async (): Promise<{ 
  supabaseUser: User | null; 
  appUser: AppUser | null 
}> => {
  const { data: { user: supabaseUser } } = await supabase.auth.getUser()
  
  if (!supabaseUser) {
    console.log('No Supabase user found')
    return { supabaseUser: null, appUser: null }
  }

  console.log('Supabase user UID:', supabaseUser.id)
  console.log('Supabase user email:', supabaseUser.email)

  const appUser = await getUserData(supabaseUser.id)
  console.log('App user data:', appUser)

  return { supabaseUser, appUser }
}

// Invitation functions (Supabase-based)
export const createUserInvitation = async (
  email: string,
  role: UserRole,
  invitedBy: string,
  accountId?: string
): Promise<void> => {
  try {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days

    const { error } = await supabase
      .from('invitations')
      .insert({
        email,
        role: role === UserRole.ADMIN ? 'admin' : 'user',
        account_id: accountId || null,
        invited_by: invitedBy,
        status: 'pending',
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString()
      })

    if (error) throw error

    console.log('Invitation created for:', email, 'accountId:', accountId)
  } catch (error) {
    console.error('Error creating invitation:', error)
    throw error
  }
}

export const checkUserInvitation = async (
  email: string
): Promise<{ role: UserRole; invitationId: string } | null> => {
  try {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('email', email)
      .eq('status', 'pending')
      .single()

    if (error || !data) {
      return null
    }

    // Check if invitation is expired
    if (new Date(data.expires_at) < new Date()) {
      // Mark as expired
      await supabase
        .from('invitations')
        .update({ status: 'expired' })
        .eq('id', data.id)
      return null
    }

    return {
      role: data.role === 'admin' ? UserRole.ADMIN : UserRole.USER,
      invitationId: data.id
    }
  } catch (error) {
    console.error('Error checking invitation:', error)
    return null
  }
}

export const acceptUserInvitation = async (invitationId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', invitationId)

    if (error) throw error

    console.log('Invitation accepted:', invitationId)
  } catch (error) {
    console.error('Error accepting invitation:', error)
    throw error
  }
}

