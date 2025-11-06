# Task 2.2: Authentication Service Migration

## Objective
Migrate all Firebase Auth functions to use Supabase Auth, maintaining the same interface where possible.

## Steps

### 1. Update `src/services/supabase.ts` with Auth Functions

Add these functions to replace Firebase Auth functions:

```typescript
import { User } from '@supabase/supabase-js'
import { User as AppUser, UserRole } from '../types'
import { accountService } from './accountService'

// Sign in with Google (replaces signInWithGoogle)
export const signInWithGoogle = async (): Promise<User> => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          prompt: 'select_account'
        }
      }
    })
    
    if (error) throw error
    
    // Wait for the redirect to complete
    // The actual user will be available after redirect
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('User not found after sign in')
    }
    
    // Create or update user document
    await createOrUpdateUserDocument(user)
    
    return user
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
    const userDoc = await supabase
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

    if (userDoc.data) {
      // Update existing user
      await supabase
        .from('users')
        .update({
          ...userData,
          last_login: new Date().toISOString()
        })
        .eq('id', supabaseUser.id)
    } else {
      // New user: check if it's the first user
      const { data: existingUsers } = await supabase
        .from('users')
        .select('id')
        .limit(1)

      if (!existingUsers || existingUsers.length === 0) {
        // First user - grant owner permissions
        console.log('First user signing up. Granting owner permissions.')
        
        // Create user with owner role
        const { data: newUser } = await supabase
          .from('users')
          .insert({
            ...userData,
            role: 'owner',
            account_id: null, // Will be updated next
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString()
          })
          .select()
          .single()

        if (newUser) {
          // Create default account
          const accountId = await accountService.createAccount('Default Account', supabaseUser.id)
          
          // Update user with accountId
          await supabase
            .from('users')
            .update({ account_id: accountId })
            .eq('id', supabaseUser.id)

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
            const { data: invitationData } = await supabase
              .from('invitations')
              .select('*')
              .eq('id', invitation.invitationId)
              .single()

            if (invitationData) {
              accountId = invitationData.account_id || null
              invitationRole = invitationData.role === UserRole.ADMIN ? 'admin' : 'user'
            }
            await acceptUserInvitation(invitation.invitationId)
            console.log(`User accepted invitation for account ${accountId} with role ${invitationRole}`)
          }
        }

        // Create the user document
        await supabase
          .from('users')
          .insert({
            ...userData,
            account_id: accountId || null,
            role: null,
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString()
          })

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

    return {
      id: data.id,
      email: data.email,
      displayName: data.display_name,
      role: data.role,
      accountId: data.account_id,
      createdAt: data.created_at ? new Date(data.created_at) : new Date(),
      lastLogin: data.last_login ? new Date(data.last_login) : undefined
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

// Invitation functions (replace Firebase invitation functions)
export const createUserInvitation = async (
  email: string,
  role: UserRole,
  invitedBy: string,
  accountId?: string
): Promise<void> => {
  try {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days

    await supabase
      .from('invitations')
      .insert({
        email,
        role,
        account_id: accountId || null,
        invited_by: invitedBy,
        status: 'pending',
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString()
      })

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
      role: data.role,
      invitationId: data.id
    }
  } catch (error) {
    console.error('Error checking invitation:', error)
    return null
  }
}

export const acceptUserInvitation = async (invitationId: string): Promise<void> => {
  try {
    await supabase
      .from('invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', invitationId)

    console.log('Invitation accepted:', invitationId)
  } catch (error) {
    console.error('Error accepting invitation:', error)
    throw error
  }
}
```

### 2. Create Auth Callback Handler

Create `src/pages/AuthCallback.tsx` to handle OAuth redirect:

```typescript
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleAuthCallback = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('Auth callback error:', error)
        navigate('/login')
        return
      }

      if (session) {
        navigate('/')
      } else {
        navigate('/login')
      }
    }

    handleAuthCallback()
  }, [navigate])

  return <div>Completing sign in...</div>
}
```

### 3. Update Router

Add the callback route to your router configuration.

## Verification
- [ ] All auth functions migrated
- [ ] Sign in with Google works
- [ ] Sign out works
- [ ] User document creation works
- [ ] First user gets owner role
- [ ] Invitation system works
- [ ] Auth callback handler works

## Next Steps
- Proceed to Task 2.3: Auth Context Update

