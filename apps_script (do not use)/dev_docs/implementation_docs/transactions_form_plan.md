Transactions form and ledger — implementation plan
=================================================

Purpose
-------
Define a concrete plan to reproduce the “Log Transaction” form shown in the screenshot and wire it to a Transactions spreadsheet (tabs per project). The plan also covers how each transaction can include multiple line items that create inventory rows and back-link those items to the `transaction_id` in the Inventory spreadsheet.

Scope and requirements (from request)
-------------------------------------
- Recreate the form UI with the following fields, writing to a Transactions spreadsheet (file-level ID is stored in an all-caps variable in code — we will standardize this constant; see “Config constants”):
  - Project Name, transaction_date, source, Location, transaction_type, payment_method, amount, notes, receipt_image (URL), receipt_emailed (Yes/No)
- Transactions spreadsheet uses tabs per project.
- Add a scalable way to tie the Transactions ledger to the Inventory sheet. Line items added in the transaction form should create inventory rows and store the `transaction_id` on each created inventory item.
- Support adding multiple items per transaction at point of purchase (dynamic, repeatable line item editor in the form).

High-level architecture
-----------------------
- Spreadsheet layer
  - Transactions spreadsheet (existing single Drive file): tabs per project. Each tab has the canonical columns listed above plus generated columns (e.g., `transaction_id`).
  - Inventory spreadsheet (existing): tabs per project. Each item row gains a `transaction_id` column so we can trace items back to the originating purchase/return.
  - Project index sheet: a single authoritative mapping between `project_id` (stable key) and `project_name` (display string). Also records the names of the tabs in Transactions and Inventory for each project.
- Apps Script backend
  - Endpoints to list projects, list enumerations (sources, types, methods), create/append transactions, and append inventory rows linked to a transaction.
  - Shared utilities for header-indexing, tab resolution by `project_id` or `project_name`, and ID generation.
- Frontend (Dashboard.html)
  - A new `Transactions` tab reproduces the form with dynamic line-item editor. Submission creates a transaction row and then appends inventory rows for each line item. The UI confirms success and deep-links to created items if needed.

Spreadsheet schemas
-------------------
1) Project index sheet (new or existing)
   - Columns: `project_id`, `project_name`, `transactions_tab`, `inventory_tab`, `active?`
   - Example row:
     - `p-abc123`, `Test Project`, `Transactions — Test Project`, `Inventory — Test Project`, `TRUE`

2) Transactions spreadsheet (one file; tabs per project — already exists)
   - Required columns (ordered):
     - `transaction_id` (generated, e.g., `T-<epochMs>-<rand>`)
     - `project_id`
     - `project_name`
    - `transaction_date` (ISO date; default Today)
     - `source` (enum: Homegoods, Amazon, Wayfair, etc.; allow custom)
     - `location` (free text; optional)
    - `transaction_type` (enum: Purchase, Return, Split, Client Credit, etc.)
    - `payment_method` (enum: 1584 Card, Client Card, Store Credit, Split)
    - `amount` (number, currency)
    - `notes` (text)
    - `receipt_image` (text/URL reference; optional)
    - `receipt_emailed` (Yes/No)
     - `created_at` (ISO timestamp)
     - `created_by` (email/actor if available)

3) Inventory spreadsheet (existing; tabs per project)
   - Ensure columns include: `item_id`, `project_id`, `project_name`, `description`, `price`, `source`, `date_created`, `location`, `transaction_id`, `qr_key`, plus any existing fields.
   - Add `transaction_id` column if missing. Keep it near other linkage fields.

Config constants (standardize)
------------------------------
- `TRANSACTIONS_SPREADSHEET_ID` — Drive file ID for the Transactions workbook (already present in `apps_script/Code.gs`).
- `INVENTORY_SPREADSHEET_ID` or use existing property for Inventory workbook.
- `PROJECTS_INDEX_SHEET_NAME` — `PROJECTS_INDEX`.

ID and tab resolution
---------------------
- Prefer `project_id` as the primary key across systems. The UI can present `project_name`, but submissions include both.
- Tab naming: store explicit tab names in the project index to avoid name drift. Helpers resolve the correct tab for each workbook by `project_id`.
- IDs
  - `transaction_id`: `T-${epochMs}-${base36Rand}` (e.g., `T-1758391200000-9xk4`)
  - `item_id`: keep existing pattern (e.g., `I-<epochMs>`), already in use.

Form UI design (Dashboard — Transactions tab)
---------------------------------------------
- Top-level fields
  - Project selector: populated from project index. Stores `project_id` and `project_name` in form state.
  - Date: Today/Different Date toggle; when custom, show a date picker.
  - Source: radio list with common vendors + `Other` with custom text entry; save the final value in `source`.
  - Location: free text.
  - Type: Purchase, Return, Split, Client Credit, etc. (seed from screenshot; can move to Config sheet later).
  - Method: 1584 Card, Client Card, Store Credit, Split.
  - Amount: single currency input (client-side normalization to number; server re-validates).
  - Notes: textarea.
  - Receipt image: simple text/URL input stored in `receipt_image`.
  - Receipt emailed: Yes/No stored in `receipt_emailed`.

Enumerations (seeded from current screenshot)
--------------------------------------------
- Source options (radio): `Homegoods`, `Wayfair`, `Ross`, `Pottery Barn`, `West Elm`, `Home Depot`, `Movers`, `1584 Design Inventory`, `Amazon`, `Target`, `Arhaus`, `Crate & Barrel`, `Living Spaces`, `Lowes`, `Gas`, plus `Other` (custom input on Enter).
- Type options (radio): `Purchase`, `Return`.
- Method options (radio): `Client Card`, `Split`, `1584 Card`, `Store Credit`.
- Date options (radio): `Today`, `Different Date` (reveals date picker).
- Emailed options (radio): `Yes`, `No`.

- The endpoint `listTransactionEnums()` will return these values so the UI can build radios consistently:
  `{ sources: [...as above...], types: ['Purchase','Return'], methods: ['Client Card','Split','1584 Card','Store Credit'], emailed: ['Yes','No'], dateChoices: ['Today','Different Date'] }`.

- Line items editor (dynamic)
  - A list of item rows with fields: `description`, `price` (or `client_price`/`cost` if you track both), `source` (defaults from form), `location` (defaults), optional `notes` per item.
  - Controls: “Add Item” button inserts a new row; each row has Remove.
  - Optional: import from clipboard (newline-delimited description/price pairs) for fast entry.
  - Validation: prevent submit if any item row is empty except trailing one; highlight missing required fields on submit.
  - Per-line item fields map directly to Inventory columns. Required: name→`description`, `source`, `type`, `method`. `price` is optional at creation.

Submission flow (happy path)
----------------------------
1) User fills top-level fields and adds N items.
2) On submit:
   - Disable the form and show a progress state.
   - Include `receipt` text/URL if provided (no file uploads).
   - Call `createTransaction` server endpoint with the transaction payload (without items). Server returns `transaction_id` and confirms the tab used.
   - Call `appendInventoryForTransaction` with `{ transaction_id, project_id, items: [...] }` to create inventory rows for each line item; function returns the created `{ item_id, description }[]` and any errors per item.
   - Finally, call `finalizeTransactionAmounts` if amounts depend on the created items (optional: totals reconciliation).
   - Show success summary with the new `transaction_id` and links to each created item (by `item_id`).

Backend design (Apps Script)
---------------------------
- Utilities
  - `getSpreadsheetById(fileId)` and `getOrCreateProjectTab(ss, tabName, headers)`.
  - `getHeaderIndexMap(sheet)`; `mapRowToObject(headers, row)`; `buildRowFromObject(headers, object)`.
  - `generateTransactionId()`; `normalizeCurrency(value)`; `normalizeBoolean(value)`.
  - `resolveProject(projectIdOrName)` → `{ project_id, project_name, transactions_tab, inventory_tab }` by consulting the project index.

- Receipt handling
  - Out of scope: we only store a text/URL reference in the `receipt` column.

- Endpoints (proposed signatures)
  - `listProjects()` → for selector.
  - `listTransactionEnums()` → `{ sources: [...], types: [...], methods: [...] }`.
  - `createTransaction(payload)` → creates a one-row entry in the project’s Transactions tab and returns `{ transaction_id, row, sheetName }`.
  - `payload` fields: `project_id`, `project_name`, `transaction_date`, `source`, `location`, `transaction_type`, `payment_method`, `amount`, `notes`, `receipt_image`, `receipt_emailed`, `created_at`, `created_by`.
  - `appendInventoryForTransaction({ project_id, transaction_id, items })` → creates inventory rows in the project’s Inventory tab; returns `{ items: [{ item_id, rowIndex }], sheetName }`.

Write-order and atomicity
-------------------------
- Default order:
  1) Create transaction row;
  2) Append inventory rows and back-link with `transaction_id`.
- Consistency guarantees:
  - Transaction row is created before items. Each inventory row stores the `transaction_id` and will exist even if later steps fail.
  - If item append partially fails, the endpoint returns per-item errors; UI can retry failed items with idempotency key `(transaction_id, description, price)`.
  - Consider a `status` column on the transaction: `draft` → `posted` after items append succeeds.

Headers and data mapping
------------------------
- Transactions headers (canonical; exact casing used in code):
  - `transaction_id`, `project_id`, `project_name`, `transaction_date`, `source`, `location`, `transaction_type`, `payment_method`, `amount`, `notes`, `receipt_image`, `receipt_emailed`, `created_at`, `created_by`
- Inventory headers impacted:
  - Ensure `transaction_id` exists; populate it on creation.
  - Map each line item field:
    - `description` → inventory `description`
    - `price` → inventory `price` (or `cost`), confirm naming
    - `source`/`location` default from transaction-level unless overridden per item
    - `date_created` → transaction `transaction_date` or current timestamp

UI behaviors and UX details
---------------------------
- Autocomplete for `Source` with the common vendor list; allow custom input by pressing Enter.
- Currency inputs show localized formatting on blur; store raw numbers in state.
- Receipt is a simple text/URL input.
- Submit button disabled until at least one line item is valid.
- After success, show: `Transaction T-xxxx created. 3 items added to inventory.` with links to items and a “Log another” button.

Security and permissions
------------------------
- Ensure the web app runs as the script owner and is restricted to 1584 Design domain users as needed.
- No Drive file handling in this phase.

Migration/Setup steps
---------------------
1) Ensure Script Property `TRANSACTIONS_SPREADSHEET_ID` points to the existing Transactions spreadsheet.
2) Verify project tabs exist; if any are missing, create them via the separate Project Creation flow.
3) Add `transaction_id` column to each Inventory project tab if missing.
4) Create or update the Project index sheet to include `transactions_tab` and `inventory_tab` names for each project.
5) Implement backend endpoints and utilities.
6) Build the Transactions tab UI in `apps_script/Dashboard.html` with dynamic line items.
7) Test end-to-end on a staging spreadsheet copy; then switch to production file IDs.

Acceptance criteria
-------------------
- Form captures and writes these fields to the correct project tab in the existing Transactions spreadsheet: `Project Name`, `transaction_date`, `source`, `Location`, `transaction_type`, `payment_method`, `amount`, `notes`, `receipt_image`, `receipt_emailed`.
- Submitting with multiple line items creates inventory rows for the same project and writes `transaction_id` on each item.
- Receipt text/URL is written to the `receipt` column on the transaction.
- Users can add/remove item rows before submitting; validation prevents empty/invalid data.
- All endpoints log structured messages and return clear per-item errors when something fails.

Observability and logging
-------------------------
- Log route entries and outcomes for `createTransaction` and `appendInventoryForTransaction`.
- Log tab resolution (project → tab names) and header validation results once per request.
- Include the generated `transaction_id` in all related logs for correlation.

Open questions (please confirm)
------------------------------
1) Project identity
   - Do we already have a canonical `project_id` per project? If yes, where is it stored (index sheet name)? If no, should we create one now and backfill existing rows?
2) Amount semantics
   - How should `Client Amount` vs `1584 Amount` map to line items and inventory `price`? Is `price` equal to `1584 Amount` total divided among items, or item-level amounts are entered explicitly per line?
3) Line item fields
   - Minimum required columns per item row for inventory creation: is `description` + `price` sufficient, or do we need SKU, category, or other attributes at creation time?
4) Sources and types
   - Please confirm the exact enumerations for `Source`, `Type`, and `Method` (from the screenshot list). Should we persist these lists in code or a Config sheet editable by admins?
5) Receipt handling
   - Is a single receipt per transaction sufficient? If multiple files are needed, we’ll switch `receipt_file_id` to `receipt_file_ids` and store a pipe- or comma-delimited list.
6) Tab naming
   - Should we standardize tab names (e.g., `Transactions — <Project Name>` / `Inventory — <Project Name>`) and lock them in the Project index?
7) Access and sharing
   - Any requirements for restricting receipt file visibility beyond team members? Should the web app avoid setting `ANYONE_WITH_LINK` on uploaded receipts?
8) Backfill strategy
   - Do we need a backfill tool to attach a `transaction_id` to existing inventory items retroactively based on date/source/notes?
9) Reporting
   - Any immediate roll-up reports required (per project totals, per source spend, client-vs-1584 split) to influence column design?

Next steps (after confirmation)
------------------------------
1) Lock enums and project index format; create headers in a staging copy of the Transactions workbook.
2) Implement backend utilities and endpoints (including ID generation and tab resolution).
3) Build the Transactions tab UI with dynamic line items and receipt upload.
4) E2E test on staging; tune validations and logs; then switch the file ID constants to production.


