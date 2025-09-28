Implementation tracking
=======================

This document tracks the current implementation tasks, owners, and statuses.

Current tasks
-------------

- Create Apps Script web app scaffold — completed
  - Files: `apps_script/Code.gs`, `apps_script/Index.html`, `apps_script/ItemForm.html`

- Implement endpoint to list project sheets — in_progress
  - Status: initial implementation reads `PROJECTS_INDEX` or falls back to sheet names.
  - Notes: selector default option added and select width increased. Follow-up: ensure `listSheets` returns `sheet_name`/`project_name` consistently.

- Implement endpoint to read sheet values — pending

- Implement endpoint to create new project sheet with headers — pending

- Implement endpoint to append inventory rows — pending

- Implement endpoint to append transaction rows — pending

- Add QR code generation and item URL endpoint — pending

-- Build mobile-friendly frontend with selector and control panel — in_progress
  - Status: basic control panel and add-inventory form present in `Dashboard.html`.
  - Next: replace separate `Edit Inventory` page with an `Inventory` tab that opens items in-screen with a `Back` control. Also add `Transactions` tab and move `Add Inventory` into an `Add` tab/area.

-- Implement item edit flow (QR and list search) — in_progress
  - Status: item form exists at `apps_script/ItemForm.html` and supports edit via QR link; needs integration with in-screen item view so tapped list items open the edit form inline.

- Document deployment and permissions steps — pending (partial docs added)

Notes
-----
- The `PROJECTS_INDEX` sheet is recommended for stable project IDs; currently creation uses UUIDs.
- Next actions: implement stable `project_id` generation, store a per-project item counter, and add transactions endpoint.

Change log
----------
- 2025-09-13: Scaffolded Apps Script project and added initial docs and UI prototype.


