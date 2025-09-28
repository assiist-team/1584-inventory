# Bookmarking system — architecture and troubleshooting

This document describes how the frontend bookmarking UI, server persistence, and data storage work in Project Control, plus targeted troubleshooting steps when bookmarks do not persist or the UI behaves unexpectedly.

## Components

- **Frontend UI** (`apps_script/Dashboard.html`, `apps_script/ItemForm.html`)
  - Bookmark controls are rendered as `<button class="btn btn-icon" data-bookmark-item-id="..." data-bookmark-state="true|false">` in list rows and inline item view.
  - Clicking a bookmark toggles visual `active` class and then calls `google.script.run.updateItem({ item_id: BID, data: { bookmark: newState }, sheet_name: SHEET })` to persist change.
  - The frontend maintains a client-side cache `window.__sheetCache` and updates it after successful `updateItem` response.

- **Server API / Persistence** (`apps_script/Code.gs`)
  - `updateItem(payload)` iterates sheets (or a specific sheet if `sheet_name` provided), finds the `item_id` row, applies `payload.data` values to the row, and writes the new row back to the sheet.
  - Key behaviors:
    - It uses the first row as headers and finds `item_id` column index.
    - It replaces the whole row by writing `sheet.getRange(foundRowIndex, 1, 1, newRow.length).setValues([newRow]);`.

- **Data model**
  - Sheets have headers including `item_id` and `bookmark`. Bookmark values are stored as plain cell values (`TRUE` or `FALSE` or string values depending on updates).

## Typical failure modes and root causes

- **Symptom**: Bookmark appears to toggle in UI but does not persist after reload.
  - Cause A: `updateItem` throws or returns an error (e.g., item not found, sheet not found), and the frontend's failure handler is only logging to `writeDebug` (not surfacing alerts). The client still toggles the visual state locally.
  - Cause B: `updateItem` updated a different sheet (missing `sheet_name`), or header casing differs (`bookmark` vs `Bookmark`) so the header mapping fails to write into the expected column.
  - Cause C: Frontend cache `window.__sheetCache` is stale or not updated correctly after server change.

- **Symptom**: Bookmark button click does nothing, or clicking toggles but backend logs show no `updateItem` invocation.
  - Cause: Event handler not attached (duplicate render path), or `data-bookmark-item-id` missing/empty in rendered HTML.

- **Symptom**: Cloud Logs show `diagnostic: typeof QrImage=undefined, typeof QrImage.generatePdfBlobForKey=undefined` near the same time as QR/bookmark operations.
  - Cause: This diagnostic comes from `apps_script/qr_endpoints.gs` executed during `doGet` routing. `QrImage` being undefined suggests that Apps Script didn't load `qr_image.gs` module at runtime or a runtime error occurred during its module initialization (for example, a syntax error prevented module completion). When module initialization fails, functions like `generatePdfBlobForKey` will be undefined and downstream endpoints may fail.

## Reproducing the issue locally

1. Open the web app and navigate to a project inventory.
2. Toggle the bookmark on an item and note whether the UI `active` state changes.
3. Reload the inventory view or the page. If the bookmark did not persist, check server logs.
4. In the Apps Script project's Execution logs (or Cloud Logs), search for `updateItem` related entries and for diagnostics from `qr_endpoints.gs`.

## Troubleshooting steps (quick)

1. Check Cloud Logs / Execution logs for the following messages:
   - Any `updateItem` console.log entries (see `updateItem` which logs matched rows).
   - Any errors in `updateItem` (e.g., `item not found`) or exceptions.
   - The `diagnostic: typeof QrImage=` message in `qr_endpoints.gs` — if `QrImage` is `undefined` this indicates the `qr_image.gs` module failed to initialize.

2. If `QrImage` is undefined, confirm that `apps_script/qr_image.gs` is present and syntactically valid:
   - Open `qr_image.gs` in the editor and inspect top-of-file code for unclosed braces or syntax errors.
   - Look for any runtime throws during module initialization (the module logs `module initialization complete` near the end). If that log is missing, the module likely threw during initialization.

3. Redeploy the web app (or save and run a simple test) after fixing any syntax issues so Apps Script picks up updated files.

4. For a failing bookmark persistence specifically:
   - Reproduce the bookmark toggle while watching Logs. Confirm `updateItem` is called (the frontend uses `google.script.run.updateItem`). If no `updateItem` log appears, check that the bookmark event handler is attached in the correct render path (both list and inline views attach handlers).
   - Confirm the `item_id` value being passed is correct and non-empty. The frontend decodes `data-bookmark-item-id` from buttons rendered in `renderRowHtml` and inline view.
   - Confirm the sheet has a `bookmark` header (case-sensitive match) in its first row. `updateItem` uses header names exactly as found; mismatched header text will cause writes to fall into unexpected columns.
   - If `updateItem` reports `item not found`, verify that the `sheet_name` parameter is being passed by the frontend when calling `updateItem` in contexts where `sheet_name` is known (inline view passes `item._sheet || sheetName`). When opening items from cache or via `getItem`, ensure `_sheet` is present.

5. If `updateItem` is successful but UI still loses the bookmark on reload:
   - Inspect the sheet contents directly in Google Sheets — does the `bookmark` column show the expected value? If not, `updateItem` may have failed to write into the `bookmark` column (header mismatch).
   - If the sheet contains the correct value but the UI displays old data, clear frontend cache `window.__sheetCache` or force a reload to avoid stale client-side caching.

## Detailed fixes

- Fix: Ensure `bookmark` header exists
  - Edit the sheet and ensure the first row contains `bookmark` exactly (lowercase), or update `updateItem` to normalize header names (recommended).
  - Recommended code change (safe normalization): in `getSheetValues` and `updateItem`, normalize headers with `.toLowerCase()` and map canonical names to expected keys so `bookmark`, `Bookmark`, or `BOOKMARK` map to the same column.

- Fix: Ensure `updateItem` receives `sheet_name` when available
  - Frontend passes `sheet_name` in `updateItem({ item_id: bid, data: { bookmark: newState }, sheet_name: sheetName })` from list view and `item._sheet || sheetName` from inline view; ensure `__sheetCache` items include `_sheet` so inline form `renderItemView` will pass `_sheet` on update.

- Fix: Surface failures to the user during bookmark save
  - Change `google.script.run.withFailureHandler` callback to show a brief toast or revert the visual state on failure. At minimum, log an explicit error in the browser console so users notice persistence failures.

- Fix: If `QrImage` module is failing (blocking QR endpoints)
  - Open `qr_image.gs` and scroll to the bottom to ensure the file ends cleanly with the expected `Logger.log('QrImage: module initialization complete'...` message and closing braces. If you find an extra `};` or unmatched brace, fix it.
  - Re-test module initialization by opening the web UI and triggering an endpoint that logs the `diagnostic` message. If `QrImage` remains undefined, try saving and redeploying the Apps Script project.

## Example diagnostics to look for in Cloud Logs

- From the UI: `Toggled bookmark for <ID>` followed by `bookmark updated for <ID> -> true` (from frontend + server success handler logs).
- From backend: `updateItem: matched item_id at row <n>` and `updateItem: fetched row data: ...`.
- From QR endpoints: `diagnostic: typeof QrImage=undefined, typeof QrImage.generatePdfBlobForKey=undefined` — indicates QR module not loaded.
- From `qr_image.gs` initialization: `QrImage: module initialization complete; exports=[...]` — confirms successful module load.

## Recommended immediate remediation checklist

- [ ] Open `apps_script/qr_image.gs` and fix any syntax/runtime errors. Save file.
- [ ] Redeploy the Apps Script web app (or save and run a test `doGet` request) so the runtime picks up changes.
- [ ] Reproduce bookmark toggle while watching Cloud Logs; confirm `updateItem` logs appear.
- [ ] If header mismatch is suspected, add header normalization in `headerIndexMap` or ensure sheet header uses `bookmark`.
- [ ] Add a temporary debug alert in the frontend failure handler for `updateItem` calls to surface server failures to users during testing.

## Long-term improvements (optional)

- Normalize headers to lowercase internally to avoid sheet casing problems.
- Add unit-like tests (scriptable checks) to validate that `QrImage` module initializes successfully on save.
- Add an explicit `health` endpoint that returns the loaded modules and available functions to simplify runtime diagnostics.

---

Last updated: automated snapshot created on commit.
