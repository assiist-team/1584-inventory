### How to use this document (for the next developer)

**Quick Links** (Implementation Complete - 2025-11-08):
- 📖 Start here: [`TROUBLESHOOTING_COMPLETE.txt`](./auth-initialization-timeout/TROUBLESHOOTING_COMPLETE.txt) - Quick status overview
- 🧪 Testing guide: [`TROUBLESHOOTING_SUMMARY_2025-11-08.md`](./auth-initialization-timeout/TROUBLESHOOTING_SUMMARY_2025-11-08.md) - How to test & debug
- ✅ Verification: [`IMPLEMENTATION_CHECKLIST_2025-11-08.md`](./auth-initialization-timeout/IMPLEMENTATION_CHECKLIST_2025-11-08.md) - What was changed
- 💾 Code reference: [`KEY_CODE_CHANGES.md`](./auth-initialization-timeout/KEY_CODE_CHANGES.md) - Code snippets

---

- Purpose: This doc is the single source of truth for the Supabase auth initialization timeout investigation. Do not delete or rewrite history; append updates to keep a chronological narrative.
- What to add when you investigate:
  - A timestamped “Update (YYYY-MM-DD)” section with the following subsections:
    - Observations (what you saw)
    - Logs (paste relevant snippets; redact PII unless in dev)
    - Analysis (what you think it means)
    - Hypotheses (ranked by likelihood)
    - Actions Taken (code/config/logging changes and where)
    - Results (what changed after actions; pass/fail)
    - Next Steps (what to try next, prioritized)
    - Owner (your name/initials)
- Logging hygiene:
  - Redact emails/IDs in shared logs; only include PII in dev-guarded logs.
  - Note which environment (dev vs prod), browser, and build type (dev w/ StrictMode or prod build).
  - Prefer structured logs that include page, component, event name, and elapsed timing.
- Where to instrument:
  - `src/contexts/AuthContext.tsx` (getSession timing, subscription lifecycle, resolveLoading calls)
  - `src/contexts/AccountContext.tsx` (auth dependencies gating, account fetch lifecycle)
  - `src/components/auth/ProtectedRoute.tsx` (gating decisions and inputs)
  - `src/pages/*` impacted pages (entry, guards, data loads)
  - `src/services/supabase.ts` (invitation handling and user doc creation)
- When you implement changes, also add a short “Changes Implemented (YYYY-MM-DD)” note summarizing what you touched (files/components), the intent, and any toggles/flags added.
- When you adjust the plan, create “Amended Next Steps (YYYY-MM-DD)” instead of overwriting prior steps.
- Keep Reproduction Steps updated and minimal so anyone can quickly re-trigger the issue.

Quick template (copy/paste):

```markdown
### Update (YYYY-MM-DD)

- Environment: dev/prod build, browser, StrictMode on/off
- Observations:
  - ...
- Logs:
  - <paste redacted snippets>
- Analysis:
  - ...
- Hypotheses (ranked):
  1) ...
  2) ...
- Actions Taken:
  - Edited <file> – <very short description>
  - Added instrumentation <where>
- Results:
  - ...
- Next Steps:
  1) ...
  2) ...
- Owner: <name/initials>
```

## Auth Initialization Timeout Investigation

- **Reported by**: Benjamin
- **Reported on**: 2025-11-08
- **Area**: Supabase auth flow (`AuthContext`)
- **Status**: Logging added for active investigation

### Summary

- Navigating between pages while authenticated or attempting to sign back in after signing out reliably ends with `Auth initialization timed out. Forcing loading to false.` from `AuthContext`.
- When redirected to the sign-in page, the UI shows an indefinite `Completing sign in...` spinner followed by the same timeout warning, preventing re-authentication.
- Issue affects multiple pages and appears independent of specific navigation targets.

### Reproduction Steps

1. Sign in successfully through Google OAuth.
2. Navigate across several app pages (e.g., `ClientSummary`, `ProjectDetail`).
3. Observe forced navigation to the sign-in page with a timeout warning in devtools.
4. Attempt to sign back in; note the infinite spinner and repeating timeout.

### Current Instrumentation

- Added structured `console.debug` / `console.warn` / `console.error` events throughout `src/contexts/AuthContext.tsx`.
- Logs include:
  - Initialization lifecycle: start, session fetch results, subscription status, completion.
  - `onAuthStateChange` events with Supabase session metadata (user id, email, last sign-in timestamp).
  - Loading state transitions with contextual event names.
  - Sign-in / sign-out invocations and their outcomes.
  - Error surfaces for session retrieval, user document updates, and Supabase event handling.

### Notable Deviations and Risks

- Subscribe order/race window
  - Current: `getSession()` is called before subscribing to `onAuthStateChange`.
  - Risk: A fast `'SIGNED_IN'` could occur between the calls and be missed.
  - Best practice: subscribe first, then call `getSession()`.

- Loading state timing and safety timeout
  - Current: `setLoading(false)` is invoked both after init and inside the auth listener; the 7s timeout closes over initial `loading`.
  - Risk: racey state transitions, flicker, and timeouts if resolution logs never run.
  - Best practice: resolve loading from a single place; use a ref (e.g., `hasResolvedAuthRef`) for the timeout guard.

- Global loading toggled during OAuth redirects
  - Current: `signIn()`/`signOut()` toggle global `AuthContext.loading`.
  - Risk: app-wide spinners/flicker that interfere with route guards and create confusing UX during redirects.
  - Best practice: keep loading local to the initiating button/page; let the auth listener drive global state.

- Fragile `AuthCallback` handling
  - Current: waits a fixed 100ms before `getSession()`; clears `pendingInvitationData` immediately after setting it.
  - Risks: timing flakiness (session not ready yet), invite data cleared before `createOrUpdateUserDocument` can read/consume it.
  - Best practice: rely on the auth listener or poll `getSession()` with a bounded timeout; clear invite data only after user doc creation path consumes it.

- Route guard only checks session, not app user readiness
  - Current: `ProtectedRoute` gates on `isAuthenticated` and `loading` (auth) only.
  - Risk: downstream contexts (e.g., account) can thrash while `user`/account data is still loading, causing repeat fetches.
  - Best practice: either gate by both session and app user readiness, or ensure downstream contexts are idempotent and back off when inputs are not ready.

- Over-eager user doc updates on initial load
  - Current: `createOrUpdateUserDocument` runs on initial session and again on `'SIGNED_IN'`.
  - Risk: unnecessary writes on every app load; extra latency surface for timeouts.
  - Best practice: run on `'SIGNED_IN'` only, or ensure the update is very cheap/idempotent.

- Verbose logs with PII in production
  - Current: user IDs/emails are logged unconditionally.
  - Risk: PII in production logs.
  - Best practice: gate verbose/PII logs behind `import.meta.env.DEV`.

- React StrictMode double-invoke in dev
  - Current: effects can mount/unmount twice in dev.
  - Risk: duplicate subscriptions and confusing logs if handlers aren’t idempotent.
  - Best practice: keep subscriptions/cleanup idempotent; guard with instance flags when needed.

- Downstream context loading loops
  - Observation: `AccountContext` toggles `loading` as auth resolves; pages like `Projects` retry until account is ready.
  - Risk: repeated fetch loops or perceived hangs if account resolution stalls.
  - Best practice: ensure guarded fetches, debounce/backoff, and early returns when dependencies are not ready.

### Next Steps

- Reorder auth init: subscribe to `onAuthStateChange` first, then call `getSession()`.
- Resolve loading in a single place; replace timeout with a ref-based guard.
- Remove global `setLoading(true/false)` from `signIn`/`signOut`; keep spinners local.
- In `AuthCallback`, replace fixed delay with bounded polling or rely on listener; clear `pendingInvitationData` only after user doc creation consumes it.
- Gate verbose/PII logs behind `import.meta.env.DEV`.
- Ensure downstream contexts back off when dependencies aren’t ready (and/or gate routes on app user readiness).
- Capture failing-session logs and Supabase network traces to confirm whether events stop or `getCurrentUserWithData` stalls.

### Notes

- Dev environment uses React StrictMode; effects fire twice in dev. Keep subscriptions and cleanups idempotent.

### Related Files

**Implementation & Testing Documentation** (in `dev_docs/auth-initialization-timeout/`):
- `TROUBLESHOOTING_COMPLETE.txt` - Quick overview and status (START HERE)
- `TROUBLESHOOTING_SUMMARY_2025-11-08.md` - Complete testing guide & debugging patterns
- `IMPLEMENTATION_CHECKLIST_2025-11-08.md` - Step-by-step verification checklist
- `KEY_CODE_CHANGES.md` - Code snippets showing all key changes
- `README_AUTH_TROUBLESHOOTING.md` - Documentation index

**Source Code Files**:
- `src/contexts/AuthContext.tsx` - Main instrumentation and safety redirect implementation
- `src/components/auth/ProtectedRoute.tsx` - Enhanced route protection
- `src/pages/Projects.tsx` - No-account guard
- `src/pages/BusinessInventory.tsx` - No-account guard
- `src/services/supabase.ts` - Singleton client verification
- Pages impacted: `ClientSummary`, `PropertyManagementSummary`, `ProjectDetail`, `EditItem`, and other auth-protected routes.

### Post-change Observations (2025-11-08)

- After implementing the initial fixes (subscribe-first, ref-guarded loading, local spinners, AuthCallback polling):
  - Infinite spinners occurred across the app when clicking around.
  - `AuthContext` safety timeout still fired in dev:
    - `[AuthContext] Initialization timed out. Forcing loading to false. { supabaseUser: 'null', appUser: 'null' }`
    - React dev output referenced `commitDoubleInvokeEffectsInDEV` which indicates StrictMode double-invoke.
  - Instead of being redirected to the login screen, user landed on a “Design Business Inventory” page with:
    - No associated account, no usable top menu, and a generally confusing state.
    - Suggests route guard gaps or page-level assumptions when unauthenticated.
  - `Projects` page console logs on a fresh navigation to the app root:
    - `Projects.tsx:23 🔍 Projects - useEffect triggered. accountLoading: false currentAccountId: null isLoading: false`
    - `Projects.tsx:65 🔍 Projects - loadInitialData called. accountLoading: false currentAccountId: null`
    - `Projects.tsx:91 🔍 Projects - No account ID, clearing data`
    - The above sequence repeated, indicating pages proceeded with "no account" instead of gating by auth/user readiness.

### Preliminary Analysis

- Auth loading timeout still occurred with both `supabaseUser` and `user` being `null`. This implies:
  - Neither the `onAuthStateChange` callback nor the `getSession()` initialization path resolved `resolveLoading()` before the 7s safety timer.
  - Possibilities:
    - `getSession()` may be hanging or throwing before our `resolveLoading()` call.
    - Our subscription callback isn't firing (missed event, duplicate/unsubscribed listener, or client duplication).
    - StrictMode double-invoke complicates timing; effect mounts/unmounts twice and may leave a race window despite the ref guard.
- Route guarding:
  - `ProtectedRoute` only gates by `isAuthenticated` and `loading` (auth). If `loading` is false and `isAuthenticated` is false, we render `<Login />`.
  - User observed landing on the inventory page instead, which suggests:
    - Some routes are not wrapped in `ProtectedRoute`, or
    - Navigation landed on a public route that assumes account context, leading to a broken/empty "Design Business Inventory" view.
- Account and page loading:
  - `AccountContext` now backs off if `authLoading` or `!user`, and sets `loading=false` when no user.
  - Pages like `Projects` run their effects when `accountLoading=false`, even if `currentAccountId=null`, causing repeated “No account ID” logs. This is technically correct but poor UX when unauthenticated.

### Hypotheses

1. getSession stall or early error
   - `supabase.auth.getSession()` may intermittently fail or take longer than the safety timeout in dev, especially under StrictMode.
   - We need granular timing logs (start/finish/elapsed) and explicit error capture on this path.
2. Subscription lost or double-created
   - StrictMode double-mount/unmount may cause an unsubscribe/re-subscribe race or a lost reference.
   - A duplicated Supabase client instance could also lead to events not reaching our listener.
3. Route guard coverage gap
   - Some routes, especially the inventory landing, may not be wrapped in `ProtectedRoute`.
   - As a result, unauthenticated users can hit pages that expect an account and render confusing states.
4. Page-level assumptions on account presence
   - Pages trigger data loads when `accountLoading=false` even if `currentAccountId=null`, then “clear data” in a loop.
   - Better gating/early returns with explicit unauthenticated UI is needed.

### Immediate UX Mitigations (to plan/implement)

- On auth timeout with `!supabaseUser && !user`, render a clear sign-in CTA or redirect to `/login` (instead of leaving users on an unusable page).
- Strengthen route guard:
  - Gate on both `isAuthenticated` and `user` readiness (not just session/auth).
  - Optionally show a short spinner while `authLoading` is true; otherwise send to `<Login />`.
- Page-level guardrails:
  - If `!currentAccountId` and not loading, show a clear “No account selected / Please sign in” message or route to a selection/login page.

### Instrumentation Additions Needed

- High fidelity timing logs in `AuthContext`:
  - When effect mounts/unmounts (with a unique instance ID).
  - When subscription is created (include a local incremental listener ID).
  - When `onAuthStateChange` fires (event, hadSession, timestamp).
  - When `initializeAuth` starts, `getSession()` starts, resolves, and errors (with elapsed ms).
  - When `resolveLoading()` runs; current values of `supabaseUser`, `user`, and whether we’re initial load.
- StrictMode detection tag in logs to confirm double invoke behavior in dev.
- Capture network traces for Supabase auth requests during the failure window.

### Amended Next Steps (prioritized)

1. Add the instrumentation above to definitively trace whether `getSession()` or the auth listener path is not firing/finishing.
2. As a safety net, if the 7s timeout fires and `!supabaseUser && !user`, redirect to `/login` (or render `<Login />`) to avoid dead-end pages.
3. Audit `App.tsx` to ensure all protected routes are wrapped with `ProtectedRoute`. Ensure inventory landing is gated.
4. Update `ProtectedRoute` to gate on `isAuthenticated && !!user` (and show spinner while `authLoading`), not just session.
5. Update key pages (e.g., `Projects`, `Inventory`) to render explicit "not signed in / no account" CTAs when `currentAccountId` is null and not loading, preventing silent empty states.
6. Verify Supabase client is initialized once and reused—avoid duplicate instances across hot reloads/StrictMode.
7. Re-test in dev (StrictMode on) and in a production build (StrictMode off) to compare behavior and confirm resolution.

---

## Changes Implemented (2025-11-08)

### High-Fidelity Instrumentation Added to AuthContext

**File**: `src/contexts/AuthContext.tsx`

Implemented detailed logging infrastructure to trace auth initialization flow:

- **Instance Tracking**: Each effect mount gets a unique `instanceId` (helps detect StrictMode double-invoke in dev)
- **Listener Tracking**: Each `onAuthStateChange` subscription gets an incremental `listenerId`
- **Timing Metrics**: 
  - `initStartTime` and elapsed ms calculations for entire init flow
  - `getSessionElapsedMs` for `supabase.auth.getSession()` call
  - `getCurrentElapsedMs` for `getCurrentUserWithData()` call
- **Structured Logs**:
  - `[EFFECT MOUNT]`: When effect mounts (with instance ID and StrictMode warning)
  - `[EFFECT CLEANUP]`: When effect cleans up, with total elapsed time
  - `[INIT START]`: Initialization start with timestamp
  - `[SUBSCRIPTION]`: When listener is created
  - `[GET_SESSION]`: Session retrieval attempts with timing
  - `[LISTENER N]`: Auth state change events with context
  - `[TIMEOUT]`: Safety timeout with state snapshot
  - `[LOADING RESOLVED]`: When loading resolves with source identification

- **Source Tracking**: Each call to `resolveLoading()` now includes a source label (`getSession_no_session`, `listener_1_SIGNED_IN`, etc.)

### Safety Redirect on Timeout Without Auth

**Files**: 
- `src/contexts/AuthContext.tsx` (added `timedOutWithoutAuth` state)
- `src/components/auth/ProtectedRoute.tsx` (checks timeout flag)

Implementation:
- Added `timedOutWithoutAuth` state to AuthContext
- If safety timeout fires and `!supabaseUser && !user`, set `timedOutWithoutAuth = true`
- ProtectedRoute now checks `timedOutWithoutAuth` and shows `<Login />` component
- Prevents users from landing on broken/empty pages when auth fails to initialize

### Route Structure Audit (App.tsx)

**File**: `src/App.tsx`

Verified route structure is correct:
- Public routes: `/auth/callback`, `/invite/:token`
- All other routes wrapped in `ProtectedRoute` inside `<Layout />`
- No gaps in route protection

### Enhanced Route Protection

**File**: `src/components/auth/ProtectedRoute.tsx`

Updated guard to check both session and app user readiness:
- Before: Only checked `isAuthenticated` (session exists) and `loading` (auth loading)
- After: Also checks `!!user` (app user document loaded) in addition to `isAuthenticated`
- This prevents pages from rendering with incomplete user state

### Page-Level No-Account Guards

**Files**: 
- `src/pages/Projects.tsx`
- `src/pages/BusinessInventory.tsx`

Added explicit guards when not loading but no account:
- Projects page: Shows "No Account Selected" message with link to Settings
- BusinessInventory page: Shows "No Account Selected" message with link to Settings
- Prevents silent empty states and provides clear guidance to users

### Supabase Client Initialization Verification

**File**: `src/services/supabase.ts`

Verified Supabase client is initialized as a module-level singleton:
- `supabase` client is created once at module load (line 13)
- Exported as `export const supabase`
- All imports of `supabase` reference the same instance
- No duplication across hot reloads or StrictMode

### Summary of Changes

| Step | Status | Files Modified |
|------|--------|-----------------|
| 1. High-fidelity instrumentation | ✅ Complete | `AuthContext.tsx` |
| 2. Safety redirect on timeout | ✅ Complete | `AuthContext.tsx`, `ProtectedRoute.tsx` |
| 3. Route structure audit | ✅ Complete | `App.tsx` (verified) |
| 4. Enhanced route protection | ✅ Complete | `ProtectedRoute.tsx` |
| 5. Page-level no-account guards | ✅ Complete | `Projects.tsx`, `BusinessInventory.tsx` |
| 6. Supabase singleton verification | ✅ Complete | `supabase.ts` (verified) |
| 7. Testing in dev/prod | ⏳ Pending | |

### Next Steps for Testing

1. **Dev Testing (with StrictMode)**:
   - Clear browser storage
   - Open DevTools → Console
   - Sign in with Google
   - Navigate between pages
   - Check console for instrumentation logs
   - Verify `[EFFECT MOUNT]`, `[LISTENER N]`, and `[LOADING RESOLVED]` logs
   - If timeout occurs, verify `[TIMEOUT]` log shows instance/listener IDs
   - Verify no infinite spinners occur

2. **Production Testing (StrictMode off)**:
   - Build with `npm run build`
   - Test same flow
   - Compare log patterns with dev build
   - Verify auth resolves cleanly

3. **Edge Cases to Verify**:
   - Refresh page while authenticated → Should not timeout
   - Sign out and sign back in → Should complete cleanly
   - Navigate between Projects and BusinessInventory → No timeouts
   - Load app without auth → Show login, then allow sign in

