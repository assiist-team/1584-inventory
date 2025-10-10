Prop Plan: Tax Hydration
=======================

Purpose
-------
Document expected behavior for tax percentage (`taxRatePct`) hydration so implementers handle the two primary UI flows where inheritance must occur, and to preserve any already-implemented behavior.

Background
----------
There are multiple ways items and transactions are created in the app. The tax percentage is a transaction-level field that should be inherited by items when appropriate so calculations and UX are consistent.

Primary requirements
--------------------
- **Case A — Item(s) created while creating a Transaction (transaction-first flow):**
  - When the user creates a new Transaction and, during that same flow, creates one or more Items associated with that Transaction, any Item that does not explicitly set `taxRatePct` **must** inherit the Transaction's `taxRatePct` value (if the Transaction has one).
  - This applies whether the UI creates the Transaction first and then creates items in the same submission, or sends a single API call that creates the Transaction and Item documents together.

- **Case B — Item(s) added to an existing Transaction (transaction exists first):**
  - When a Transaction already exists and the user adds Items to it (e.g. from the Transaction detail screen), any newly created Item that does not explicitly set `taxRatePct` **must** inherit the parent Transaction's `taxRatePct` value (if present).  This can either happen when creating an item using the independent additem ui element and selecting a transaction to associate it with or by adding an item from the transaction detail page.

- **Preserve existing implemented inheritance:**
  - If the codebase already implements a tax inheritance behavior for any other creation flow (for example, when creating an Item standalone and the app currently propagates an explicit tax field to related objects), do not remove that behavior. The change here is additive: ensure Cases A and B are covered in addition to whatever already works.

Edge cases and rules
--------------------
- If an Item explicitly sets `taxRatePct` during creation, that value takes precedence and no inheritance should override it.
- If the Transaction does not have a `taxRatePct` (null/undefined), Items should not receive a tax value by inheritance.
- Changing a Transaction's `taxRatePct` after Items already exist must **not** retroactively change existing Items' stored `taxRatePct` unless an explicit migration/UX action is performed. (If retroactive updates are desired, they should be handled by a separate migration or explicit user action.)

Acceptance criteria
-------------------
- Unit/integration tests that cover both Case A and Case B: creating transaction+items together and adding items to an existing transaction result in items with `taxRatePct === transaction.taxRatePct` when item did not set a value.
- Manual QA steps:
  1. Create a new Transaction with `taxRatePct = 8.875` and add two Items during that creation; verify both Items have `taxRatePct` set to `8.875`.
  2. Create a Transaction with `taxRatePct = 0` (or unset) and add an Item; verify the Item has no `taxRatePct`.
  3. Open an existing Transaction that has `taxRatePct` set and add a new Item via the Transaction detail UI; verify the new Item inherits the Transaction's `taxRatePct`.

Implementation notes
--------------------
- Data model:
  - Ensure `taxRatePct?: number` exists on both `Transaction` and `InventoryItem` types.

- Suggested code locations to check/update:
  - `src/services/inventoryService.ts` — where item creation and transaction creation logic live; ensure item creation paths that receive a `transactionId` consult the transaction's `taxRatePct` when item-level value is missing.
  - `src/pages/AddTransaction.tsx` / `src/pages/AddItem.tsx` / `src/pages/TransactionDetail.tsx` — UI places where items may be created during or after transaction creation; confirm they pass expected `taxRatePct` to the service layer or backend call.

- Backwards compatibility:
  - Make the behavior additive and opt for conservative changes: if a code path already sets item `taxRatePct` correctly, leave it unchanged.

Questions / open decisions
-------------------------
- Should updating a Transaction's `taxRatePct` offer a prompt to apply the new rate to existing Items? (Not in scope for this change; document as follow-up.)

Revision history
----------------
- 2025-10-10 — Initial draft covering the two primary cases and acceptance criteria.



Appendix: quick developer notes
--------------------------------
- **Do not remove existing inheritance behavior.** If you discover an existing path that already propagates `taxRatePct` correctly, leave it intact and extend similar behavior to other paths instead of replacing it.
- **Places to inspect first:** `src/services/inventoryService.ts`, `src/pages/AddTransaction.tsx`, `src/pages/AddItem.tsx`, `src/pages/TransactionDetail.tsx`.
- **Testing reminder:** Add unit/integration tests for both Case A and Case B and run the test suite before submitting changes.

