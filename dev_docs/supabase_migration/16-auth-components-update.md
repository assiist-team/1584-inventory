# Task 7.1: Auth Components Update

## Objective
Update authentication-related components to work with Supabase instead of Firebase.

## Steps

### 1. Update `src/components/auth/Login.tsx`

Check if it references Firebase-specific APIs and update if needed. Most likely it just uses `useAuth()` hook which we've already updated in the context.

**Review for**:
- Direct Firebase imports
- Firebase-specific error handling
- Firebase user object properties

**Example updates** (if needed):
```typescript
// If component accesses firebaseUser properties directly
// Change from:
const { firebaseUser } = useAuth()
const userEmail = firebaseUser?.email

// To:
const { supabaseUser } = useAuth()
const userEmail = supabaseUser?.email
```

### 2. Update `src/components/auth/ProtectedRoute.tsx`

Should work as-is if it only uses `useAuth()` hook. Verify:

```typescript
import { useAuth } from '../../contexts/AuthContext'
import { Navigate } from 'react-router-dom'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <div>Loading...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
```

### 3. Update `src/components/auth/UserManagement.tsx`

Check for Firebase-specific code:

**Look for**:
- Direct Firebase imports
- Firebase user management functions
- Firebase user object properties

**Update if needed**:
```typescript
// Remove any Firebase imports
// import { ... } from 'firebase/auth'

// Ensure it uses Supabase services through the context
import { useAuth } from '../../contexts/AuthContext'
```

### 4. Update `src/components/auth/AccountManagement.tsx`

Similar review - ensure it uses Supabase services through context or service files.

### 5. Add Auth Callback Route

Ensure `src/pages/AuthCallback.tsx` exists (created in Task 2.2) and is added to router:

```typescript
// In your router configuration
{
  path: '/auth/callback',
  element: <AuthCallback />
}
```

### 6. Update Error Handling

Update any Firebase-specific error codes to Supabase equivalents:

```typescript
// Firebase error codes (if any)
// auth/user-not-found -> Check Supabase error messages
// auth/wrong-password -> Check Supabase error messages
// etc.

// Supabase errors are typically in error.message
// Common patterns:
// - "Invalid login credentials"
// - "Email not confirmed"
// - etc.
```

## Common Issues to Watch For

1. **User Object Properties**:
   - Firebase: `user.uid`, `user.email`, `user.displayName`
   - Supabase: `user.id`, `user.email`, `user.user_metadata.name`

2. **Auth State**:
   - Both use similar patterns, but Supabase uses sessions

3. **Error Messages**:
   - May need to update error message handling

## Verification
- [ ] Login component works
- [ ] Protected routes work
- [ ] User management works
- [ ] Account management works
- [ ] Auth callback route works
- [ ] Error handling works
- [ ] No Firebase imports remain

## Next Steps
- Proceed to Task 7.2: Service Hook Updates

