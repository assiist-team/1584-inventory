# Allocation System Refactor (No Migration)

## Executive Summary

Today the app duplicates items across two separate collections:
- `projects/{projectId}/items` (per‑project duplicates)
- `business_inventory` (business stock)

This causes data drift and complex flows. We will refactor to a single top‑level `items` collection as the source of truth. Project assignment is tracked by `project_id`; availability is tracked by `inventory_status`. No migration/backwards compatibility is required — we will change the code to point at the new `items` collection and delete duplication logic.

## What the code does today (verified)

- Project items are queried from a project subcollection:
```12:18:src/services/inventoryService.ts
export const itemService = {
  // Get items for a project with filtering and pagination
  async getItems(
    projectId: string,
    filters?: FilterOptions,
    pagination?: PaginationOptions
  ): Promise<Item[]> {
const itemsRef = collection(db, 'projects', projectId, 'items')
```

- Business inventory is queried/written in `business_inventory`:
```971:978:src/services/inventoryService.ts
const itemsRef = collection(db, 'business_inventory')
let q = query(itemsRef)
```

- Batch allocation creates duplicate project items and marks business items as sold:
```1281:1315:src/services/inventoryService.ts
// Create project items from business inventory items
const projectItemRef = doc(db, 'projects', projectId, 'items', projectItemId)
...
batch.set(projectItemRef, projectItemData)
...
const itemRef = doc(db, 'business_inventory', itemId)
batch.update(itemRef, {
  inventory_status: 'sold',
  current_project_id: projectId,
  pending_transaction_id: transactionRef.id,
})
```

- Single allocation creates a project transaction and updates only the business inventory item:
```1210:1232:src/services/inventoryService.ts
const transactionsRef = collection(db, 'projects', projectId, 'transactions')
const transactionRef = await addDoc(transactionsRef, transactionData)
...
await this.updateBusinessInventoryItem(itemId, {
  inventory_status: 'pending',
  current_project_id: projectId,
  pending_transaction_id: transactionRef.id
})
```

- Transaction item lookup reads project subcollection items by `transaction_id`:
```640:645:src/services/inventoryService.ts
const itemsRef = collection(db, 'projects', projectId, 'items')
const q = query(
  itemsRef,
  where('transaction_id', '==', transactionId),
  orderBy('date_created', 'asc')
)
```

- Types already include fields needed for unified items (note: both exist today):
```60:88:src/types/index.ts
export interface Item {
  ...
  transaction_id: string;
  project_id: string; // currently required
  ...
  inventory_status?: 'available' | 'pending' | 'sold';
  current_project_id?: string; // duplicate concept; to be removed
}
```

## Target Architecture (single source of truth)

- Collection: `items` (top‑level)
- Example item document fields:
  - `item_id: string` (document id)
  - `project_id?: string | null` (null ⇒ business inventory; `projectId` ⇒ allocated)
  - `inventory_status: 'available' | 'pending' | 'sold'`
  - `pending_transaction_id?: string` (set while allocation is pending)
  - existing fields: `description`, `project_price`, `market_value`, `images`, etc.

- Project “inventory” view = `items` WHERE `project_id == projectId`.
- Business inventory view = `items` WHERE `project_id == null`.
- Transactions store which items are involved via `item_ids: string[]`.

## Refactor Plan (no migration, no backward compatibility)
Make the following code edits. You can keep everything inside `src/services/inventoryService.ts` for now to minimize churn, then optionally split later.

### 1) Types
- In `src/types/index.ts`:
  - Make `Item.project_id` nullable: `project_id?: string | null`.
  - Remove `Item.current_project_id` everywhere in code and types.
  - Replace `BusinessInventoryItem` usages with `Item` and remove `BusinessInventoryItem` interface after refactor.
  - Extend `Transaction` to link items:
    - Add `item_ids?: string[]` (batch and single use this uniformly).

### 2) New item repository API (top‑level `items`)
Implement these functions (either in a new `itemsService` or within `inventoryService.ts`). All use `collection(db, 'items')`:
- `getItemsByProject(projectId: string): Promise<Item[]>`
  - Query: `where('project_id', '==', projectId')`, order by `last_updated` desc.
- `subscribeToItemsByProject(projectId: string, cb: (items: Item[]) => void)`
- `getBusinessInventoryItems(filters?): Promise<Item[]>`
  - Query: `where('project_id', '==', null)` + optional `inventory_status` and text filter.
- `subscribeToBusinessInventory(cb, filters?)`
- `createItem(data: Omit<Item, 'item_id'|'date_created'|'last_updated'>): Promise<string>`
- `updateItem(itemId: string, updates: Partial<Item>): Promise<void>`
- `deleteItem(itemId: string): Promise<void>`

### 3) Allocation and sale flows (no duplicates)
Replace the existing allocation/deallocation/batch logic:
- `allocateItemToProject(itemId, projectId, amount?, notes?)`:
  - Create a project transaction in `projects/{projectId}/transactions` with `status: 'pending'`, `trigger_event: 'Inventory allocation'`, and `item_ids: [itemId]`.
  - Update the item (top‑level `items/{itemId}`):
    - `project_id = projectId`
    - `inventory_status = 'pending'`
    - `pending_transaction_id = <transactionId>`
- `batchAllocateItemsToProject(itemIds[], projectId, { notes?, space? })`:
  - Create a single transaction with `item_ids = itemIds` (no creating project duplicates).
  - For each `itemId`, update top‑level item as above; do NOT write to `projects/{projectId}/items`.
- `returnItemFromProject(itemId, transactionId, projectId)`:
  - Update transaction to `status: 'cancelled'`.
  - Update item: `inventory_status = 'available'`, `pending_transaction_id = undefined`, set `project_id = null`.
- `completePendingTransaction(itemId, transactionId, projectId, paymentMethod)`:
  - Update transaction to `status: 'completed'`, set `payment_method`.
  - Update item: `inventory_status = 'sold'`, `pending_transaction_id = undefined`. Keep `project_id` (to show project of sale) or set to null if you want it removed from project views after sale.

Implement a helper: `getItemsForTransaction(projectId, transactionId)` that queries top‑level `items` where `(pending_transaction_id == transactionId) OR (transaction_id == transactionId)` and optionally `project_id == projectId`.

### 4) Replace old per‑collection code paths
Remove usage of:
- `collection(db, 'projects', projectId, 'items')`
- `collection(db, 'business_inventory')`

Update callers to use the new top‑level items API. Files to edit:
- `src/pages/InventoryList.tsx`
  - Replace `itemService.getItems(projectId)` with `getItemsByProject(projectId)`.
  - Replace `itemService.subscribeToItems(projectId, cb)` with `subscribeToItemsByProject(projectId, cb)`.
- `src/pages/BusinessInventory.tsx`
  - Replace all `businessInventoryService.*` calls with top‑level `items` equivalents (get/subscribe/create/update/delete/duplicate if needed).
  - Update batch allocation to call `batchAllocateItemsToProject` from the new flow (no duplicates).
- `src/pages/BusinessInventoryItemDetail.tsx`
  - Replace `businessInventoryService.allocateItemToProject` with the new `allocateItemToProject` (top‑level `items`).
  - Replace `deleteBusinessInventoryItem/updateBusinessInventoryItem` with `deleteItem/updateItem` on `items`.
- `src/pages/TransactionDetail.tsx`, `src/pages/AddTransaction.tsx`, `src/pages/EditTransaction.tsx`
  - Change any calls to `itemService.getTransactionItems(projectId, transactionId)` to use the new `getItemsForTransaction(projectId, transactionId)` against top‑level `items`.

### 5) Transactions shape
- In all transaction creations related to allocation, include `item_ids`.
- For batch allocation, set all item IDs in that single transaction.
- For “sale complete”, set `status: 'completed'` and move `pending_transaction_id` off the item; optionally set a final `transaction_id` on the item for historical linkage.

### 6) Clean up types and dead code
- Remove `BusinessInventoryItem` interface and all imports/usages after callers are updated.
- Remove `current_project_id` field everywhere; standardize on `project_id?: string | null`.
- Remove/deprecate the old per‑project items API and any UI code that depends on it.

### 7) Firestore security rules
- Open `firestore.rules` and grant appropriate read/write access to the top‑level `items` collection as your app requires.
- Remove references that assumed `projects/*/items` and `business_inventory`.

## Acceptance checklist
- All item queries read from top‑level `items` only.
- Project views filter by `project_id`.
- Business inventory view filters by `project_id == null`.
- Allocation updates the same item: sets `project_id`, `inventory_status = 'pending'`, and links a transaction; no duplicates created.
- Batch allocation updates only the existing items and creates a single transaction with `item_ids`.
- Transaction detail pages show items by querying top‑level `items` for the given `transactionId`.
- No references to `projects/{projectId}/items` or `business_inventory` remain.

## Notes for the implementer (why this is safe now)
- Verified current duplication and wrong-collection usage:
```116:121:src/services/inventoryService.ts
const itemsRef = collection(db, 'projects', projectId, 'items')
```
```1251:1260:src/services/inventoryService.ts
const businessItemsRef = collection(db, 'business_inventory')
```
- Verified `Item` currently has both `project_id` and `current_project_id`; this refactor removes the latter and makes `project_id` nullable.

## Additional cleanup recommendations
- Standardize on a single cost field naming: prefer `purchase_price` and remove any duplicate `price` usage where possible.
- If you no longer need `item.transaction_id` on the item document, replace it with `last_transaction_id` (optional) and rely on `Transaction.item_ids` for linkage.
- Ensure QR key generation (`qr_key`) is consistent in allocation and creation flows.
- Remove any references to per‑project item images handling that assume subcollections; images should live on the top‑level item document.
