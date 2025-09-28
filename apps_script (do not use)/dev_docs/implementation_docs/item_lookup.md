Item lookup and update — implementation notes
============================================

Purpose
-------
Document how inventory items are located and edited so another developer can pick this up quickly.

Files of interest
-----------------
- `apps_script/Code.gs` — backend endpoints: `getItem`, `updateItem`, `appendInventory`, `getSheetValues`.
- `apps_script/Dashboard.html` — frontend control panel and the `openItemInline` flow that calls `getItem` and `updateItem`.
- `apps_script/ItemForm.html` — standalone item edit form; also contains an inline render helper.

Backend: how an item is retrieved (current implementation)
-------------------------------------------------------
- Endpoint: GET `?action=getItem&itemId=<ID>&sheetName=<Sheet>` — routed by `doGet` to `getItem(itemId, sheetName)`.
- Behavior (optimized implementation):
  1. Resolve the sheet: prefer the provided `sheetName`; otherwise fall back to the first sheet containing an `item_id` header.
  2. Read the sheet header row (`sheet.getDataRange().getValues()[0]`) and compute `itemCol = headers.indexOf('item_id')`.
  3. Read only the `item_id` column values with a range: `sheet.getRange(2, itemCol+1, lastRow-1, 1).getValues()`.
  4. Iterate that single-column array to find the matching value (string comparison). When found, compute the sheet row index and fetch the full row with `sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0]`.
  5. Construct the returned object by mapping header -> value for every column, and attach `_sheet` and `_row` metadata. Return `{ item: obj }` or `{ error: 'item not found' }`.

Notes on types and matching
--------------------------
- The code does strict string equality when comparing the requested `itemId` to the sheet cell. Common mismatches are caused by:
  - Leading/trailing whitespace in the sheet cell or the requested id
  - Different cell types (numbers/dates) that stringify differently in Apps Script
  - Wrong `sheetName` supplied from the UI
- Recommendations already applied:
  - Read only the `item_id` column to locate the row (lower memory footprint).
  - Log via `console.log` the matched row index and the fetched full row to help debugging.

Backend: how an item is updated (current implementation)
-----------------------------------------------------
- Endpoint: POST to action `updateItem` with payload `{ item_id: 'I-...', sheet_name?: 'Sheet', data: { field: value, ... } }`.
- Behavior:
  1. If `sheet_name` provided, limit search to that sheet; otherwise iterate candidate sheets.
  2. Find the `item_id` column index once and scan rows until the matching row is found.
  3. Clone the matched row (`newRow = row.slice()`), apply values from `payload.data` using header keys, then write the full row back using `sheet.getRange(rowIndex, 1, 1, newRow.length).setValues([newRow])`.

Frontend flow
-------------
- `Dashboard.html` builds the inventory list with `getSheetValues` and attaches click handlers to each row card that call `openItemInline(itemId, sheetName)`.
- `openItemInline` displays a loading state, calls `google.script.run.getItem(itemId, sheetName)` and renders an inline edit form populated with the returned `item` fields. Save triggers `google.script.run.updateItem({ item_id, data, sheet_name })`.

Debugging tips
--------------
- Use the Dashboard `Debug` area for quick visibility (`writeDebug(...)` is used in the UI).
- Server-side logs: `console.log('getItem: matched item_id at row ' + row)` and `console.log('getItem: fetched row data: ' + JSON.stringify(fullRow))` are present in the current implementation; view them in the Apps Script execution logs when running deployed or via the Script Editor executions view.

Suggested improvements (next steps)
---------------------------------
- **Use frontend cache for item lookups**: after `getSheetValues(sheetName)` is called to populate the list view, cache that payload in memory (e.g. `window.__sheetCache[sheetName] = { headers, rows }`) and build a simple `itemId -> rowIndex` map. When opening a single item prefer rendering from that cache instead of calling `getItem`.
  - This eliminates the flaky bridge call for single-item lookups and avoids extra sheet scans.
  - Only fall back to the server `getItem` when the cache is missing or clearly stale.

- **Header-index utility**: keep the header-to-index map helper and use it consistently so lookups are O(1) instead of repeatedly using `indexOf`.

- **Input normalization and validation**: normalize `itemId` (trim and coerce to string) on both client and server and validate required headers once on startup; surface a single clear error when headers are missing.

- **Safe client rendering**: guard single-item rendering so only the latest `getItem` response can update the inline UI (use a request token) and avoid clearing the UI on null responses; retry once before showing a non-destructive warning.

- **Testing**: add lightweight integration tests (sheet fixtures) that assert `getSheetValues` and the cache-based lookup return the same object as `getItem` for a sample row.

API examples
------------
- Get item (GET): `GET /?action=getItem&itemId=I-12345&sheetName=MyProject`
- Update item (POST): payload JSON to `?action=updateItem` contains:

  {
    "item_id": "I-12345",
    "sheet_name": "MyProject",
    "data": { "description": "New desc", "price": 42 }
  }

Where to start if you take over
-------------------------------
1. Reproduce: open the UI, select project, click an item, collect the Dashboard debug output and the Apps Script logs.
2. Inspect the exact sheet header and the raw row values for the failing item.
3. If matching still fails, run the `getItem` server function in the Script Editor with the same parameters to observe logs and return values.
4. Implement `getItemsMap` if the UI requires repeated lookups.

Contact
-------
If you need context beyond this doc, start with `dev_docs/frontend.md` and `dev_docs/implementation_tracking.md` which describe the planned UX and outstanding tasks.

Investigation log — current issue (UI receives null)
-------------------------------------------------
Latest server-side evidence:

- Server execution logs show a successful match and returned row for `I-1757782079810`:
  - getItem: matched item_id at row 2 (itemId=I-1757782079810)
  - getItem: fetched row data: ["I-1757782079810","","Test Project","2025-09-13T16:47:59.810Z","Cabinet",400,"Homegoods","","",""]

Observed client behavior:

- The Dashboard UI debug area logged `getItem response: null` even though the server logs show a successful returned object.
- Hard-refreshing the UI did not change the outcome.

Immediate hypotheses
--------------------
- Client-side mismatch: the `google.script.run` success handler may be executing but `res` is null in the page context (possible stale client or handler mismatch).
- Different call path: `doGet` vs server function — the code uses `google.script.run.getItem(itemId, sheetName)` (server function) not an HTTP fetch; the server logs confirm the server executed and returned a value, but the client saw `null`.
- Response serialization: the returned object contains Dates and/or non-primitive values; we added conversion to ISO strings and now return a safe object, but the client still sees null — suggests the issue is in the Apps Script client bridge rather than JSON encoding.
- Race/caching: an earlier client script version (or older HTML template) is still running and its success handler differs; a hard refresh should rule this out (already tried).

What we already added to help diagnose
-------------------------------------
- Server-side `console.log` lines for matched row and fetched row were added.
- `getItem` now returns a `debug` payload on failure or success so the client can inspect `matchedRow`, `fullRow`, or a `sample` of checked ids.
- The Dashboard UI was updated to `writeDebug('getItem response: ' + JSON.stringify(res))` in the `getItem` success handler to surface the raw `res` object.

Recommended next steps (high priority, for the next dev)
------------------------------------------------------
1. Confirm the exact client call path and handler:
   - In the browser console, override `google.script.run.withSuccessHandler` to a wrapper that logs when the callback is invoked and the raw arguments. This can expose whether the success handler is invoked with `null`.
2. Add an explicit HTTP fetch diagnostic (temporary): call `fetch('/?action=getItem&itemId=I-...&sheetName=Test%20Project')` from the page and print the raw response text. If the HTTP response contains the expected JSON, the browser-to-server HTTP layer is fine and the issue is `google.script.run` bridge.
3. Re-deploy the Apps Script web app (new version) and test the deployed URL rather than the editor preview — differences in HtmlService sandboxing can cause different behavior.
4. If `google.script.run` is confirmed to be the problem, re-implement the `getItem` call via an HTTP GET (server `doGet` returns jsonResponse) until the bridge issue is resolved.

Short-term workaround
---------------------
- Prefer using the in-memory cache populated by `getSheetValues` to render items inline. This is reliable in both preview and deployed contexts and avoids CORS issues.
- If the `google.script.run` bridge returns `null` unexpectedly, perform a single guarded retry and then keep the current view while showing a clear, non-destructive warning instead of replacing the rendered content.
- For troubleshooting, inspect Apps Script execution logs (they contain `getItem: matched item_id at row ...` and `getItem: fetched row data: ...`) and correlate timestamps with the client debug output rather than using cross-origin fetches (which are blocked by HtmlService origins).

Notes for handoff
-----------------
- Attach the server logs (execution record) with timestamps when handing off; include the UI debug output `getItem response: null` and the server-side `console.log` lines so the next dev can correlate client/server timelines.
- The `item_lookup.md` file documents the current flow and the diagnostic steps already taken — update it with any new findings.



