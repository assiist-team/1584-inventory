Endpoints
=========

This file lists the available Apps Script web app endpoints and their expected inputs/outputs.

GET ?action=listSheets
- Purpose: return list of projects (from `PROJECTS_INDEX` if present)
- Response: `{ sheets: [ { project_id, project_name, sheet_name, created_at }, ... ] }` or fallback `{ sheets: [ { sheet_name }, ... ] }`

GET ?action=getSheet&sheet=SheetName
- Purpose: return headers and rows for the sheet
- Response: `{ headers: [...], rows: [[col1, col2, ...], ...] }`

GET ?action=itemForm&itemUrlId=ID
- Purpose: serve the item edit HTML form (used by QR links)
- Response: HTML page with an edit form for the requested item ID

POST ?action=createProject
- Payload: `{ project_name: 'Name' }`
- Purpose: create a new sheet with default headers and add to `PROJECTS_INDEX`
- Response: `{ sheet_name: 'Safe Name', project_id: 'UUID' }`

POST ?action=appendInventory
- Payload: `{ sheet_name: 'SheetName', data: { description, price, source, project_name, ... } }`
- Purpose: append a new row to the specified sheet; returns generated `item_id` and `qr_link`.
- Response: `{ item_id: 'I-...', qr_link: 'https://...' }`

POST ?action=updateItem (future)
- Purpose: update an existing row by `item_id`.

POST ?action=appendTransaction (future)
- Purpose: append to `TRANSACTIONS_SPREADSHEET_ID`.


