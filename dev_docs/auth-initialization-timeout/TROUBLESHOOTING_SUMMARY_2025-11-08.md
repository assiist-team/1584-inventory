# Auth Initialization Timeout - Troubleshooting Summary (2025-11-08)

## Overview

Implemented comprehensive instrumentation and defensive guards to address auth initialization timeout issues that were preventing users from signing in and navigating between pages. The timeout was causing:
- Indefinite spinners during sign-in
- Forced redirects to login page while already authenticated
- Navigation failures between app pages
- Dead-end pages with no account context

## Root Cause Analysis

The investigation identified several contributing factors:

1. **Missing visibility into auth flow**: Limited logging made it impossible to determine which step (subscription, getSession, or user doc fetch) was stalling
2. **React StrictMode double-invoke**: Development mode causes effects to mount/unmount twice, creating race conditions
3. **Incomplete route protection**: Routes only checked session, not app user readiness
4. **No safety fallback**: When timeout occurred, users landed on broken/empty pages
5. **Page-level assumptions**: Pages tried to load data even when no account was selected, creating loop conditions

## Changes Implemented

### 1. High-Fidelity Instrumentation in AuthContext ✅

**File**: `src/contexts/AuthContext.tsx`

Added comprehensive logging to trace the entire auth flow with millisecond precision:

```
Key Metrics Added:
- instanceId: Unique ID per effect mount (helps detect StrictMode double-invoke)
- listenerId: Sequential ID for each onAuthStateChange subscription
- initStartTime: Tracks elapsed time from init start
- getSessionElapsedMs: Time spent in getSession() call
- getCurrentElapsedMs: Time spent fetching user data

Log Tags:
[EFFECT MOUNT]        - Effect mounts with instance tracking
[EFFECT CLEANUP]      - Cleanup with total elapsed time
[INIT START]          - Initialization begins with timestamp
[SUBSCRIPTION]        - Auth listener created
[GET_SESSION]         - Session retrieval timing
[LISTENER N]          - Auth state change events
[TIMEOUT]             - Safety timeout with state snapshot
[LOADING RESOLVED]    - Loading resolved with source identification
```

**Benefits**:
- Can now definitively see if getSession() hangs, subscription never fires, or user doc fetch stalls
- Instance IDs reveal if StrictMode is causing double-mount issues
- Timing data identifies performance bottlenecks
- Source labels let us trace exactly which path resolved loading

### 2. Safety Redirect on Timeout Without Auth ✅

**Files**: 
- `src/contexts/AuthContext.tsx`
- `src/components/auth/ProtectedRoute.tsx`

**Implementation**:
```typescript
// If timeout fires and we still have no auth, flag it
if (!supabaseUser && !user) {
  setTimedOutWithoutAuth(true)
}

// ProtectedRoute checks the flag
if (timedOutWithoutAuth || !isAuthenticated || !user) {
  return <Login />
}
```

**Benefits**:
- Users no longer land on broken/empty pages when auth fails to initialize
- Clear redirect to login page provides proper UX
- Prevents confusion and dead-end states

### 3. Enhanced Route Protection ✅

**File**: `src/components/auth/ProtectedRoute.tsx`

**Before**:
```typescript
if (!isAuthenticated) return <Login />
```

**After**:
```typescript
if (timedOutWithoutAuth || !isAuthenticated || !user) {
  return <Login />
}
```

**Benefits**:
- Routes now gate on both session existence AND app user readiness
- Prevents pages from rendering with incomplete/stale user state
- More reliable protection against edge cases

### 4. Route Structure Audit ✅

**File**: `src/App.tsx` (verified)

Confirmed route protection structure:
- ✅ Public routes: `/auth/callback`, `/invite/:token` (not wrapped in ProtectedRoute)
- ✅ All app routes wrapped in ProtectedRoute inside Layout
- ✅ No gaps in route protection

### 5. Page-Level No-Account Guards ✅

**Files**:
- `src/pages/Projects.tsx`
- `src/pages/BusinessInventory.tsx`

**Pattern Added**:
```typescript
// Guard against no account when not loading
if (!isLoading && !accountLoading && !currentAccountId) {
  return (
    <div className="bg-white shadow rounded-lg border border-yellow-200 bg-yellow-50">
      <div className="text-center py-12">
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          No Account Selected
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          Please select or create an account to view projects.
        </p>
        <Link to="/settings" className="...">Go to Settings</Link>
      </div>
    </div>
  )
}
```

**Benefits**:
- Eliminates silent empty states
- Provides explicit guidance when account is not available
- Prevents pages from repeatedly loading data with no account context

### 6. Supabase Client Singleton Verification ✅

**File**: `src/services/supabase.ts` (verified)

Confirmed proper initialization pattern:
```typescript
// Module-level singleton
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, ... }
})
```

**Verification**:
- ✅ Client created once at module load (line 13)
- ✅ All parts of app import and use same instance
- ✅ No duplicate instances across hot reloads/StrictMode

## Testing Guidance

### Development Testing (with StrictMode)

1. **Clear State**:
   ```bash
   # Clear browser storage
   DevTools → Application → Local Storage → Clear All
   ```

2. **Initial Sign In**:
   - Navigate to app
   - Click "Sign in with Google"
   - Complete OAuth flow
   - **Watch DevTools Console** for logs:
     - Look for `[EFFECT MOUNT]` - should see instance ID
     - Look for `[SUBSCRIPTION]` - listener should be created
     - Look for `[GET_SESSION]` - should see timing
     - Should NOT see `[TIMEOUT]` if working correctly

3. **Navigation Test**:
   - Sign in successfully
   - Navigate between Projects → BusinessInventory → ProjectDetail
   - **Verify**: No infinite spinners, no timeout warnings
   - **Verify**: Console shows clean `[LOADING RESOLVED]` logs

4. **Sign Out & Back In**:
   - Click sign out
   - Sign back in
   - **Verify**: Clean auth flow, no stalling

5. **Timeout Scenario** (if timeout still occurs):
   - Check console for `[TIMEOUT]` log with details:
     ```
     {
       instanceId: "auth-abc1234",
       supabaseUser: "null",
       appUser: "null",
       hasResolvedAuthRef: false
     }
     ```
   - This tells us which initialization step is stalling

### Production Testing (StrictMode off)

```bash
npm run build
npm run preview  # or deploy to staging
```

**Same tests as dev, but compare**:
- Should be faster (no StrictMode overhead)
- Should have single `[EFFECT MOUNT]` instead of double
- Should resolve without timeouts
- Log patterns should be simpler (fewer re-runs)

## Files Modified

| File | Lines | Key Changes |
|------|-------|-------------|
| `src/contexts/AuthContext.tsx` | +243/-84 | Instrumentation, timedOutWithoutAuth state, detailed logging |
| `src/components/auth/ProtectedRoute.tsx` | +5/-1 | Added user readiness check |
| `src/pages/Projects.tsx` | +35/-1 | No-account guard, explicit CTA |
| `src/pages/BusinessInventory.tsx` | +32/-1 | No-account guard, explicit CTA |
| `src/services/supabase.ts` | +4 | Minor console log additions |
| `src/contexts/AccountContext.tsx` | +23/-23 | (Pre-existing changes from earlier session) |
| `src/pages/AuthCallback.tsx` | +39/-39 | (Pre-existing polling changes from earlier session) |

**Total**: 297 insertions, 84 deletions across 7 files

## How to Debug If Issues Persist

### Check Console Logs for These Patterns

**Good Pattern** (auth resolves):
```
[AuthContext] [EFFECT MOUNT] instanceId=auth-abc123
[AuthContext] [SUBSCRIPTION] Created listener 1 for instanceId=auth-abc123
[AuthContext] [GET_SESSION] Starting getSession() call
[AuthContext] [GET_SESSION] Initial session response after 245ms
[AuthContext] [LISTENER 1] onAuthStateChange event: INITIAL_SESSION (or SIGNED_IN)
[AuthContext] [LOADING RESOLVED] source=listener_1_SIGNED_IN elapsedMs=512
```

**Bad Pattern** (timeout):
```
[AuthContext] [EFFECT MOUNT] instanceId=auth-abc123
[AuthContext] [SUBSCRIPTION] Created listener 1
[AuthContext] [GET_SESSION] Starting getSession()
(7 seconds pass... no resolution logs)
[AuthContext] [TIMEOUT] Initialization timed out after 7001ms
```

**Indicates**:
- Missing `[GET_SESSION]` response log → getSession() call hung
- Missing `[LISTENER 1]` logs → subscription callback never fired  
- Missing `[LOADING RESOLVED]` → no resolution path completed

### Double-Invoke Detection (StrictMode)

If you see logs like:
```
[EFFECT MOUNT] instanceId=auth-abc123 (first mount)
[EFFECT CLEANUP] ...
[EFFECT MOUNT] instanceId=auth-abc123 (same ID - cleanup called between)
```

This is normal StrictMode behavior in development. The system is designed to handle it with the `hasResolvedAuthRef` guard, so it should not cause issues.

## Success Criteria

✅ **Implementation Complete When**:
- All 7 files show no linter errors
- No TypeScript compilation errors
- Dev build runs without warnings
- Instrumentation logs appear in console on page load
- No timeout warnings on normal auth flow
- No infinite spinners during navigation
- Clear error messages when account is not selected

✅ **Testing Complete When**:
- Dev build (with StrictMode): Auth resolves cleanly, no timeouts
- Prod build: Faster resolution, clean log pattern
- All edge cases tested and working
- Investigation document updated with findings

## Next: Testing Phase

The only remaining item is **Step 7: Testing** (marked as pending). Once you run the app and verify the auth flow with the new instrumentation:

1. Open DevTools Console
2. Go through sign-in flow
3. Navigate between pages
4. Collect console logs
5. Document patterns observed
6. If timeouts still occur, use the "Debug Pattern" guide above to identify root cause

All defensive code is in place and should prevent the user experience issues even if the underlying timing issue persists.

---

**Investigation Document**: See `dev_docs/auth-initialization-timeout-investigation.md` for full details and decision history.

