# Auth Robustness Gap Closure Plan

## Goal
Ensure the authentication flow recovers reliably in real-world timing scenarios (including navigation between routes, StrictMode double-invocation, cached sessions, and PWA caching) without infinite spinners or timeout-induced logouts.

## Current Gaps
- `timedOutWithoutAuth` flag never resets after a successful session load, leading to false redirects.
- `AuthContext.loading` covers both session detection and user-document fetch, so a slow `getCurrentUserWithData()` keeps the app in a global loading state.
- `AuthProvider` may remount on route changes if not placed at the top of the component tree.
- Dev StrictMode double-invocation can create subscribe/unsubscribe races; instance IDs should remain stable across navigations.
- Manifest syntax error suggests possible service worker issues serving stale bundles.
- `AuthCallback` still relies on brittle timing assumptions during OAuth return.

## Remediation Steps
1. **Reset Timeout Flag**
   - In `AuthContext`, clear `timedOutWithoutAuth` whenever `supabaseUser` or `user` becomes non-null so legitimate sessions render normally.

2. **Decouple Loading States**
   - Introduce a separate `userLoading` flag (or derive from `user === null && supabaseUser !== null`), resolve `loading` immediately after session detection, and gate downstream pages on `!!user`.

3. **Verify Provider Location**
   - Confirm `AuthProvider` wraps the entire app (above router/layout). If it currently sits inside route components, relocate it to prevent remounts on navigation.

4. **Harden StrictMode Behavior**
   - Log and verify `instanceId` is stable when navigating. If it changes, inspect React tree to remove provider remount triggers. Ensure listener cleanup is idempotent.

5. **Fix Manifest and Service Worker**
   - Resolve the manifest syntax error, then test with the service worker disabled/cleared to eliminate stale bundle risk.

6. **Strengthen Auth Callback Flow**
   - Replace fixed waits with listener-driven resolution or bounded polling. Ensure it hands off to `AuthContext` cleanly without manipulating global loading state.

## Validation Checklist
- Navigate between all major routes while logged in; confirm no new effect mount logs (`[EFFECT MOUNT]`) appear mid-navigation.
- Observe `[LOADING RESOLVED]` firing within 7s on both cold and warm loads with an existing session; ensure `timedOutWithoutAuth` resets to `false`.
- Simulate slow `getCurrentUserWithData()` (e.g., throttle network); verify global auth finishes loading, while pages show clear “loading user data” messaging.
- Run dev build under StrictMode and a production build without it; ensure consistent behavior and absence of auth timeouts.
- Clear caches, fix manifest, and test PWA deployment to confirm no stale scripts reintroduce old logic.
