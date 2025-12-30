# Plan: Centralize Inventory Deallocation on Disposition Changes

## Problem Summary

When a user changes an item's disposition to `inventory` from any UI surface tied to a project transaction, the business logic that:
- removes the item from its project/transaction,
- appends the lineage edge,
- creates/updates the canonical `INV_SALE_<projectId>` transaction, and
- refreshes inventory lists

only runs if that UI explicitly calls `integrationService.handleItemDeallocation`. Screens such as InventoryList, BusinessInventory, and ItemDetail do so, but TransactionDetail and EditTransaction rely on `TransactionItemsList`, whose `updateDisposition` helper simply patches `disposition` via `unifiedItemsService.updateItem`. As a result, the pipeline does not execute, so moved items never leave the transaction nor appear in inventory.

The current model forces every caller to remember to invoke the deallocation pipeline manually, which is brittle and contradicts our requirement that “any time an item's disposition changes to inventory, deallocation runs regardless of context.”

## Goals

1. **Single source of truth**: A centralized service detects `disposition` changes to `inventory` and kicks off deallocation without caller awareness.
2. **Idempotent + safe**: Multiple rapid updates or redundant calls must not create duplicate lineage edges or canonical transactions.
3. **Non-regressive**: Existing screens calling `integrationService.handleItemDeallocation` should keep working (possibly simplified), and no new race conditions should appear.
4. **Traceable**: Audit logs and lineage edges still capture the same events.

## Non-Goals

- Changing UX copy or layout for disposition controls.
- Replacing the deallocation pipeline implementation itself (audit logging, transaction creation, etc. stay as-is).
- Solving allocation-to-project flows (out of scope).

## Current Touchpoints

| Location | Behavior today |
| --- | --- |
| `InventoryList`, `BusinessInventory`, `ItemDetail` | `updateDisposition` sets disposition then calls `integrationService.handleItemDeallocation` when new disposition === `inventory`. Works as expected. |
| `TransactionItemsList` (used in TransactionDetail/EditTransaction and other forms) | Only updates the `disposition` field; no deallocation call. Moved items stay linked to the transaction. |
| `unifiedItemsService.updateItem` | Generic update helper; unaware of disposition semantics. |

## Proposed Architecture

1. **Introduce `itemDispositionService.setDisposition`**
   - Accepts `{ accountId, itemId, newDisposition }`.
   - Internally fetches the current item to compare dispositions.
   - Delegates to `unifiedItemsService.updateItem` for the write.
   - If the previous disposition != `inventory` and the new one == `inventory` and the item is associated with a project transaction (has `projectId` or `transactionId` tied to project), invoke `deallocationService.handleInventoryDesignation`.
   - If the disposition changes away from `inventory`, no deallocation call is made.
   - Returns the updated item (or a minimal payload) so callers can refresh state.

2. **Wire every UI to the new service**
   - Replace direct `unifiedItemsService.updateItem(..., { disposition })` calls and direct `integrationService.handleItemDeallocation` calls with `itemDispositionService.setDisposition`.
   - `TransactionItemsList` becomes simple: call the service and update local state with the returned disposition (or refetch).
   - InventoryList/BusinessInventory/ItemDetail no longer need to remember to run the pipeline manually; they call the same helper and can drop their explicit `integrationService` dependency.

3. **Guardrails inside `itemDispositionService`**
   - **Idempotence**: Track whether the item is already in business inventory (`projectId` null and `transactionId` canonical). If so, skip re-running the pipeline.
   - **Error handling**: If deallocation fails, roll back the disposition (reapply the previous value) to keep UI consistent and surface the error to the caller for toast messaging.
   - **Concurrency**: Use `Promise.allSettled` or sequential awaits to ensure state changes happen in order (update disposition, then call deallocation). Consider a mutex per item id (simple map) during the operation to avoid double triggers if multiple components edit the same item simultaneously.

4. **Optional backend safety net**
   - Investigate a Supabase trigger (`AFTER UPDATE`) on `items.disposition` that enqueues a background task (via Edge Function) when `OLD.disposition != 'inventory' AND NEW.disposition = 'inventory' AND NEW.project_id IS NOT NULL`.
   - This acts as a fallback so that even non-updated clients still result in proper deallocation. For the initial pass we can focus on the client-side centralization but document this follow-up.

## Implementation Steps

1. **Create service**
   - Add `src/services/itemDispositionService.ts` (or extend `inventoryService` namespace) exporting `setDisposition`.
   - Unit-test edge cases: no change, change to inventory with project, already in inventory, failure path.

2. **Update UI surfaces**
   - `TransactionItemsList.tsx`: replace `unifiedItemsService.updateItem` usage with the new service; remove `integrationService` dependency entirely.
   - `InventoryList.tsx`, `BusinessInventory.tsx`, `ItemDetail.tsx`: switch to `itemDispositionService.setDisposition` and delete direct `integrationService.handleItemDeallocation` calls.
   - Any other components (search `disposition:`) to ensure coverage (e.g., `ProjectItemsPage`, `VendorDefaultsManager` if applicable).

3. **Centralize toast/error reporting**
   - Have `itemDispositionService.setDisposition` throw descriptive errors (e.g., `DeallocationFailedError`) so UIs can present uniform messaging.

4. **Telemetry and logging**
   - Keep console/info logs in the service (mirroring existing deallocation logs) for troubleshooting.

5. **(Optional) Supabase trigger spike**
   - Draft SQL migration for `items_disposition_inventory_trigger` to enqueue `inventory_designation_jobs`.
   - Decide after client changes ship; document as stretch goal.

## Testing Strategy

1. **Unit tests**
   - Add tests in `src/services/__tests__/itemDispositionService.test.ts` mocking `unifiedItemsService` and `deallocationService`.
   - Verify triggers occur only when disposition transitions from non-inventory → inventory and projectId exists.

2. **Integration tests**
   - Extend existing transaction/item tests to simulate a disposition toggle from TransactionDetail and assert:
     - item leaves `transaction.items`
     - appears in `movedItems`
     - `integrationService.handleItemDeallocation` (mock) called once.

3. **Manual QA checklist**
   - TransactionDetail: move an item to inventory → disappears from list, shows under “Moved items,” appears in BusinessInventory.
   - EditTransaction: same flow while in editing mode; ensure save not required.
   - InventoryList + BusinessInventory + ItemDetail: regression test to confirm flows still succeed.

## Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| Double deallocation if both UI and service call the pipeline | Remove direct UI calls; only the new service invokes deallocation. |
| Performance hit from fetching the item before every update | Restrict fetch to cases where `disposition` is part of the update payload; reuse cached item data when caller already has it (allow optional `currentItemSnapshot`). |
| Older clients (without the new service) still bypass logic | (Optional) Supabase trigger ensures eventual consistency; communicate upgrade requirement. |

## Success Criteria

- There is exactly one code path that triggers deallocation for inventory disposition updates.
- Changing disposition to `inventory` from any screen yields the same state/result as doing it from InventoryList today.
- Tests cover the new service, and manual QA shows transaction view/edit immediately reflects moved items.

