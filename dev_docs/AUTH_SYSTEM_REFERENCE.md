# Auth System Technical Reference

## Architecture

The auth system uses Supabase Auth for session management and a custom `users` table for application-specific user data. Authentication state is managed through React Context (`AuthContext`) and protected routes use a `ProtectedRoute` component.

## Components

### AuthContext (`src/contexts/AuthContext.tsx`)

**State**:
- `supabaseUser: SupabaseUser | null` - Supabase auth user from session
- `user: User | null` - Application user document from `users` table
- `loading: boolean` - Initialization state
- `timedOutWithoutAuth: boolean` - Flag set when 7s timeout fires without auth

**Initialization Flow**:

1. Effect mounts, generates unique `instanceId`
2. Subscribes to `supabase.auth.onAuthStateChange` (listener created before `getSession()` to avoid missing fast SIGNED_IN events)
3. Calls `supabase.auth.getSession()` to check existing session
4. If session exists:
   - Sets `supabaseUser` from session
   - Calls `getCurrentUserWithData()` to fetch app user document
   - Sets `user` state
5. Auth state change listener handles:
   - `SIGNED_IN` events: Creates/updates user document via `createOrUpdateUserDocument()`, then fetches app user
   - `SIGNED_OUT` events: Clears both `supabaseUser` and `user`
   - All events: Calls `resolveLoading()` to mark initialization complete

**Loading Resolution**:
- `resolveLoading(source)` is the single point that sets `loading = false`
- Called from: listener events, `getSession()` when no session, or error handlers
- Uses `hasResolvedAuthRef` to prevent multiple resolutions
- Source parameter identifies resolution path (e.g., `listener_1_SIGNED_IN`, `getSession_no_session`)

**Safety Timeout**:
- 7-second timeout starts on effect mount
- If timeout fires and `!supabaseUser && !user`, sets `timedOutWithoutAuth = true`
- Timeout cleared when `resolveLoading()` is called

**Instrumentation** (dev only):
- Instance ID tracking for effect mounts (detects StrictMode double-invoke)
- Listener ID counter for subscriptions
- Timing metrics: init start time, `getSession()` elapsed, `getCurrentUserWithData()` elapsed
- Structured logs with tags: `[EFFECT MOUNT]`, `[SUBSCRIPTION]`, `[GET_SESSION]`, `[LISTENER N]`, `[TIMEOUT]`, `[LOADING RESOLVED]`

### ProtectedRoute (`src/components/auth/ProtectedRoute.tsx`)

**Protection Logic**:
1. If `loading === true`: Show spinner
2. If `timedOutWithoutAuth === true`: Show `<Login />`
3. If `isAuthenticated === false`: Show `<Login />`
4. If `user === null`: Show `<Login />`
5. Otherwise: Render children

**Gating Requirements**:
- Session must exist (`isAuthenticated`)
- App user document must be loaded (`user`)
- Auth must not have timed out (`!timedOutWithoutAuth`)

### Supabase Client (`src/services/supabase.ts`)

**Initialization**:
- Module-level singleton: `export const supabase = createClient(...)`
- Created once at module load, reused across app
- Configuration: `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true`

**User Document Management**:
- `createOrUpdateUserDocument(supabaseUser)`: Creates or updates `users` table row
  - On `SIGNED_IN` event only (not on initial load)
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
1. Effect mounts → `loading = true`
2. Listener subscribed
3. `getSession()` called → returns session
4. `supabaseUser` set from session
5. `getCurrentUserWithData()` called → fetches app user
6. `user` set from database
7. Listener fires `INITIAL_SESSION` event → `resolveLoading()` called
8. `loading = false`

### Sign In Flow
1. User calls `signIn()` → `signInWithGoogle()` redirects to OAuth
2. OAuth callback → `/auth/callback` route
3. `AuthCallback` polls `getSession()` until session available
4. Session established → listener fires `SIGNED_IN` event
5. `createOrUpdateUserDocument()` called → creates/updates user doc
6. `getCurrentUserWithData()` called → fetches app user
7. `resolveLoading('listener_N_SIGNED_IN')` called
8. `loading = false`, user authenticated

### Sign Out Flow
1. User calls `signOut()` → `signOutUser()` clears Supabase session
2. Listener fires `SIGNED_OUT` event
3. `supabaseUser` set to `null`
4. `user` set to `null`
5. `resolveLoading('listener_N_SIGNED_OUT')` called
6. `loading = false`, user signed out

## Route Protection

All app routes (except `/auth/callback` and `/invite/:token`) are wrapped in `ProtectedRoute`:

```tsx
<Route path="*" element={
  <ProtectedRoute>
    <Layout>
      <Routes>
        {/* All app routes */}
      </Routes>
    </Layout>
  </ProtectedRoute>
} />
```

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

