# Inventory Allocation Follow-Up Issues

## 1. Project Item List Jumps Before Removal
- **Scenario**: When changing an item's disposition from a project to business inventory (e.g., via `InventoryList`), the item briefly jumps to the top of the project list, the viewport scrolls to the top, and only then does the item disappear.
- **Expected**: The item should disappear smoothly in place without reordering the list or changing the scroll position.
- **Actual**: The optimistic state update plus the real-time subscription reconciliation causes the item to reinsert at the start of the list before removal, which also pulls the scroll into view.
- **Notes / Next Steps**:
  - Audit the `subscribeToProjectItems` handler to avoid unshift-ing newly observed items that already existed in the optimistic view.
  - Preserve scroll position when mutating the list (e.g., by using stable keys or deferring focus changes).
  - Consider delaying the insert of items that appear via subscription until we know the user is not the actor who just removed them.

## 2. Canonical Inventory Transactions Not Updating in UI
- **Scenario**: Moving items between projects and business inventory should update the canonical `INV_SALE_<projectId>` or `INV_PURCHASE_<projectId>` transactions. The database rows get updated, but the UI (transactions lists, totals) does not reflect the new amounts without a manual refresh.
- **Expected**: Transaction totals and item lists refresh automatically right after allocation/deallocation.
- **Actual**: UI continues to show stale amounts and item counts until the entire page is reloaded.
- **Notes / Next Steps**:
  - Verify that `transactionService` real-time subscriptions include canonical transactions (they may be filtered out or the client cache may ignore updates when item IDs change).
  - Ensure the transactions view recalculates totals when `item_ids` or `amount` columns change.
  - Add integration tests that allocate/deallocate and assert the UI updates without refresh.
