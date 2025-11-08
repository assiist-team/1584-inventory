# Infinite Spinner Investigation

## Problem Summary
Supabase session restoration is intermittently taking about seven seconds before `supabase.auth.getSession()` resolves. During that window the UI sits on the global spinner; when the safety timeout fires the app drops back to the login screen. We never observed this behaviour in the previous Firebase-based build under the same conditions, so we need to determine why Supabase takes so long and fix it.

## Observed Symptoms
- Initial page load (incognito) shows only the global spinner, then logs `[TIMEOUT]` after ~7 s and routes to login, even though reloading immediately afterwards succeeds.
- While already authenticated in-app, navigation can show a blank screen with spinner, then suddenly jump to login after the timeout fires.
- No other `[AuthContext]` logs appear on the failing run; just the timeout.
- Realtime subscriptions occasionally log `Error subscribing to projects channel: mismatch between server and client bindings for postgres changes`.
- When auth does succeed we see repeated `getCurrentUserWithData()` logs, projects load, and realtime subscription errors appear afterwards.

## Why This Didn’t Happen With Firebase
- The Firebase-based app never showed the prolonged spinner/timeout behaviour under the same network conditions—the session appeared immediately and the UI never stalled for seven seconds.
- Action item: inspect the Firebase implementation to understand exactly how it restored auth state so quickly.

## Goal
Design the Supabase authentication flow so it is as resilient as the old Firebase-based version:
- Sessions cached in local storage should render instantly without waiting on the network.
- Slow or delayed Supabase responses should not boot the user to the login screen.
- Loading indicators should degrade gracefully (e.g. show “still signing you in” instead of a blank spinner forever).
- When Supabase truly fails (no session), surface a clear message and a retry, not an unexplained logout.

Refer to `dev_docs/AUTH_SYSTEM_REFERENCE.md` for the current architecture and state machine.

## Known Technical Differences vs Firebase
- The ~7 s experience is driven by our 7,000 ms safety timeout: `loading` only resolves via the auth listener, `getSession()` completion, or the safety timeout. If neither the listener nor `getSession()` completes promptly, the UI waits the full 7 seconds and then flags `timedOutWithoutAuth`.
- React StrictMode in development double-mounts effects, causing us to re-run `getSession()` and rebuild listeners; the timeout can fire on the second invocation.
- `timedOutWithoutAuth` now auto-clears once a session or user is present; `ProtectedRoute` gates access with `loading`, `userLoading`, `isAuthenticated`, `user`, and `timedOutWithoutAuth`.

## Why the Spinner Lasts ~7 Seconds (Code-Only Explanation)
- `AuthContext` sets `loading = true` on mount and resolves it only in `resolveLoading(source)`, which is called from:
  - the auth listener (`onAuthStateChange`) when any event arrives,
  - `getSession()` completion (with or without a session),
  - the 7,000 ms safety timeout if neither path resolves first.
- If `getSession()` returns quickly with no session, we call `resolveLoading('getSession_no_session')` and the spinner ends promptly. The observed ~7 s spinner happens when `getSession()` does not return quickly and the listener does not fire, so the safety timeout resolves `loading` at ~7 s.
- After the safety timeout, if there is still no session and no app user, `timedOutWithoutAuth` is set; `ProtectedRoute` then renders `<Login />`, which explains the jump to login at ~7 s.
- In development, `React.StrictMode` double-mounts the effect. This re-runs the initialization, re-subscribes the listener, and re-calls `getSession()`, restarting the 7 s window and increasing the likelihood of seeing the timeout path locally.

## Diagnosis: Why Timeouts Happen (Production Included)
- Your app only unblocks when the Supabase auth listener fires or when `supabase.auth.getSession()` resolves. If neither completes within 7,000 ms, the safety timeout forces resolution and sets `timedOutWithoutAuth` when unauthenticated.
- The Supabase client is initialized with `detectSessionInUrl: true` and `autoRefreshToken: true`. On some runs, Supabase’s initial auth pipeline (URL/session detection, possible token exchange/refresh) does not yield a session or “no session” result within 7 seconds. In those runs, neither the listener nor `getSession()` completes before our safety timeout.
- This behavior is observed in production as well; it is not limited to dev/incognito. StrictMode affects development behavior but is not the cause in production.
- Evidence pattern: failing runs log only `[TIMEOUT]` without `[GET_SESSION] ... response` or `[LISTENER ...]` before the timeout, which implies our resolver was the safety timer rather than a completed Supabase operation.

## Likely Root Causes (Code-anchored)
- Stale or cross-environment session tokens due to a shared `storageKey`:
  - We set `storageKey: 'supabase.auth.token'` (not project-scoped). If a user has used another environment/app reusing this key, Supabase may find an “existing” session that is invalid for the current project and attempt a refresh. If the refresh call is slow/blocked, `getSession()` can effectively stall until our 7s safety timeout fires.
- Network/proxy/ad-block/service worker interference with Supabase auth endpoints:
  - When a refresh is needed, the SDK calls `https://<project>.supabase.co/auth/v1/token?grant_type=refresh_token`. Corporate proxies, ad blockers, or an over-eager service worker can delay or block this request (or its CORS preflight). While that exchange is unresolved, our boot waits.

## Latest Repro Results (2025-11-08)

### Scenario A: App functional, then blank spinner after navigation
- Steps: New incognito → sign in → deallocate items successfully → navigate away and back.
- Observed: UI turns into a blank screen with spinner and no text.
- Console shows realtime subscription logs only:
  - “Subscribed to projects channel”
  - “Subscribed to business inventory channel”
  - “Subscribed to all transactions channel”
- Interpretation: App was authenticated (realtime subscriptions alive), but a view-level gate re-entered a loading state. Not directly an auth-init failure.

### Scenario B: Hard refresh → auth init timeout only
- Steps: Refresh the stuck page.
- Observed: Console shows only the 7s auth init timeout log from `AuthContext`:
  - `[TIMEOUT] Initialization timed out after ~7002ms`
  - Snapshot: `getSessionStarted: true`, `getSessionElapsedMs: ~7002`, `online: true`, `hasServiceWorker: false`, `localStorageTokenExists: true`, `supabaseUser: null`, `appUser: null`.
- Interpretation (code-based):
  - `supabase.auth.getSession()` started promptly but did not complete (session or no-session) within 7s.
  - Network appears online, no active service worker, localStorage had an auth entry.
  - This supports the “pending refresh/token path” or “network stall on auth endpoint” hypothesis. Because dev-only logs were used, we did not see `/auth/v1/*` timing in this production build; only the timeout snapshot was captured.

## Root Cause Identified (2025-11-08)

### The Real Problem
The 7s timeout was **not** caused by `getSession()` being slow. The auth listener fired `SIGNED_IN` quickly with a valid session, but `loading` was not resolved until **after** heavy work (`createOrUpdateUserDocument()` + `getCurrentUserWithData()`) completed. If those operations took >7s, the safety timeout fired even though auth was already established.

### Evidence from Logs
```
[LISTENER 2] onAuthStateChange event {event: 'SIGNED_IN', hasSession: true, hasAccessToken: true, ...}
[LISTENER 2] Handling SIGNED_IN event. Ensuring user document is up to date
[TIMEOUT] Initialization timed out after 7002ms
[LOADING RESOLVED] source=safety_timeout ... supabaseUser={"id":"..."} appUser=null
```

The listener fired `SIGNED_IN` immediately, but `resolveLoading()` was only called **after** `createOrUpdateUserDocument()` and `getCurrentUserWithData()` finished. These operations can take >7s, causing the timeout to fire despite successful auth.

### The Fix (2025-11-08)
- **Resolve `loading` IMMEDIATELY when auth is established** (before heavy work)
- Do `createOrUpdateUserDocument()` and `getCurrentUserWithData()` **after** resolving loading
- Use refs in timeout condition to avoid stale closures
- Added timing logs around `createOrUpdateUserDocument()` to identify slow operations

**Code changes:**
- In `AuthContext` listener: call `resolveLoading()` immediately when `authUser` exists, then do heavy work
- Timeout condition now uses refs (`supabaseUserLogRef`, `userLogRef`) instead of stale state
- Added `createUserDocElapsedMs` timing log

**Result:** The UI unblocks as soon as auth is established. Heavy work (user doc creation/fetch) runs with `userLoading=true`, showing a spinner only for user data fetch, not blocking the entire app.

## Fix Did Not Fully Resolve Issue (2025-11-08)

### New Repro: Blank Spinner After Navigation Away/Back

**Steps:**
1. New incognito window → sign in → navigate to business inventory
2. Click on item → navigate away → watch video for ~2 minutes
3. Come back to tab → page is blank with spinner

**Console Logs:**
```
Subscribed to projects channel
Subscribed to business inventory channel
Subscribed to all transactions channel
Subscribed to business inventory channel
[LISTENER 2] onAuthStateChange event {event: 'SIGNED_IN', hasSession: true, hasAccessToken: true, expiresAt: 1762639023, ...}
[LISTENER 2] Handling SIGNED_IN event. Ensuring user document is up to date
```

**Critical Observations:**
- Realtime subscriptions are **active** (projects, business inventory, transactions channels subscribed)
- `SIGNED_IN` event fired **after returning to tab** (timestamp shows ~2 minutes after sign-in)
- Listener started handling `SIGNED_IN` event
- **Missing logs:**
  - No `[LOADING RESOLVED]` log (should appear immediately after SIGNED_IN)
  - No `createOrUpdateUserDocument completed` log
  - No `Updated app user after auth state change` log

**Analysis:**
1. **Auth is established** (SIGNED_IN event fired, subscriptions active)
2. **Loading resolution may not have happened** - Missing `[LOADING RESOLVED]` log suggests `resolveLoading()` was not called, OR it was called but `hasResolvedAuthRef.current` was already `true` (preventing re-resolution)
3. **Heavy work appears stuck** - No completion logs for `createOrUpdateUserDocument()` or `getCurrentUserWithData()`
4. **Code flow analysis:**
   - `resolveLoading()` checks `hasResolvedAuthRef.current` - if already `true`, it does nothing (prevents duplicate resolution)
   - On tab return, if this is a **new effect mount** (StrictMode or remount), `hasResolvedAuthRef` should be reset
   - But if this is the **same effect** (tab backgrounded, then foregrounded), `hasResolvedAuthRef` might already be `true` from initial load
   - `userLoading` is set to `true` when SIGNED_IN fires, but if `getCurrentUserWithData()` hangs, it never gets set back to `false`
   - ProtectedRoute shows spinner when `loading || userLoading` is true

**Most Likely Cause:**
- `userLoading` is stuck `true` because `getCurrentUserWithData()` is hanging/stuck (no error, no completion)
- ProtectedRoute is showing spinner based on `userLoading === true` indefinitely
- This happens **after** tab return, suggesting tab backgrounding/suspension may affect Supabase client state or network requests

**What This Means:**
- The fix (resolve loading immediately) works for initial load, but:
  - On tab return, `getCurrentUserWithData()` may hang due to stale Supabase client state or network issues
  - `userLoading` never resolves, so ProtectedRoute shows spinner indefinitely
  - Need to add timeout/retry logic for `getCurrentUserWithData()` or handle tab return scenarios

**Next Steps:**
- Add explicit logging to confirm `resolveLoading()` is being called (even if `hasResolvedAuthRef` prevents action)
- Add state snapshot logs showing `loading` and `userLoading` values when SIGNED_IN fires
- Add timeout/error handling for `getCurrentUserWithData()` to prevent indefinite `userLoading`
- Investigate if tab backgrounding/suspension affects Supabase client state (may need to reinitialize or refresh session)
- Consider if ProtectedRoute should show a "Connecting..." message instead of blank spinner when `userLoading` is stuck

## The Final, True Root Cause and Solution (2025-11-08)

After multiple failed attempts, the final root cause was identified as a fundamental React hooks issue, not a Supabase-specific one.

### The Problem: Stale Closure

The `onAuthStateChange` callback is created only once when the `AuthContext` component mounts. Due to the way JavaScript closures work, this callback captured the initial state of the `user` variable, which was `null`. It never had access to the updated `user` state after the user logged in.

This caused the final failure mode:

1.  A user returns to the backgrounded tab.
2.  The `visibilitychange` listener correctly triggers `supabase.auth.refreshSession()`.
3.  The Supabase client emits a `TOKEN_REFRESHED` event, immediately followed by a redundant `SIGNED_IN` event.
4.  The `onAuthStateChange` listener fires for the `SIGNED_IN` event.
5.  The state-based check (`if (user && user.id === authUser.id)`) **failed** because the `user` in its closure was the initial `null` value. It incorrectly concluded this was a new user sign-in.
6.  It then attempted to re-run the user data fetching logic, which hung because the underlying network connection was stale, resulting in the infinite spinner.

### The Definitive Solution

The solution was to fix the stale closure by using a React `ref` to maintain a mutable, up-to-date reference to the current application user.

1.  **Use a Ref for Current State**: A `userLogRef` (already present for logging) was used to store the current `user` object. This ref is updated via a separate `useEffect` hook whenever the `user` state changes.
2.  **Consult the Ref in the Listener**: The state-based check inside the `onAuthStateChange` listener was modified to read from `userLogRef.current` instead of the stale `user` state variable.

This ensures the listener always has access to the most recent user data and can correctly determine if a `SIGNED_IN` event is redundant and should be ignored. This finally resolves all manifestations of the infinite spinner bug.

## What We Changed (Instrumentation Only) — and What Didn't Work
- Added dev-only instrumentation (no behavior changes):
  - `AuthContext`: boot preflight snapshot, enhanced listener logs, timeout snapshot with `getSessionElapsedMs`, environment hints.
  - `ProtectedRoute`: logs gate reason when rendering `<Login />`.
  - `supabase.ts`: dev-only client config echo; dev-only fetch timing wrapper for `/auth/v1/*`.
- Result:
  - In production, only the `[TIMEOUT]` snapshot is visible (as intended; other logs are dev-only). We confirmed that `getSession()` started and was still unresolved at ~7s, with `navigator.onLine === true`, `hasServiceWorker === false`, and `localStorageTokenExists === true`.
  - We did not capture `/auth/v1/*` timing in this run because the fetch wrapper is dev-only.
- Net effect:
  - The instrumentation confirmed the core stall signature but, in production, did not provide endpoint timing. Functional behavior is unchanged (expected).

## How to Confirm Without Code Changes
- Inspect localStorage for cross-env contamination:
  - In the browser console: `JSON.parse(localStorage.getItem('supabase.auth.token') || 'null')`
  - Look for tokens that don’t match the current Supabase project usage history. Clear it and reload to see if the 7s behavior disappears for that browser profile.
- Check Network panel during a failing load:
  - Filter for `auth/v1` requests to `*.supabase.co`. If `token?grant_type=refresh_token` (or related) stays pending near 7s, that explains the stall.
- Rule out PWA interference:
  - In DevTools → Application → Service Workers: “Bypass for network” (Chrome) or unregister the SW temporarily; reload and check whether the stalls persist.
- Cross-environment repro:
  - Try the same account/browser on a different network (hotspot) to exclude corporate proxy issues. If stalls vanish, it’s likely a network or proxy policy.

## Practical Mitigations (no immediate code changes required)
- Clean environment state:
  - Clear `localStorage['supabase.auth.token']` for affected users once (warn them they’ll need to sign in again). This eliminates stale/cross-env tokens as a cause.
- Network allowances:
  - Ensure `*.supabase.co` (especially `/auth/v1/*`) is not blocked/rewritten by proxies, ad blockers, or Cloudflare rules on the client side.
- PWA testing:
  - Temporarily bypass or unregister the service worker on affected devices to confirm it’s not impacting third-party requests.

## Mitigations to Implement (code change later)
- Use a project-scoped storage key (prevents cross-env token collisions).
- Add bounded retry/backoff for `getSession()` before declaring timeout; treat “indeterminate” separately from “no session”.
- Add progressive UI (“Connecting to Supabase…”, with retry) instead of immediate Login after the safety timeout.

## Current Gaps
- `supabase.auth.getSession()` can take ~7 seconds before resolving (root cause unknown; needs investigation).
- `AuthContext` currently does a single `getSession()` attempt; we resolve via a 7s safety timeout but do not retry with backoff before setting `timedOutWithoutAuth`.
- Spinner state shows but has no progressive messaging (“still connecting to Supabase…”, “this is taking longer than usual”) or explicit retry.
- Timeout UX is improved, but still drops to `<Login />` if auth hasn’t established; consider a “Connecting…” screen with retry before redirect.
- Instrumentation exists for timing, but there’s no retry loop or jittered backoff around `getSession()`.
- No clear “session still loading vs session truly missing” distinction in UI text (only via `timedOutWithoutAuth` logic).

## What’s Implemented (as of 2025-11-08)
- High-fidelity instrumentation in `AuthContext`:
  - Subscribe-first pattern (listener before `getSession()`), timing metrics for `init`, `getSession`, and user fetch.
  - Structured logs gated to development with `[EFFECT MOUNT]`, `[SUBSCRIPTION]`, `[GET_SESSION]`, `[LISTENER N]`, `[TIMEOUT]`, `[LOADING RESOLVED]`.
- Safety timeout: after ~7s we resolve loading and, if still unauthenticated, set `timedOutWithoutAuth` to inform routing.
- `timedOutWithoutAuth` auto-clears when a session or app user appears.
- `ProtectedRoute` checks: `loading || userLoading` → spinner; `timedOutWithoutAuth || !isAuthenticated || !user` → `<Login />`; otherwise render app.
- StrictMode considerations: effect instance tracking and cleanup to mitigate double-mount side effects in development.

## Desired Behavior (High Level)
1. **Immediate Cached Session Lookup**  
   - Read existing session (from Supabase cache/localStorage) synchronously before any async calls.
   - Render UI in an “optimistic” state if a cached session exists.

2. **Resilient Initialization**  
   - Attempt `getSession()` with retries/backoff before declaring timeout.
   - Keep the user on a “connecting” state rather than dumping to login immediately.
   - Log each attempt (`[GET_SESSION RETRY #]`) so we can trace delays.

3. **Timeout Handling**  
   - Only set `timedOutWithoutAuth` after retries fail.
   - Provide UI that explains the failure and offers a retry action.
   - If a session arrives later, clear the timeout flag and proceed without forcing a reload.

4. **Consistent State**  
   - Ensure `userLoading` and `loading` reflect actual work in progress.
   - Avoid leaving the app in a pure spinner state without messaging.
   - ProtectedRoute should only show `<Login />` when we definitively have no session.

## Next Steps
1. Compare with Firebase branch to capture cached session/initialization patterns.
2. Redesign `AuthContext` boot logic (documented in `AUTH_SYSTEM_REFERENCE.md`) around retries, cached sessions, and better timeout UX.
3. Update UI states (spinner vs login) to give clear feedback during slow auth responses.
4. Investigate and address Supabase realtime subscription error (`mismatch between server and client bindings`), which may add to perceived instability.
5. Add explicit logging for each `getSession()` attempt, Supabase event, and retries to aid future debugging.

## Action Items (Engineering)
- Implement bounded retries with jitter for `getSession()` before setting `timedOutWithoutAuth` (cap total to ~7s).
- Add a “Connecting to Supabase…” fallback view with “Retry” action; only drop to `<Login />` after retries fail.
- Log each retry: `[GET_SESSION RETRY n]` with elapsed times and instance ID for correlation.
- Validate Supabase client config and version; confirm `persistSession`, `autoRefreshToken`, `detectSessionInUrl` behave as expected on fresh loads.
- Capture a failing run’s timeline: initial `[INIT START]`, `[GET_SESSION]` elapsed, any `[LISTENER]` events, and `[TIMEOUT]` details.
- Investigate whether token refresh or URL detection contributes to the ~7s stall on first load.

## Notes for Verification
- In a failing incognito run, confirm whether the 7s delay is entirely within `getSession()` by checking the `[GET_SESSION]` elapsed log.
- Confirm that once a session appears (even post-timeout), `timedOutWithoutAuth` clears and routes proceed as expected.
- Validate StrictMode behavior: ensure only one live listener and that cleanup logs are present between effect mounts.

