# Inventory Transaction Round-Trip Refactor Plan

## Summary
- Items that originate in a project purchase transaction lose their original `transactionId` as soon as they are returned to business inventory.
- When those items are later reallocated to the same project, they remain detached from the original transaction, so category totals (e.g., Furnishings) under-report spend.
- We will persist the prior project transaction metadata when deallocating to business inventory and reinstate it on reallocation to the originating project.

## Current Behavior
- `handleNewReturn()` (triggered by `returnItemFromProject`) writes the item into the canonical `INV_SALE_<projectId>` transaction and overwrites `item.transactionId` with that sale id, without preserving the original project purchase transaction.
- `handleSaleToInventoryMove()` (Scenario A.1 in `allocateItemToProject`) subsequently removes the item from the sale transaction and explicitly sets `transactionId: null`, leaving nothing to restore.  
  ```1430:1586:src/services/inventoryService.ts
  await this.updateItem(accountId, itemId, {
    projectId: _projectId,
    inventoryStatus: 'allocated',
    transactionId: null,
    disposition: 'keep',
    space: space ?? ''
  })
  ```

## Goals
- Maintain an authoritative link to the original project purchase transaction for items that temporarily live in business inventory.
- Automatically restore the original transaction (and its budget category/tax context) when the item returns to the originating project.
- Preserve backward compatibility for items that never had an original project transaction.

## Proposed Changes
- **Schema (Supabase `items` table)**  
  - Add nullable columns `previous_project_transaction_id` and `previous_project_id` (or reuse existing JSON metadata if available) to store the prior linkage.
  - Populate them via migration for future moves; no backfill needed for historical data.
- **Service updates (`unifiedItemsService` in `inventoryService.ts`)**
  - When `handleReturnFromPurchase` or `handleNewReturn` runs, capture the current `transactionId` (if it is a project purchase) into the new columns before switching the item to `INV_SALE_<projectId>`.
  - When `handleSaleToInventoryMove` executes, check the stored `previous_project_transaction_id`:
    - If it exists and matches the target project, reattach the item to that transaction (updating `item_ids` and recalculated amounts) and set the item’s `transactionId` back to it.
    - Clear the stored previous-transaction fields after successful restoration.
  - Add resilience for cases where the stored transaction was deleted (fall back to existing behavior but log for troubleshooting).
- **Audit trail**
  - Include the restored transaction id in allocation events so support can trace the lifecycle.
- **Testing**
  - Extend service unit tests to cover round-trip scenarios:
    1. Project purchase → return to inventory → reallocate to same project restores original transaction.
    2. Round-trip when original transaction was deleted gracefully falls back.
    3. Reallocation to a different project ignores stored original transaction.

## Risks & Mitigations
- **Data drift**: Original transaction might be deleted while item sits in inventory.  
  _Mitigation_: Detect missing transaction and clear stored metadata, emit warning.
- **Concurrent moves**: Simultaneous operations on the same item could race.  
  _Mitigation_: Reuse existing sequential service patterns; add optimistic locking if needed.
- **Migration impact**: Adding columns requires coordinated Supabase migration.  
  _Mitigation_: Ship migration script alongside code change; mark columns nullable to avoid downtime.

## Open Questions
- Should we persist additional context (e.g., amount snapshot, budget category) to handle transaction edits that occur while the item is in inventory?
- Do we need a UI indicator showing the original transaction will be restored on reallocation?

## Next Steps
- Draft Supabase migration for new columns.
- Implement service changes outlined above.
- Add regression tests for round-trip flows.
- Validate on staging with real round-trip scenario before releasing.

