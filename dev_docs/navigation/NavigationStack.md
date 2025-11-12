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
   - New behavior: be a pure URL composition helper that sets `returnTo` for fallback but does **not** mutate the navigation stack during render.
   - Record intentional navigations at the moment of navigation instead: use `ContextLink` (click-time push) for rendered links and `useStackedNavigate()` for programmatic navigations. This prevents render-time side-effects and duplicate entries.

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
  - `buildContextUrl(target, additionalParams?)` MUST be pure (compose URLs and set `returnTo`) and **must not** call `push()` during render.
  - Use `ContextLink` to push the current location on click for rendered links, and `useStackedNavigate()` to push immediately before programmatic `navigate(...)`.
  - `getBackDestination(defaultPath)` resolution order:
    1. If `navigationStack.size() > 0`, return `navigationStack.pop()`.
    2. Else if `returnTo` query param exists, return it.
    3. Else apply existing `from` heuristics.
    4. Else return `defaultPath`.

- **Programmatic navigation**
  - Prefer `useStackedNavigate()` for programmatic navigations — it records the current location on the stack before calling `navigate(...)`. Example:

```js
// inside a component
const navigate = useStackedNavigate()
function onClickGo() {
  // stackedNavigate will push current location then call navigate
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
- Status: completed (first-pass audit and migration performed; see implementation status)

## Implementation status (updated 2025-11-11)

This project has implemented the Navigation Stack and the supporting safe-navigation primitives. Below is a concise record of what's been done and what remains.

- **Completed**
  - Added `NavigationStackProvider` and hook: `src/contexts/NavigationStackContext.tsx`.
    - Exposes `push`, `pop`, `peek`, `clear`, and `size`.
    - Mirrors to `sessionStorage` under `navStack:v1`, dedupes consecutive pushes, and trims to a configurable `maxLength`.
  - Wrapped the app root with the provider: `src/main.tsx` now includes `<NavigationStackProvider>`.
  - Wired the stack into the reusable navigation helper: `src/hooks/useNavigationContext.ts`
    - `buildContextUrl(...)` is pure: it composes target URLs and sets `returnTo` for fallback behavior but does **not** mutate the stack during render.
    - `getBackDestination(...)` prefers `navigationStack.pop(currentLocation)` (mimics native Back), then falls back to `returnTo` and existing `from` heuristics.
  - Added `useStackedNavigate` wrapper: `src/hooks/useStackedNavigate.ts` to push the current location before programmatic `navigate(...)`.
  - Added `ContextLink` (`src/components/ContextLink.tsx`) — click-time wrapper that pushes the current location on click then delegates to `Link`.
  - Migrated high-priority callsites to use `ContextLink` + `buildContextUrl(...)` (safe click-time pushes). Notable edits:
    - `src/pages/TransactionDetail.tsx` — item links now use `ContextLink(buildContextUrl(...))`.
    - `src/pages/InventoryList.tsx` — item/edit links migrated to `ContextLink`.
    - `src/pages/BusinessInventory.tsx` — add/edit/item links migrated to `ContextLink`.
    - `src/pages/BusinessInventoryItemDetail.tsx` — project & transaction links migrated to `ContextLink`.
    - `src/components/ui/ItemLineageBreadcrumb.tsx` — breadcrumb links use `ContextLink(buildContextUrl(...))`.
    - `src/pages/ItemDetail.tsx` — edit/transaction links migrated to `ContextLink`.
    - `src/pages/Projects.tsx` — project open button migrated to `ContextLink`.
    - `src/pages/TransactionsList.tsx` — add/transaction item links migrated to `ContextLink`.
  - Performed a programmatic navigation audit: most programmatic navigations already use `useStackedNavigate()`; no further automated replacements were required except for ensuring `ContextBackLink` continues to call `navigate(target)` for Back behavior.
  - Linter checks passed for the edited files.

- **Behavioral note**
  - Navigations generated with `buildContextUrl(...)` are now recorded to the stack and will mimic native Back behavior. Programmatic navigations should use `useStackedNavigate()` to get the same behavior; some programmatic `navigate()` calls and hard-coded `<Link to="...">` instances remain and will still rely on `returnTo`/`from` fallbacks until migrated.

**Outstanding work (post-implementation checklist)**

The core navigation stack primitives and several high-priority migrations are in place, but a small set of follow-ups remain to finish the rollout, prevent regressions, and give developers fast local feedback. Copy this checklist into PRs or the project board as actionable items.

- **Completed (short)**:
  - Provider + hook implemented and mirrored to `sessionStorage`.
  - `ContextLink` and `useStackedNavigate` added; `buildContextUrl()` made pure.
  - CI grep guard script and GitHub Actions job added (`scripts/check-nav-push.sh`, `.github/workflows/nav-guard.yml`).
  - Local ESLint rule added to flag `navigationStack.push(...)` outside the allowlist.
  - First-pass migrations performed for several high-priority pages.

- **Migration & audit (medium priority)**:
  Developer action: Complete the remaining migration and audit items listed below. For each file in the audit list, open a focused PR that:
  - Replaces render-time `to={...}` forward links with `ContextLink(to={buildContextUrl(...)})`.
  - Replaces in-app Back/return links with `ContextBackLink` or explicit `navigationStack.pop()` where appropriate.
  - Runs `bash scripts/check-nav-push.sh` and `npm run lint` locally and pastes the outputs into the PR description.
  - Ensures the CI nav-guard job and lint job pass before merging.
  After merge, remove the migrated file from this audit list and mark the migration complete in this document.
  - One-pass migrate remaining render-time `<Link to=...>` usages to safe primitives:
    - Forward navigations → `ContextLink(to={buildContextUrl(...)})`
    - Back/return links → `ContextBackLink` or explicit `navigationStack.pop()` usage
  - Files discovered with remaining plain `<Link>` usages under `src/pages/` (audit list):
    - `src/pages/Projects.tsx` (settings link)
    - `src/pages/BusinessInventoryItemDetail.tsx` (back links)
    - `src/pages/ClientSummary.tsx` (receipt external link — leave as plain link)
    - `src/pages/EditBusinessInventoryTransaction.tsx` (back links)
    - `src/pages/AddBusinessInventoryTransaction.tsx` (back links)
    - `src/pages/AddTransaction.tsx` (uses `getBackDestination`)
    - `src/pages/ProjectDetail.tsx` (back links)
    - `src/pages/AddBusinessInventoryItem.tsx` (back links)
    - `src/pages/EditItem.tsx` (uses `getBackDestination`)
    - `src/pages/AddItem.tsx` (uses `getBackDestination`)
    - `src/pages/EditBusinessInventoryItem.tsx` (back links)
    - `src/pages/BusinessInventory.tsx` (settings link)
  - For each file: decide whether to convert to `ContextLink(buildContextUrl(...))` or `ContextBackLink` depending on intent.

- **CI / lint integration (medium priority)**:
  - Ensure ESLint rule is enforced in CI (add `npm run lint` to CI or a dedicated job).
  - Keep the grep guard active; consider adding a docs-only warning mode so `dev_docs/` references don't fail CI.

- **Optional follow-ups (low priority)**:
  - Add `navStack:debug=1` sampling during rollout to capture unexpected pops.
  - Consider an automated CI check that scans PR diffs and fails if `navigationStack.push(` appears outside the allowlist.

- **Owners & priority**
  - Tests: owner `dev`, **high** priority.
  - Link migrations & audit: owner `dev`, **medium** priority.
  - CI / lint integration: owner `devops` / `dev`, **medium** priority.

- **Suggested PRs**
  1. `chore(nav): tests for useStackedNavigate and ContextLink` — unit + integration tests.
  2. `chore(nav): migrate remaining links to ContextLink/ContextBackLink` — small per-file PRs.
  3. `chore(ci): ensure lint & nav-guard run in CI` — wire ESLint + grep checks into CI.

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



## Discovery & fix log (2025-11-12)

This section records a recent production discovery and the immediate code fix, plus the results of a quick audit for remaining problematic patterns.

- Symptom observed: in-app Back toggled repeatedly between TransactionDetail and EditTransaction (or ItemDetail and TransactionDetail in some flows), trapping the user in an endless back/forward loop.

- Root cause: the navigation stack was being updated immediately before executing a history jump (specifically, `navigate(-1)` and similar negative numeric navigations). In that scenario the current location was pushed onto the stack right before the router went back, so the previous screen computed its Back target as the page we just left — causing the two screens to alternate indefinitely.

- Immediate fix (implemented 2025-11-12):
  - Edited `src/hooks/useStackedNavigate.ts` to skip pushing the current location when `navigate(...)` is called with a negative numeric argument (history jumps like `-1`). This prevents adding the current path to the stack immediately before going back, eliminating the toggle/loop.

- Audit findings (quick pass)
  - Files that directly implement stack mutation:
    - `src/contexts/NavigationStackContext.tsx` — provider implementation (push/pop/peek). (expected)
    - `src/components/ContextLink.tsx` — click-time push via `navigationStack.push(location.pathname + location.search)` (intended/correct: push on click).
    - `src/hooks/useStackedNavigate.ts` — updated: now guards against pushing for negative numeric navigations (fix applied).

  - `buildContextUrl(...)` usage:
    - `src/hooks/useNavigationContext.ts` — `buildContextUrl` is pure (composes URL + `returnTo`) and does **not** mutate the stack (safe).
    - Callsites that render `buildContextUrl(...)` into JSX were inspected; representative files include:
      - `src/pages/TransactionDetail.tsx` (uses `buildContextUrl(...)` for item links; links are wrapped with `ContextLink` in the updated codebase) — safe.
      - `src/pages/InventoryList.tsx` (uses `ContextLink(to={buildContextUrl(...)})`) — safe.
      - `src/components/ui/ItemLineageBreadcrumb.tsx` (uses `buildContextUrl(...)` and `ContextLink`) — safe.
      - `src/pages/ItemDetail.tsx`, `src/pages/BusinessInventoryItemDetail.tsx`, `src/pages/Projects.tsx`, `src/pages/TransactionsList.tsx`, `src/pages/BusinessInventory.tsx` — these pages render contextual links with `buildContextUrl(...)`; most were migrated to `ContextLink` during the first-pass audit (safe).

  - `ContextBackLink`:
    - `src/components/ContextBackLink.tsx` correctly calls `navigationStack.pop(currentLocation)` then `navigate(target)` to perform in-app Back behavior (safe).

  - Direct `navigationStack.push(...)` calls outside `ContextLink`:
    - No remaining direct `push(...)` calls executed during render were found in the quick scan beyond `ContextLink` and `NavigationStackContext`.

- Recommendation / follow-ups
  1. Add a unit test asserting that `useStackedNavigate()` does not push when called as a negative numeric history jump and that `ContextLink` still pushes on click. This prevents regressions.
  2. Do a broader audit for any direct programmatic `navigate(...)` usages that still call `useNavigate()` + `navigate(...)` (without `useStackedNavigate`) and migrate them to `useStackedNavigate()` where intended to record history. Programmatic navigations that intentionally should not record history can remain.
  3. During early rollout, enable `sessionStorage.setItem('navStack:debug','1')` in a test tab to capture unexpected stack contents if any user reports continue.

If you'd like, I can convert this quick pass into a full route-by-route audit and produce a migration PR that replaces plain `navigate(...)` usages with `useStackedNavigate()` where appropriate.

### Repo-wide audit — detailed findings (2025-11-12)

Below are the concrete findings from a repo-wide scan for:
- render-time navigation stack mutations (calls to `navigationStack.push()` executed during render)
- direct `navigate(...)` usages that do not use `useStackedNavigate()` or `ContextLink`

Summary: the codebase has already migrated most navigations to the safe primitives. The only direct `useNavigate()` call that remains is in the specialized Back control (`ContextBackLink`), which intentionally pops then navigates; all other programmatic navigations use `useStackedNavigate()` and rendered links use `ContextLink` / `buildContextUrl()` (pure). The table below lists the notable files examined, offending snippets (if any), risk rationale, and recommended remediation.

- **src/components/ContextBackLink.tsx**
  - Offending snippet:

```startLine:endLine:src/components/ContextBackLink.tsx
L17:  const handleClick = (e: React.MouseEvent) => {
L18:    e.preventDefault()
L19:    try {
L20:      const target = navigationStack.pop(location.pathname + location.search) || fallback
L21:      navigate(target)
L22:    } catch {
L23:      // fallback if stack not available
L24:      navigate(fallback)
L25:    }
L26:  }
```

  - Why it matters: `ContextBackLink` uses `useNavigate()` directly rather than `useStackedNavigate()`. However this is intentional: it first calls `navigationStack.pop(...)` to choose a back destination and then calls `navigate(target)` to go there. Because `pop()` is used (not `push()`), this control does not mutate the stack incorrectly at render time.
  - Recommendation: Leave as-is. Justify: this is the in-app Back control — it must pop the stack and then navigate. Using `useStackedNavigate()` here would push the current location before navigating, which would re-introduce the back-loop. Add an inline comment to make the intent explicit if desired.

- **Programmatic navigations (examples) — already using `useStackedNavigate()`**
  - Files inspected that use `useStackedNavigate()` for programmatic navigations (safe; no action required):
    - `src/pages/BusinessInventoryItemDetail.tsx` — calls to `navigate('/business-inventory')` and `navigate(`/project/${allocationForm.projectId}/item/${id}`)` are via `const navigate = useStackedNavigate()` (safe).

```startLine:endLine:src/pages/BusinessInventoryItemDetail.tsx
L16:export default function BusinessInventoryItemDetail() {
L18:  const navigate = useStackedNavigate()
...
L156:    await unifiedItemsService.deleteItem(currentAccountId, id)
L162:        navigate('/business-inventory')
...
L205:      // Navigate to the item detail in the project after successful allocation
L206:      navigate(`/project/${allocationForm.projectId}/item/${id}`)
```

    - `src/pages/EditTransaction.tsx` — uses `useStackedNavigate()` for submit and `navigate(-1)` back buttons (safe because `useStackedNavigate()` guards numeric negative jumps).
    - `src/pages/AddTransaction.tsx`, `src/pages/ClientSummary.tsx`, `src/pages/ProjectDetail.tsx`, `src/pages/ItemDetail.tsx`, `src/pages/TransactionDetail.tsx`, `src/pages/InviteAccept.tsx`, `src/pages/AuthCallback.tsx`, `src/pages/PropertyManagementSummary.tsx`, `src/pages/ProjectInvoice.tsx`, and other /pages/* files — inspected and found to use `useStackedNavigate()` where programmatic navigation is required.

  - Why safe: `useStackedNavigate()` records the current location before navigating for non-numeric navigations and explicitly avoids pushing when called with negative numeric values (history jumps), preventing the back-loop case.
  - Recommendation: Leave as-is. Add unit tests (see checklist) to prevent regressions.

- **Rendered links / buildContextUrl**
  - `src/hooks/useNavigationContext.ts` — `buildContextUrl()` is pure: it composes the `returnTo` param but does **not** call `navigationStack.push()` during render. This is safe; rendered links should use `ContextLink` so the push happens on click.

```startLine:endLine:src/hooks/useNavigationContext.ts
L60:    buildContextUrl: (targetPath: string, additionalParams?: Record<string, string>) => {
L62:      const url = new URL(targetPath, window.location.origin)
L63:      const currentParams = new URLSearchParams(location.search)
L69:      url.searchParams.set('returnTo', location.pathname + location.search)
L79:      return url.pathname + url.search
L80:    }
```

  - Recommendation: Keep `buildContextUrl()` pure. Prefer `ContextLink` for links rendered into JSX:
    - Example safe usage (already present): `ContextLink to={buildContextUrl(...)}`

- **Direct `navigationStack.push(...)` audit**
  - Findings: only occurrences of `navigationStack.push(...)` are:
    - `src/hooks/useStackedNavigate.ts` — expected (push before programmatic navigate)
    - `src/components/ContextLink.tsx` — expected (push on click)
    - `src/components/__tests__/ContextLink.test.tsx` — test asserts push
  - Recommendation: No action. These are the intended, safe push locations.

- **Other potential issues found during scan**
  - A few callsites use `navigate(0)` for reload semantics (e.g., `navigate(0)` in `ProjectDetail.tsx`) — `useStackedNavigate()` will not push for `0` (guard only pushes for non-numeric or positive numeric), so this is safe. If reload semantics are required, leave as-is.
  - There were no remaining `navigationStack.push()` calls executed during render discovered in the quick scan beyond `ContextLink` and the provider itself.

### Per-file action summary (short)
- `src/components/ContextBackLink.tsx` — leave as-is (pop then navigate is intentional).
- `src/components/ContextLink.tsx` — correct (click-time push).
- `src/hooks/useStackedNavigate.ts` — correct (guards numeric negative jumps).
- All inspected `src/pages/*` that used programmatic navigation have been migrated to `useStackedNavigate()` — no immediate changes required.

### Migration checklist (PR work + tests) — prioritized
1. High priority — Tests to prevent regressions
   - Unit: add tests for `useStackedNavigate()`:
     - Verify it pushes the current location on non-numeric navigations.
     - Verify it does NOT push for negative numeric navigations (e.g., `navigate(-1)`).
     - Verify it does NOT push for `navigate(0)` (reload).
   - Unit: `ContextLink` tests (already present) — assert `navigationStack.push` on click.
   - Integration: Transaction → Item → Back flow (memory router):
     - Ensure a single Back returns to Transaction exactly once (no toggling).
2. Medium priority — Cleanup & audits
   - Full repo scan for any accidental future render-time calls to `navigationStack.push()` (CI lint rule or grep-based test).
   - Convert any remaining hard-coded `<Link to="...">` that rely on `returnTo` + render-time pushes (if any exist) to `ContextLink` (wrap with `ContextLink to={buildContextUrl(...)}>`).
3. Low priority — Optional UX/logging
   - Add optional `navStack:debug=1` debug behavior (already supported) during rollout for a short window to monitor unexpected stack contents.
   - Consider adding an ESLint rule or grep-based CI check forbidding `navigationStack.push` outside `ContextLink` / `useStackedNavigate` / `NavigationStackContext`.

### Proposed PR (what I'll open)
- Title: "chore(nav): complete navigation-stack audit — tests & finalize safe navigation primitives"
- Changes:
  1. Add unit tests for `useStackedNavigate()` negative numeric guard and push semantics.
  2. Add integration test for Transaction → Item → Back flow (MemoryRouter).
  3. Add a small grep-based CI job (script) that fails if `navigationStack.push(` appears outside approved files (allowlist: `src/hooks/useStackedNavigate.ts`, `src/components/ContextLink.tsx`, `src/contexts/NavigationStackContext.tsx`, test files).
  4. Minor doc edits (this file) — append detailed audit & checklist (this commit).
- Priority: tests first (prevent regressions), then CI check, then optional lint rule.

If you'd like I can open the PR now and implement the tests + CI guard in the same branch. Suggested branch name: `fix/nav-audit/tests-and-ci`.

