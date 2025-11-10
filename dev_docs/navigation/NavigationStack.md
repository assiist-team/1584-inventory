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


