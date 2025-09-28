Architecture overview
=====================

This project is a lightweight "Project Control Center" built on Google Apps Script with a mobile-friendly frontend. It provides a small number of HTTP endpoints (via the Apps Script Web App) that allow listing project tabs, reading sheet values, creating new project tabs, appending inventory rows, and serving item edit forms.

Components
----------
- `apps_script/Code.gs` — the Apps Script backend implementing web routes (GET/POST) and the core spreadsheet operations.
- `apps_script/Index.html` — the main mobile-friendly control panel UI (project selector, add inventory, list/edit inventory).
- `apps_script/ItemForm.html` — standalone item edit form used for QR-code links.
- `dev_docs/` — documentation and deployment instructions.

Data model
----------
- `PROJECTS_INDEX` (optional index sheet): stores `project_id`, `project_name`, `sheet_name`, `created_at`.
- Per-project sheets: each project has a sheet named after the project (or a safe variant). Each sheet's first row is the header row. Default headers:

  - `item_id`
  - `project_id`
  - `project_name`
  - `date_created`
  - `description`
  - `price`
  - `source`
  - `qr_link`
  - `last_updated`
  - `notes`

Operations
----------
- List projects: `GET ?action=listSheets` — returns either the `PROJECTS_INDEX` rows (preferred) or a fallback list of sheet names.
- Get sheet values: `GET ?action=getSheet&sheet=SheetName` — returns `headers` and `rows`.
- Create project: `POST ?action=createProject` — creates a new sheet with default headers and adds an entry to `PROJECTS_INDEX`.
- Append inventory: `POST ?action=appendInventory` — appends a row to a project's sheet and returns generated `item_id` and `qr_link`.

Security & deployment
---------------------
- The Web App runs with the script owner's credentials (Execute as: Me). Control access via the deployment setting (`Who has access`).
- Store spreadsheet IDs in Script Properties (`INVENTORY_SPREADSHEET_ID`, `TRANSACTIONS_SPREADSHEET_ID`).

Next steps
----------
- Implement stable numeric `project_id` support and sequential `item_id` generation.
- Add write endpoints for transactions and item updates.
- Add QR code image generation and item lookup by `item_id`.


