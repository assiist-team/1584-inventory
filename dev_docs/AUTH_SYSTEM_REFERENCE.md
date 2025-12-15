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

**Initialization Flow (The Definitive, Working Logic)**:

1.  **Mount**: The `AuthContext` effect mounts, setting `isInitialLoadRef` to `true`. A `userLogRef` is also established to hold a mutable, always-current reference to the application user.
2.  **Subscribe**: It immediately subscribes to `supabase.auth.onAuthStateChange`.
3.  **Initialize and Wait**: The `initializeAuth` function is called. It **`await`s `supabase.auth.getSession()`**. This is the most critical step, ensuring the Supabase client is fully initialized before any application-level data is fetched.
4.  **Fetch App Data**: After `getSession` completes, if a session was found, `initializeAuth` fetches the application-specific user data via `getCurrentUserWithData`.
5.  **Resolve Loading**: Once the initial data fetch is complete (or if no session was found), the main `loading` state is resolved.
6.  **Initial Load Complete**: `isInitialLoadRef` is set to `false`. The `onAuthStateChange` listener is now fully active for subsequent events.

**Auth State Change Listener Logic (Post-Fix)**:

The listener's behavior is now governed by both the application's lifecycle and its current state to prevent race conditions and unnecessary re-fetches.

-   **During Initial Load (`isInitialLoadRef.current === true`)**: The listener is passive. Its only role is to set the `supabaseUser` state. It performs no data fetching.
-   **After Initial Load (`isInitialLoadRef.current === false`)**: The listener becomes fully active for in-session events:
    -   **Stale Closure Prevention**: Before any action, it consults **`userLogRef.current`** to get the most up-to-date application user data.
    -   **Idempotent Check**: It checks if a user matching the event's user ID is already loaded. If so, it **ignores** the event (e.g., the redundant `SIGNED_IN` after a token refresh) and does nothing. This is the key to preventing the tab-return spinner.
    -   **New `SIGNED_IN` Event**: If no application user is loaded, it correctly identifies this as a new, user-initiated login and triggers the full `createOrUpdateUserDocument` and `getCurrentUserWithData` flow.
    -   **`SIGNED_OUT` Event**: Clears both `supabaseUser` and `user`.

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
2.  Listener is subscribed. `userLogRef` is initialized.
3.  `initializeAuth` is called and **`await`s `supabase.auth.getSession()`**. During this wait, the listener may fire, correctly setting the `supabaseUser` state but doing nothing else.
4.  `getSession()` completes, confirming a session. The Supabase client is now fully ready.
5.  `userLoading = true`.
6.  `initializeAuth` calls `getCurrentUserWithData()` to fetch the app user.
7.  The `user` state and `userLogRef` are updated. `userLoading` becomes `false`.
8.  The main `loading` state is resolved to `false`.
9.  `isInitialLoadRef` is set to `false`, fully activating the listener for future events.

### Sign In Flow
1.  User calls `signIn()` → `signInWithGoogle()` redirects to OAuth.
2.  After returning to the app, `AuthContext` has already completed its initial load.
3.  The listener receives a `SIGNED_IN` event.
4.  The listener checks `userLogRef.current`, sees no user is loaded, and correctly identifies this as a new sign-in.
5.  It then executes the full logic: `userLoading = true`, calls `createOrUpdateUserDocument()`, calls `getCurrentUserWithData()`, and updates the final state.

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

