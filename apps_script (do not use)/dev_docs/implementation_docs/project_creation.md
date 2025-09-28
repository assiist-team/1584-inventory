New project creation — plan
==========================

Purpose
-------
Provide a simple, reliable way to create a new project by adding project-specific tabs to the existing Inventory spreadsheet (items) and the existing Transactions spreadsheet (ledger). No new spreadsheets are created. The flow also records a stable `project_id` in an index for future lookups.

How projects are created (end-to-end)
-------------------------------------
1) User action (UI)
   - In `Dashboard.html`, open "Projects → Create Project".
   - Modal collects a single required field: `Project Name`.
   - Submit calls `google.script.run.withSuccessHandler(onCreated).createProject({ project_name })`.

2) Server action (`createProject(payload)` in `apps_script/Code.gs`)
   - Validate `project_name` and sanitize to a safe tab name (replace disallowed chars; cap length; de-duplicate by appending ` 2`, ` 3`, ... if necessary).
   - Generate a new `project_id` (see algorithm below).
   - Open existing spreadsheets by Script Properties:
     - Inventory: `INVENTORY_SPREADSHEET_ID`
     - Transactions: `TRANSACTIONS_SPREADSHEET_ID`
   - Create tabs if missing:
     - Inventory tab: set standard Inventory headers (see below).
     - Transactions tab: set standard Transactions headers (see below).
   - Upsert an entry into the `PROJECTS_INDEX` sheet in the Inventory spreadsheet (create the sheet and headers if absent).
   - Return `{ project_id, project_name, inventory_tab, transactions_tab }`.

3) UI follow-up
   - Success message with created tabs and `project_id`.
   - Refresh the project selector (uses `listSheets()` which already reads `PROJECTS_INDEX`).

Outcomes
--------
- A one-field form in the Dashboard (`Projects` → `Create Project`) that asks for `Project Name`.
- On submit, the backend:
  1) Generates a stable `project_id` (e.g., `P-<base36 timestamp>-<rand>` or UUID; see below).
  2) Creates a new Inventory tab in the existing Inventory spreadsheet with standard headers.
  3) Creates a new Transactions tab in the existing Transactions spreadsheet with standard headers.
  4) Adds/updates an entry in `PROJECTS_INDEX` with `{ project_id, project_name, inventory_tab, transactions_tab, created_at }`.
  5) Records metadata only (no Drive file storage in this phase).

Project ID generation and storage
---------------------------------
- Generator function: `generateProjectId()`.
  - Implementation: prefer `Utilities.getUuid()` for uniqueness and simplicity (already used in `createProject` today), or a short ID: `P-<base36 timestamp>-<base36 rand>`.
  - For now, we will keep `Utilities.getUuid()` to match the existing code path and minimize change risk.
- Where stored: a dedicated row in `PROJECTS_INDEX` with columns:
  - `project_id`, `project_name`, `inventory_tab`, `transactions_tab`, `created_at`, `created_by`
- Access path:
  - `listSheets()` (already implemented) reads `PROJECTS_INDEX` to populate the project selector. We will update it if needed to read the exact headers above.

Headers
-------
- Inventory tab headers (current, ensure present):
  `item_id, transaction_id, project_id, store_name, sku, project_name, date_created, description, price, source, last_updated, notes, qr_key, bookmark, payment_method`

- Transactions tab headers (aligned with the transactions form):
  `transaction_id, project_id, project_name, date, source, location, type, method, amount, notes, receipt, emailed, created_at, created_by`

Backend changes
---------------
- Script Properties used
  - `INVENTORY_SPREADSHEET_ID` (existing)
  - `TRANSACTIONS_SPREADSHEET_ID` (already present in `apps_script/Code.gs`)
  - `PROJECTS_INDEX_SHEET_NAME` = `PROJECTS_INDEX`

- Endpoints
  - `createProject(payload)` (already exists) should be extended to also:
    - Open the Transactions spreadsheet by `TRANSACTIONS_SPREADSHEET_ID`.
    - Create the project tab (sheet) if missing with the Transactions headers above.
    - Ensure `PROJECTS_INDEX` exists with headers: `project_id, project_name, inventory_tab, transactions_tab, created_at, created_by` and append a new row.
    - Return `{ project_id, project_name, inventory_tab, transactions_tab }`.

- Utilities
  - `getOrCreateSheet(ss, tabName, headers)` — create if absent; set headers if the sheet is new; return the sheet.
  - `generateProjectId()` — returns a stable ID string (`Utilities.getUuid()` for v1).

Frontend changes
----------------
- Add a simple modal form in `Dashboard.html` with:
  - Input: `Project Name` (required)
  - Submit button → calls `google.script.run.withSuccessHandler(...).createProject({ project_name })`
  - Success state shows the created tabs and `project_id` and refreshes the project selector.

Acceptance criteria
-------------------
- Creating a project creates two tabs: one in Inventory, one in Transactions, both named exactly as the provided project name (disambiguated with ` … 2` if necessary).
- `PROJECTS_INDEX` contains a row with `project_id`, `project_name`, `inventory_tab`, `transactions_tab`, `created_at`, `created_by`.
- The form is idempotent in name collisions (appends numeric suffixes consistently) and never overwrites existing tabs.

Notes
-----
- Existing assets used:
  - `apps_script/Code.gs#createProject` (already creates Inventory tab and appends to `PROJECTS_INDEX`)
  - `apps_script/Code.gs#listSheets` (already reads `PROJECTS_INDEX` for the selector)
- If later we decide to change ID format, we can migrate only the generator and keep the index stable.


