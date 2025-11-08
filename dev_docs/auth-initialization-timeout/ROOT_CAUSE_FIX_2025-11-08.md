# Root Cause Fix - Auth Initialization Timeout (2025-11-08)

## Summary

Fixed the 7-second spinner/timeout issue by resolving `loading` **immediately** when auth is established, rather than waiting for heavy work (`createOrUpdateUserDocument()` + `getCurrentUserWithData()`) to complete.

## Root Cause

The timeout was **not** caused by `getSession()` being slow. The auth listener fired `SIGNED_IN` quickly with a valid session, but `loading` was only resolved **after** heavy work completed. If those operations took >7s, the safety timeout fired even though auth was already established.

### Evidence

From console logs:
```
[LISTENER 2] onAuthStateChange event {event: 'SIGNED_IN', hasSession: true, hasAccessToken: true, ...}
[LISTENER 2] Handling SIGNED_IN event. Ensuring user document is up to date
[TIMEOUT] Initialization timed out after 7002ms
[LOADING RESOLVED] source=safety_timeout ... supabaseUser={"id":"..."} appUser=null
```

The listener fired immediately, but `resolveLoading()` was called **after** `createOrUpdateUserDocument()` and `getCurrentUserWithData()` finished.

## The Fix

### Code Changes

**File**: `src/contexts/AuthContext.tsx`

1. **Resolve loading immediately when auth is established** (before heavy work):
   - In the auth listener, call `resolveLoading()` immediately when `authUser` exists
   - Do `createOrUpdateUserDocument()` and `getCurrentUserWithData()` **after** resolving loading
   - This prevents the 7s timeout from firing while heavy work runs

2. **Use refs in timeout condition** (avoid stale closures):
   - Timeout condition now uses `supabaseUserLogRef` and `userLogRef` instead of stale state variables
   - Ensures accurate check of current auth state when timeout fires

3. **Added timing logs**:
   - `createUserDocElapsedMs` log to identify slow operations

### Before vs After

**Before:**
```typescript
// Listener fires SIGNED_IN
if (authUser) {
  await createOrUpdateUserDocument(authUser)  // Can take >7s
  const { appUser } = await getCurrentUserWithData()  // Can take >7s
  setUser(appUser)
}
resolveLoading()  // Called AFTER heavy work completes
// If heavy work takes >7s, timeout fires even though auth is established
```

**After:**
```typescript
// Listener fires SIGNED_IN
if (authUser) {
  resolveLoading()  // Called IMMEDIATELY when auth established
  // Heavy work happens after loading resolved
  await createOrUpdateUserDocument(authUser)
  const { appUser } = await getCurrentUserWithData()
  setUser(appUser)
}
// UI unblocks immediately; userLoading shows spinner only for user data fetch
```

## Result

- **UI unblocks as soon as auth is established** (no more 7s wait)
- Heavy work (user doc creation/fetch) runs with `userLoading=true`, showing a spinner only for user data fetch
- The 7s safety timeout should rarely fire unless there's a genuine network/auth failure
- Users see the app immediately after authentication, not after user data loads

## Testing

To verify the fix:
1. Sign in and observe that the UI appears immediately after auth (not after 7s)
2. Check console logs: `[LOADING RESOLVED]` should appear with source `listener_N_SIGNED_IN_auth_established` or `getSession_with_session_detected`
3. Verify `userLoading` spinner shows only while user data is being fetched
4. Confirm no `[TIMEOUT]` logs appear during normal auth flows

## Related Documentation

- `dev_docs/auth-initialization-timeout/INFINITE_SPINNER_INVESTIGATION.md` - Full investigation and root cause analysis
- `dev_docs/AUTH_SYSTEM_REFERENCE.md` - Updated architecture documentation

