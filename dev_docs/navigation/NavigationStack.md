# NavigationStack — Design & Integration Guide

Status: proposed

This document specifies a robust, stack-based navigation system for the app to replace fragile query-param-only back semantics. It includes API, integration points, implementation steps, edge-cases, and examples.

---

## Motivation

- Current app uses URL query parameters (`returnTo`, `from`, `project`, `transactionId`) to reconstruct a "back" destination. That works for many flows but is brittle:
  - Links sometimes fail to include full context (e.g., missing `project`), causing Back to go to defaults.
  - Deep links and cross-tab behavior complicate consistent back semantics.
  - Browser back/forward expectations (pop behavior) are not consistently replicated.

A lightweight in-memory navigation stack (mirrored to `sessionStorage`) provides deterministic Back semantics while preserving URL-based fallbacks for deep links and cross-tab scenarios.

## Goals

- Provide accurate "Back" behavior in common flows (transaction → item → back to transaction).
- Minimal breaking changes — integrate with existing `useNavigationContext` and `buildContextUrl`.
- Persist stack across reloads in the same tab (via `sessionStorage`), but not across tabs.
- Allow progressive rollout (URL fallback remains).

## Core API

Create a React context/provider `NavigationStackProvider` and a hook `useNavigationStack()` that exposes:

- `push(path: string): void` — push a path (pathname + search) onto the stack.
- `pop(defaultPath?: string): string | null` — pop and return last path; if empty, return `defaultPath` or `null`.
- `peek(defaultPath?: string): string | null` — return top without popping.
- `clear(): void` — clear the stack.
- `size(): number` — number of entries.

Options for the provider:

- `mirrorToSessionStorage?: boolean` (default: true) — mirror stack to `sessionStorage` key `navStack:v1`.
- `maxLength?: number` (default: 200) — limit stack size.

Implementation details:

- Use `useRef<string[]>([])` for the stack storage and `useState` for size updates when needed.
- On mount, hydrate from `sessionStorage` if mirror enabled.
- Write to `sessionStorage` on push/pop/clear.
- Avoid pushing duplicate consecutive entries.

## Integration with existing hooks

`useNavigationContext` (current implementation) will be adjusted:

1. `buildContextUrl(targetPath, additionalParams?)`:
   - Current behavior sets `returnTo = location.pathname + location.search`.
   - New behavior: call `navigationStack.push(location.pathname + location.search)` before returning the composed URL. Continue to set `returnTo` for fallback.
   - This ensures any Link created via `buildContextUrl(...)` records the current screen as the previous stack entry.

2. `getBackDestination(defaultPath)`:
   - New resolution order:
     1. If `navigationStack.size() > 0`, return `navigationStack.pop()` (mimic native Back).
     2. Else if `returnTo` query param exists, return it.
     3. Else use existing `from` heuristics (e.g., `from=transaction` + `project` + `transactionId`).
     4. Else return `defaultPath`.
   - Make sure `pop()` skips entries equal to current location (prevents immediate no-op).

## SessionStorage / Cross-tab behavior

- `sessionStorage` is per-tab and matches expected UX (Back preserved across reload in same tab).
- Cross-tab: stack won't transfer. If cross-tab behavior is required later, consider `BroadcastChannel` or `localStorage` with `storage` events (more complexity).

## UX edge-cases & rules

- Only push when the navigation is intentional (Link generation or programmatic navigate) — not on passive URL changes triggered by history navigation.
- When popping, if the top path equals the current path, pop again until different or empty.
- Prevent loops: when pushing, do not push if top equals the new entry.
- Keep `returnTo`/`from` as secondary fallback to handle deep links and external reloads.

## Operational details & rules

- **Session storage key & mirroring**
  - Mirror stack to `sessionStorage` under the key `navStack:v1`. This keeps the stack per-tab and persisted across reloads.
  - On provider mount, hydrate from `sessionStorage` if present and validate entries.

- **Push rules (when and how)**
  - Only push on intentional navigations:
    - Link generation via `buildContextUrl(...)`
    - Programmatic navigation (calls to `navigate(...)`) initiated by UI events
  - Do not push on passive history events (popstate) or redirects performed by the router on load.
  - Deduplicate consecutive entries: if `stack.peek() === entry` skip the push.
  - Trim stack to `maxLength` (default 200) after push.

- **Pop rules**
  - `pop()` should return the top-most entry !== current location. If the top equals current location, pop repeatedly until a different entry or empty.
  - Validate popped entries (basic sanity check: non-empty string); ignore invalid entries and continue popping.
  - If `pop()` finds nothing, return `null`.

- **Integration with `useNavigationContext`**
  - `buildContextUrl(target, additionalParams?)` MUST call `navigationStack.push(location.pathname + location.search)` before returning the composed URL.
  - `getBackDestination(defaultPath)` resolution order:
    1. If `navigationStack.size() > 0`, return `navigationStack.pop()`.
    2. Else if `returnTo` query param exists, return it.
    3. Else apply existing `from` heuristics.
    4. Else return `defaultPath`.

- **Programmatic navigation**
  - Before calling `navigate('/path')`, call `navigationStack.push(location.pathname + location.search)` to record the current screen. Example:

```js
// inside a component
const { push } = useNavigationStack()
const location = useLocation()
function onClickGo() {
  push(location.pathname + location.search)
  navigate('/target')
}
```

- **App back button handler (pseudocode)**

```js
const target = navigationStack.pop()
if (target) navigate(target)
else {
  // fallback to query param heuristics
  const fallback = getBackDestinationFromQueryOrHeuristics('/projects')
  navigate(fallback)
}
```

- **Hydration & validation**
  - On provider mount, read `navStack:v1`. If entries are malformed or equal to current path, normalize/filter them out.
  - Avoid hydrating an entry equal to the current location (prevent immediate no-op pops).

- **Modal/overlay handling**
  - For simple overlays, prefer pushing the underlying path (so Back returns to that screen).
  - For overlays that change URL state, push a special entry encoding modal state only if necessary; otherwise rely on `returnTo` fallback.

- **Tests**
  - Unit tests: push, pop, peek, hydrate, dedupe, trimming.
  - Integration/E2E: important flows (Transaction → Item → App back), modal back behavior, behavior when stack empty and `returnTo` present.

These operational rules should be appended to the design doc before implementation to reduce regressions and ensure consistent behavior across the app.

## Examples

- Transaction → Item flow:
  - TransactionDetail builds item link with:
    `/project/PROJ1/item/ITEM42?from=transaction&project=PROJ1&transactionId=TX123&returnTo=/project/PROJ1/transaction/TX123`
  - `buildContextUrl` will also `push('/project/PROJ1/transaction/TX123')`.
  - On ItemDetail Back:
    - `getBackDestination` pops `/project/PROJ1/transaction/TX123` and returns it.
    - If stack empty, `returnTo` fallback returns `/project/PROJ1/transaction/TX123`.

- Business inventory → Project item:
  - Build link with `from=business-inventory-item` and `returnTo=/business-inventory`.
  - Stack will contain `/business-inventory`, ensuring Back returns there.

## Implementation plan (concrete steps)

1. Add provider and hook:
   - Add `src/contexts/NavigationStackContext.tsx` implementing provider and `useNavigationStack`.

2. Wrap app:
   - Wrap root in `App.tsx` (or `index.tsx`) with `<NavigationStackProvider>`.

3. Wire into `useNavigationContext`:
   - Import `useNavigationStack`.
   - Update `buildContextUrl` to call `push(currentPath)`.
   - Update `getBackDestination` to prefer `pop()` result.

4. Audit key pages:
   - Confirm `TransactionDetail` and other transaction/item pages use `buildContextUrl` (TransactionDetail is already updated).
   - Ensure any other places that produce item links use `buildContextUrl` instead of manual `to` strings.

5. Tests:
   - Unit test for `useNavigationStack` push/pop/hydration.
   - Integration/E2E test covering Transaction → Item → Back.

6. Logging & metrics (optional):
   - Add debug logging during early rollout to detect unexpected pops.

## Files to add / edit

- Add: `src/contexts/NavigationStackContext.tsx`
- Edit: `src/App.tsx` or root to wrap provider
- Edit: `src/hooks/useNavigationContext.ts`
- Audit/edit: `src/pages/*` as needed
- Tests: `src/contexts/__tests__/NavigationStackContext.test.tsx` and relevant integration tests

## Rollout & fallback

- Deploy with provider + integrations; URL fallbacks ensure no user-facing breaks.
- After verification, remove excessive debug logs.

## Notes / Alternatives

- Alternative: use global Redux-like store for navigation — heavier weight, more upfront work.
- Alternative cross-tab: `localStorage` + `storage` event or `BroadcastChannel` to sync stack across tabs (not recommended initially).

---

If you want, I can:
- Implement the `NavigationStackProvider` and wire it into `useNavigationContext` now.
- Produce a route-by-route CSV/markdown mapping of the pages under `src/pages` for a more exhaustive navigation map.

## Known issue: Back navigation loop (Transaction ↔ Item)

Severity: high — can trap users in an endless back/forward loop.

Reproduction steps:
1. From a project page navigate to a transaction detail (Project → Transaction).
2. From the transaction detail open an item (Transaction → Item).
3. Press the app's Back control (the in-app "Back" link/button) to return to the transaction.
4. Press Back again — UI toggles between TransactionDetail and ItemDetail repeatedly.

Observed behavior:
- Back alternates between the transaction and the item indefinitely until the user navigates elsewhere or closes the tab.

Suspected root causes:
- Mutating the navigation stack during render (e.g., calling `navigationStack.push()` from `buildContextUrl()` or other render-time code) can record the current path at render-time rather than at the moment of navigation. This leads to duplicate or out-of-order entries that confuse `pop()` semantics.
- Some callsites still call `buildContextUrl(...)` during render which previously invoked `push(...)`. That creates entries equal to the current location or duplicates, and `pop()` logic that skips current-location entries may repeatedly return the other entry, producing a toggle.

Temporary mitigations:
- Stop pushing to the stack during render. Use a click-time push (see `ContextLink`) or call `navigationStack.push()` immediately before programmatic `navigate(...)` instead of inside `buildContextUrl()`. This ensures the stack entry represents an intentional navigation event.
- When popping, ensure `pop(currentLocation)` skips entries equal to the current location and continues until it finds a different entry or returns null. The provider already implements skipping, but state mutations at render-time can still leave duplicates; avoid creating those duplicates.

Recommended permanent fixes / next steps:
1. Migrate render-time `push()` usages to `ContextLink` (click-time push) and `useStackedNavigate()` (programmatic push) — this reduces render-side effects and prevents double-recording of entries.
2. Remove any remaining `navigationStack.push()` calls from functions that are executed during render (including `buildContextUrl()`), and ensure `buildContextUrl()` is pure (only composes URLs and sets `returnTo`).
3. Add unit tests that assert `pop()` behavior when stack contains consecutive duplicate entries and when top equals current location; add integration tests for Transaction → Item → Back confirming a single Back returns to the transaction exactly once.
4. During early rollout, enable lightweight debug logging (`navStack:debug=1` in sessionStorage) to capture unexpected stack contents and identify remaining render-time pushes.

Notes:
- This doc already recommended a `ContextLink` wrapper for safe push-on-click behavior — the loop above is exactly the kind of bug this change prevents. The codebase has been updated to add `ContextLink` and remove `push()` from `buildContextUrl()`, but please audit for any remaining callsites that still call `push()` during render or that render `buildContextUrl()` at render time (they should render URLs but not cause side-effects).

TODO: Audit remaining render-time pushes
- Action: search the codebase for any remaining render-time usages of `navigationStack.push(...)` or direct calls to `buildContextUrl(...)` that run during render and migrate them to `ContextLink` or `useStackedNavigate()`.
- Owner: dev
- Priority: high
- Status: pending

## Implementation status (updated 2025-11-11)

This project has implemented a first-pass Navigation Stack and integrated it into the main navigation helper. Below is a concise record of what's been done and what remains.

- **Completed**
  - Added `NavigationStackProvider` and hook: `src/contexts/NavigationStackContext.tsx`.
    - Exposes `push`, `pop`, `peek`, `clear`, and `size`.
    - Mirrors to `sessionStorage` under `navStack:v1`, dedupes consecutive pushes, and trims to a configurable `maxLength`.
  - Wrapped the app root with the provider: `src/main.tsx` now includes `<NavigationStackProvider>`.
  - Wired the stack into the reusable navigation helper: `src/hooks/useNavigationContext.ts`
    - `buildContextUrl(...)` records the current path onto the stack (via `push(...)`) and still sets `returnTo` for fallback behavior.
    - `getBackDestination(...)` prefers `navigationStack.pop(currentLocation)` (mimics native Back), then falls back to `returnTo` and existing `from` heuristics.
  - Added `useStackedNavigate` wrapper: `src/hooks/useStackedNavigate.ts` to push the current location before programmatic `navigate(...)`.
  - Migrated high-priority link usages to use `buildContextUrl(...)` and recorded the previous screen onto the stack. Notable edits:
    - `src/pages/TransactionDetail.tsx` — item links now use `buildContextUrl(...)`.
    - `src/pages/InventoryList.tsx` — edit and item links now use `buildContextUrl(...)`.
    - `src/pages/BusinessInventory.tsx` — add/edit/item links updated to `buildContextUrl(...)`.
    - `src/pages/BusinessInventoryItemDetail.tsx` — project & transaction links updated to `buildContextUrl(...)`.
    - `src/components/ui/ItemLineageBreadcrumb.tsx` — breadcrumb links use `buildContextUrl(...)`.
    - `src/pages/ItemDetail.tsx` — edit link updated to use `buildContextUrl(...)`.
  - Linter checks passed for the edited files.

- **Behavioral note**
  - Navigations generated with `buildContextUrl(...)` are now recorded to the stack and will mimic native Back behavior. Programmatic navigations should use `useStackedNavigate()` to get the same behavior; some programmatic `navigate()` calls and hard-coded `<Link to="...">` instances remain and will still rely on `returnTo`/`from` fallbacks until migrated.

- **Remaining work (recommended migration plan)**
  1. Complete migration of remaining manual `returnTo`/hard-coded `to` links to `buildContextUrl(...)` (in-progress).
  2. Replace `useNavigate` usages with `useStackedNavigate` across programmatic navigations (forms, modals, button handlers).
  3. Add unit tests for `NavigationStackProvider` (push/pop/hydration/dedupe) and integration/E2E tests for critical flows (Transaction → Item → Back).
  4. Audit all pages under `src/pages/` and `src/components/` for stray hard-coded links or missing context params; migrate progressively.
  5. Optionally add lightweight debug logging during the early rollout to detect unexpected pop behavior.
  6. Implement `ContextLink` wrapper and migrate render-time pushes to click-time pushes:
    - Problem: many callsites render `buildContextUrl(...)` directly into JSX (`to={buildContextUrl(...)}`), and the current `buildContextUrl` calls `navigationStack.push(...)` during render. Mutating stack/state during render can trigger React render-time updates or freezes (as observed).
    - Solution:
      1. Add `src/components/ContextLink.tsx` — a small wrapper around `react-router`'s `Link` that accepts the same props, calls `navigationStack.push(location.pathname + location.search)` in an `onClick` handler (or before navigation), and then delegates to `Link`. This records the previous screen at the moment of navigation (safe).
      2. Remove side-effects from `buildContextUrl(...)` (it should only compose URLs and preserve `returnTo`/`from`), or at minimum stop calling `push()` from code paths executed during render.
      3. Migrate high-priority callsites to use `<ContextLink to={buildContextUrl(...)}>` instead of `to={buildContextUrl(...)}.` Programmatic navigations should continue to use `useStackedNavigate()` (or call `navigationStack.push()` immediately before `navigate(...)`).
    - Migration priority: `TransactionDetail` → `ItemDetail` → `InventoryList` → `BusinessInventory` → `ItemLineageBreadcrumb`, then remaining pages.
    - Tests: add unit tests for `ContextLink` (asserts it calls `push()` on click) and integration tests for Transaction → Item → Back flow.

Files changed by the implementation (representative):

- `src/contexts/NavigationStackContext.tsx` (new)
- `src/hooks/useNavigationContext.ts` (updated)
- `src/main.tsx` (updated to wrap provider)
- `src/hooks/useStackedNavigate.ts` (new)
- `src/pages/TransactionDetail.tsx` (updated)
- `src/pages/InventoryList.tsx` (updated)
- `src/pages/BusinessInventory.tsx` (updated)
- `src/pages/BusinessInventoryItemDetail.tsx` (updated)
- `src/components/ui/ItemLineageBreadcrumb.tsx` (updated)
- `src/pages/ItemDetail.tsx` (updated)
- `src/components/ContextLink.tsx` (new)

If you'd like, I can:
- Start migrating the critical links (Transaction → Item, Business Inventory) now.
- Implement `useStackedNavigate` and replace programmatic navigations in the same pass.


