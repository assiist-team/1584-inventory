# Auth System Technical Reference

## Architecture

The auth system uses Supabase Auth for session management and a custom `users` table for application-specific user data. Authentication state is managed through React Context (`AuthContext`) and protected routes use a `ProtectedRoute` component.

## Components

### AuthContext (`src/contexts/AuthContext.tsx`)

**State**:
- `supabaseUser: SupabaseUser | null` - Supabase auth user from session
- `user: User | null` - Application user document from `users` table
- `loading: boolean` - Indicates Supabase session detection is still running
- `userLoading: boolean` - Indicates the user-document fetch is still running
- `timedOutWithoutAuth: boolean` - Flag set when 7s timeout fires without auth and no session was detected

**Initialization Flow (Post-Refactor)**:

1.  **Mount**: The `AuthContext` effect mounts.
2.  **Subscribe**: It immediately subscribes to `supabase.auth.onAuthStateChange`. This listener becomes the single source of truth for all auth state changes. A `isInitialLoadRef` flag is set to `true`.
3.  **Trigger Session Check**: `supabase.auth.getSession()` is called. Its purpose is simply to trigger the Supabase client to check for a session. It does **not** fetch application data itself.
4.  **Listener Handles Everything**:
    *   If a session exists, the listener fires a `SIGNED_IN` event.
    *   If no session exists, `getSession()` returns null and resolves loading.
5.  **Loading Resolution**: The `loading` state is resolved by the first event from the listener (`SIGNED_IN` or `SIGNED_OUT`) or by `getSession()` returning no session.

**Auth State Change Listener Logic**:

The listener is the core of the auth system and behaves as follows:

-   **`SIGNED_IN` Event**:
    -   Resolves the main `loading` flag immediately.
    -   Sets `userLoading = true`.
    -   **Distinguishes between initial load and a new login**:
        -   If it's the **initial load's** `SIGNED_IN` event (session detection), it proceeds directly to fetch the app user data with `getCurrentUserWithData()`. It **skips** `createOrUpdateUserDocument` to avoid the initialization race condition.
        -   If it's a **new, user-initiated** `SIGNED_IN` event (after a redirect from the login page), it first calls `createOrUpdateUserDocument()` and then fetches the app user data.
    -   Once the app user data is fetched, `user` state is set and `userLoading` is set to `false`.
-   **`SIGNED_OUT` Event**: Clears both `supabaseUser` and `user`, and resolves the `loading` flag.
-   **`TOKEN_REFRESHED` / Other Events**: These events update the internal `supabaseUser` state but do **not** trigger any application data fetching or `userLoading` state changes.

**Loading Resolution**:
- `resolveLoading(source)` is the single point that sets `loading = false`
- **Called IMMEDIATELY when auth is established** (before `createOrUpdateUserDocument()` or `getCurrentUserWithData()`)
- Also called from: `getSession()` when no session, or error handlers
- Uses `hasResolvedAuthRef` to prevent multiple resolutions
- Source parameter identifies resolution path (e.g., `listener_1_SIGNED_IN_auth_established`, `getSession_no_session`)
- **Why**: Prevents the 7s safety timeout from firing while heavy work (user doc creation/fetch) runs. The UI unblocks immediately; `userLoading` shows spinner only for user data fetch.

**Safety Timeout**:
- 7-second timeout starts on effect mount
- If timeout fires and `!supabaseUser && !user` (using refs to avoid stale closures), sets `timedOutWithoutAuth = true`
- Once a session or user appears, `timedOutWithoutAuth` is cleared automatically
- Timeout cleared when `resolveLoading()` is called
- **Note**: With the fix (loading resolves immediately on auth), this timeout should rarely fire unless there's a genuine network/auth failure

**Instrumentation** (dev only):
- Instance ID tracking for effect mounts (detects StrictMode double-invoke)
- Listener ID counter for subscriptions
- Timing metrics: init start time, `getSession()` elapsed, `createOrUpdateUserDocument()` elapsed, `getCurrentUserWithData()` elapsed
- Structured logs with tags: `[EFFECT MOUNT]`, `[SUBSCRIPTION]`, `[GET_SESSION]`, `[LISTENER N]`, `[TIMEOUT]`, `[LOADING RESOLVED]`
- Boot preflight snapshot: online status, service worker presence, URL auth params, localStorage token presence

### ProtectedRoute (`src/components/auth/ProtectedRoute.tsx`)

**Protection Logic**:
1. If `loading === true || userLoading === true`: Show spinner
2. If `timedOutWithoutAuth === true`: Show `<Login />`
3. If `isAuthenticated === false`: Show `<Login />`
4. If `user === null`: Show `<Login />`
5. Otherwise: Render children

**Gating Requirements**:
- Session must exist (`isAuthenticated`)
- App user document must be loaded (`user`)
- User document request must be finished (`!userLoading`)
- Auth must not have timed out (`!timedOutWithoutAuth`)

### Supabase Client (`src/services/supabase.ts`)

**Initialization**:
- Module-level singleton: `export const supabase = createClient(...)`
- Created once at module load, reused across app
- Configuration: `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true`

**User Document Management**:
- `createOrUpdateUserDocument(supabaseUser)`: Creates or updates `users` table row
  - On **new, user-initiated** `SIGNED_IN` events only (i.e., not on the initial session detection during page load).
  - Handles invitation acceptance if `pendingInvitationData` in localStorage
  - First user gets `role: 'owner'` and default account created
  - Subsequent users get role from invitation or default to `'user'`
- `getCurrentUserWithData()`: Fetches app user document from `users` table
  - Called on initial load and on auth state changes
  - Returns `{ supabaseUser, appUser }`

## State Flow

### Initial Load (No Session)
1. Effect mounts → `loading = true`
2. Listener subscribed
3. `getSession()` called → returns `null`
4. `resolveLoading('getSession_no_session')` called
5. `loading = false`, `supabaseUser = null`, `user = null`

### Initial Load (Existing Session)
1.  Effect mounts → `loading = true`.
2.  Listener is subscribed.
3.  `getSession()` is called. This triggers the listener to fire a `SIGNED_IN` event almost immediately.
4.  The listener receives the `SIGNED_IN` event.
5.  **`resolveLoading(...)` is called immediately** → `loading = false`.
6.  `userLoading = true`.
7.  The listener identifies this as an **initial load** and calls `getCurrentUserWithData()` (skipping `createOrUpdateUserDocument`).
8.  `user` is set from the database, and `userLoading = false`.

### Sign In Flow
1.  User calls `signIn()` → `signInWithGoogle()` redirects to OAuth.
2.  OAuth callback → `/auth/callback` route.
3.  `AuthCallback` handles the redirect and the user is now signed in.
4.  The main `AuthContext` listener, now in a non-initial-load state, fires a `SIGNED_IN` event.
5.  **`resolveLoading(...)` called immediately** → `loading = false`.
6.  `userLoading = true`.
7.  The listener identifies this as a **new sign-in** and calls `createOrUpdateUserDocument()`.
8.  After that, it calls `getCurrentUserWithData()` to fetch the app user.
9.  `user` is set, and `userLoading = false`.

### Sign Out Flow
1. User calls `signOut()` → `signOutUser()` clears Supabase session
2. Listener fires `SIGNED_OUT` event
3. `supabaseUser` set to `null`
4. `user` set to `null`
5. `resolveLoading('listener_N_SIGNED_OUT')` called
6. `loading = false`, user signed out

## Route Protection

`AuthProvider` now wraps the entire React tree in `src/main.tsx`, ensuring a single instance survives navigation. All app routes (except `/auth/callback` and `/invite/:token`) are wrapped in `ProtectedRoute` inside `App.tsx`.

ProtectedRoute checks:
- `loading` state (shows spinner if true)
- `timedOutWithoutAuth` flag (shows login if true)
- `isAuthenticated` (session exists)
- `user` (app user document loaded)

## Page-Level Guards

Pages that require account context check `currentAccountId`:

```tsx
if (!isLoading && !accountLoading && !currentAccountId) {
  return <NoAccountMessage />
}
```

Implemented in:
- `src/pages/Projects.tsx`
- `src/pages/BusinessInventory.tsx`

## Instrumentation

**Log Tags** (dev only, gated by `import.meta.env.DEV`):
- `[EFFECT MOUNT]` - Effect mount with instance ID
- `[EFFECT CLEANUP]` - Cleanup with elapsed time
- `[INIT START]` - Initialization start timestamp
- `[SUBSCRIPTION]` - Listener creation with listener ID
- `[GET_SESSION]` - Session retrieval with timing
- `[LISTENER N]` - Auth state change events
- `[TIMEOUT]` - Safety timeout with state snapshot
- `[LOADING RESOLVED]` - Loading resolution with source and timing

**Timing Metrics**:
- `initStartTime` - When effect mounted
- `getSessionElapsedMs` - Time spent in `getSession()` call
- `getCurrentElapsedMs` - Time spent in `getCurrentUserWithData()` call
- Total elapsed time from init start to resolution

**Instance Tracking**:
- `instanceId` - Unique ID per effect mount (format: `auth-{random}`)
- `listenerId` - Sequential ID per subscription (1, 2, 3...)
- Used to detect StrictMode double-invoke and track subscription lifecycle

## Safety Mechanisms

1. **Ref-Guarded Loading Resolution**: `hasResolvedAuthRef` prevents multiple `resolveLoading()` calls
2. **Safety Timeout**: 7-second timeout prevents infinite loading state
3. **Timeout Flag**: `timedOutWithoutAuth` redirects to login if timeout fires without auth
4. **Subscribe-First Pattern**: Listener created before `getSession()` to avoid missing fast events
5. **Single Resolution Point**: All paths call `resolveLoading()` from one function

## Dependencies

**AuthContext Dependencies**:
- `supabase` client (singleton)
- `getCurrentUserWithData()` - Fetches app user document
- `createOrUpdateUserDocument()` - Creates/updates user document on SIGNED_IN

**AccountContext Dependencies**:
- `AuthContext.user` - Waits for app user before loading account
- `AuthContext.loading` - Backs off if auth still loading

**Page Dependencies**:
- `AuthContext.user` - For user ID/role checks
- `AccountContext.currentAccountId` - For account-scoped data

## Error Handling

- `getSession()` errors: Logged, `resolveLoading('init_error')` called
- `getCurrentUserWithData()` errors: Logged, `user` set to `null`
- `createOrUpdateUserDocument()` errors: Logged, user doc creation skipped
- Listener errors: Logged, state cleared if needed

## React StrictMode Considerations

In development, React StrictMode causes effects to mount/unmount twice. The system handles this via:
- `hasResolvedAuthRef` prevents duplicate resolution
- `isMounted` flag prevents state updates after unmount
- Instance ID tracking helps identify double-invoke in logs
- Subscription cleanup in effect cleanup function

## Related Files

- `src/contexts/AuthContext.tsx` - Main auth state management
- `src/components/auth/ProtectedRoute.tsx` - Route protection
- `src/services/supabase.ts` - Supabase client and user document functions
- `src/pages/AuthCallback.tsx` - OAuth callback handler
- `src/contexts/AccountContext.tsx` - Account loading (depends on auth)

## Logging

All debug logs are gated by `import.meta.env.DEV`. Production only logs warnings without PII. User data in logs is redacted via `describeSupabaseUser()` and `describeAppUser()` helpers.

