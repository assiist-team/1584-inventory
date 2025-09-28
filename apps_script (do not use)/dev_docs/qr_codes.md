# QR codes — how the system works

This document describes requirements, design decisions, and implementation notes for using short `qr_key` tokens and an endpoint to support QR-based item lookup and optional image generation.

## Final headers

The inventory sheet headers (final) are:

`item_id	project_id	project_name	date_created	description	price	source	last_updated	notes	qr_key`

## Behavior overview

- A short, unguessable `qr_key` is generated and persisted for each inventory item (on creation and when backfilling missing keys).
- The QR encodes a short URL pointing to the key endpoint, e.g. `?action=key&k=<qr_key>`.
- The sheet stores the `qr_key` (not image data), keeping cells small and reads/writes fast.
- Endpoints resolve `qr_key -> item_id` and either redirect to the item edit URL (`?action=itemForm&itemUrlId=ID`) or render a printable page that embeds a PDF generated from PNG artwork at print DPI.

## Design

- When an item is created, construct a random `qr_key` (8–12 char base62) and persist it in the `qr_key` column for that row.
- If the creation path is interactive, return the `qr_key` to the client so the UI can request a generated image for preview/print.
- For bulk imports or external sources, generate `qr_key` during import or via a post-import script (no migration required if you decide not to backfill existing rows).

### Endpoint options

- **Redirect endpoint** (`?action=key&k=...`): resolves key → itemId, then redirects to `?action=itemForm&itemUrlId=...` via a minimal client-side redirect page.
- **Label endpoint** (`?action=qrImage&k=...`): resolves key → itemId, generates PNG artwork at print DPI, assembles a single-page PDF, and returns an HTML page that embeds the PDF via a `data:application/pdf;base64,...` `embed` for easy print/view. A direct `application/pdf` stream is not currently used by this endpoint.

## Storage & Keys

- `qr_key` should be short and unguessable. Use base62 alphanumeric strings (e.g., `Ab3d9Xk2`) of 8–12 chars.
- Store the `qr_key` in the inventory sheet row. Keep it stable; regenerate only if explicitly requested.

## API / Functions (server-side)

- `QrUtils.generateUniqueKey(length?)` — create a unique short key (default 9 chars) and ensure no collisions.
- `resolveQrKey(key)` — look up `key` across sheets and return `{ itemId, sheetName, row }` (cached via `CacheService`).
- `QrEndpoints.handleKeyRedirect(e)` — handles `?action=key&k=...` and redirects to the item form.
- `QrImage.generatePdfForKey(key, options)` — generate PNG artwork at print DPI, assemble a single-page PDF, and return an HTML page that embeds that PDF for printing.
- `QrImage.generateBatchPdf(sheetName, itemIds[], options)` — assemble a multi-label PDF and return an HTML page that embeds it; can also cache the PDF to Drive.

## Caching & Performance

- Use `CacheService` to cache `key->itemId` lookups and optionally cache generated image bytes/URIs to reduce generation cost for frequent scans.
- For very high traffic, consider storing generated images in Drive or external storage with cache headers and serve via a CDN.

## Security

- Treat `qr_key` as an unguessable token. Do not include sensitive data in the token itself.
- The redirect to `itemForm` should still enforce normal Google authentication for editing/viewing.
- Provide admin controls to revoke or regenerate keys.

## Migration

- Since you opted not to backfill existing items, a migration script is optional. Provide `generateQrKeyForItem(itemId)` so missing keys can be created on demand or in bulk later.

## File organization and namespaces

Split responsibilities across small, focused `.gs` files for clarity and future maintainability:

- `apps_script/qr_utils.gs` — key generation and lookup helpers (e.g., `QrUtils.generateKey`, `QrUtils.resolveKey`).
- `apps_script/qr_endpoints.gs` — web endpoints and routing (e.g., `QrEndpoints.handleKeyRedirect`, wiring in `doGet`).
- `apps_script/qr_image.gs` — artwork generation and caching (PNG artwork generation, Drive caching for persisted assets, `QrImage.generateForKey`).

Use a small namespace object (like `QrUtils`, `QrEndpoints`, `QrImage`) in each file to avoid global collisions.

## doGet wiring

Map web actions to small endpoint handlers. Example actions to support:

- `?action=key&k=<qr_key>` — resolves and redirects to item form (fast path for scanners).
- `?action=qrImage&k=<qr_key>` — primary print endpoint. This endpoint returns an HTML page that embeds a printer-ready single-page PDF for the requested key. The optional `format=pdf` parameter is currently ignored.

Keep `doGet(e)` minimal and delegate to the `QrEndpoints` handlers.

## Current implementation

This repository already includes a working implementation of the QR key and endpoints. Key points:

- **Key generation**: `appendInventory` (in `apps_script/Code.gs`) generates and persists a short `qr_key` when a new item row is appended by calling `QrUtils.generateUniqueKey(9)` and writing the value to the `qr_key` column if present.
- **Key resolution**: `resolveQrKey(key)` (in `apps_script/Code.gs`) scans sheets that have `qr_key` and `item_id` headers and returns `{ itemId, sheetName, row }` for a matching key.
- **Endpoints & routing**: `doGet(e)` routes `?action=key&k=...` to `QrEndpoints.handleKeyRedirect` (redirects to `?action=itemForm&itemUrlId=...`) and `?action=qrImage&k=...` to `QrEndpoints.handleQrImage` (serves a printable image/page).
- **Namespaces/files**: the implementation uses `QrUtils` (`apps_script/qr_utils.gs`), `QrEndpoints` (`apps_script/qr_endpoints.gs`), and `QrImage` (`apps_script/qr_image.gs`) to separate concerns and avoid global collisions.
- **PDF generation**: single-label PDF (`QrImage.generatePdfForKey`) and batch PDF (`QrImage.generateBatchPdf`) build HTML that embeds PNG artwork and convert the HTML to a PDF blob via `Utilities.newBlob(html, 'text/html').getAs('application/pdf')`. The current endpoints return an HTML page embedding the generated PDF as a `data:application/pdf;base64,...` `embed` for browser convenience; this is pragmatic but not optimal for direct `Content-Type: application/pdf` responses.
- **Usage**:
  - Scan/visit: `<scriptUrl>?action=key&k=<qr_key>` — opens the item form via a client-side redirect.
  - Single-item print: `<scriptUrl>?action=qrImage&k=<qr_key>` — opens an HTML page that embeds a single-page PDF for that item (print or save from the browser viewer). No SVG downloads are served by endpoints. The `format=pdf` parameter is currently ignored.

- **Notes / next steps**: the current image generator uses Google Chart API and does not yet cache generated images in Drive or `CacheService`. For higher volume or offline generation, consider replacing the external call with a pure-SVG generator, adding `CacheService`/Drive caching, or storing pre-generated images with cache headers.

## Drive storage & cache semantics

This project supports Drive storage for generated assets with the following behavior: printing returns an HTML page that embeds a printable PDF; SVG is not used; PNG is generated in-memory to compose the PDF.

Drive folder structure:

- Root output folder: `QR Codes/`
- Per-project subfolder: `QR Codes/<Project Name>/`
- PDFs (batch only, by default): saved under `QR Codes/<Project Name>/` with filename pattern similar to `<projectName> - batch - <timestamp>.pdf`.
- PNGs (optional helper; not used by print endpoints): if invoked, saved under `QR Codes/<Project Name>/PNGs/` with filename pattern `<projectName> - <itemId> - <qr_key>.png`.

Rules:

- When `options.cache=true`, store the assembled PDF under the project subfolder. Return the PDF immediately to the client regardless of Drive outcome.
- If SVGs are auto-saved, always place them under the `SVGs/` subfolder. If not needed, skip saving SVGs entirely.

Behavior for endpoints and cache options:

- The single-image endpoint (`?action=qrImage&k=<qr_key>`) currently:
  - resolves the key to an item and project name,
  - builds the label artwork in-memory (PNG at print DPI by default),
  - returns an HTML page that embeds a printable single-page PDF. It is not a direct `application/pdf` stream. No SVG responses. No save/caching options for single-item PDFs.

- The batch endpoint `generateBatchPdf` uses `options.cache` semantics as follows:
  - `options.cache=true` (default): store the assembled PDF in Drive and return an immediate printable HTML response that embeds the PDF; the page also includes a link to the Drive file when available.
  - `options.cache=false`: do not write to Drive; still return the printable HTML response that embeds the generated PDF.

- If Drive saving fails for PDF, the server still returns the printable HTML response and logs the `driveCacheFailure` event. Printing does not depend on Drive.

Notes:

- **Primary cache purpose**: `options.cache=true` caches the **printable PDF** for later reuse (reprints, audits, operator workflows).
- **SVG persistence**: not served and not persisted by default. Keep SVG only in memory for PDF composition.
- **Performance**: generating PDFs on-the-fly from in-memory SVG is acceptable for mobile-first flows; Drive writes should be asynchronous when possible to reduce latency.

## Printer-ready image requirements

- **Format**: generate **PNG** artwork at print DPI and **PDF** as the print output. For batch printing, embed the PNGs into the PDF at their intended physical size.
- **Raster defaults**: 2" x 2" label at 300 DPI → 600×600 px raster inside a PDF. Use 300 DPI as the default print target.
- **Layout**: include a short label beneath the QR that combines `description` and `source` with a configurable separator (default ` — `). Example: `Widget A — Warehouse B`.
  - **Truncation**: default truncate description to 40 chars and source to 20 chars; apply ellipsis (`…`) and prefer a combined ~60 char maximum.
  - **Separator**: configurable via API options (e.g., `{ separator: ' — ' }`).
  - **Readability**: choose font sizes appropriate for the physical label size and test at actual print scale.
- **Margins & bleed**: include a small white margin around the QR (4–8% of QR size) to ensure scanner reliability.
- **Caching**: cache generated images by `qr_key` in `CacheService` or Drive to reduce work. Drive caching is optional and controlled by API options.
- **API**: `generateQrImageForKey(key, options)` accepts `{ format: 'svg'|'png', widthPx, includeLabel, separator }`.

- **Practical note (PNG-first is OK)**: If vector SVG isn’t required, generate a PNG at print DPI (e.g., 600×600 px for 2"×2" at 300 DPI) and embed that PNG into the PDF at the correct physical size. This yields reliable, scannable labels and is simpler operationally.

## Batch PDF generation and mobile printing

Mobile-first requirement: label generation and printing must work from any phone browser without a local print agent. The server must therefore be able to return a single printable file (preferably PDF) directly to the browser so users can open the file in a new tab or invoke the OS print dialog.

Key behaviors:

- Canonical batch output: **PDF**. The server should construct a PDF containing one or more labels laid out for easy printing on standard label printers or sheet printers. PDF allows vector SVG embedding, consistent layout, and reliable mobile browser rendering.
- Secondary option: none — printing must use PDF. Do not provide PNG bundles as a printing alternative.

### Page & label layout defaults

- Default label physical size: **2" x 2"**.
- Default print DPI: **300 DPI** → default raster cell 600×600 px when rasterizing.
- Default page size: **US Letter (8.5" x 11")** or **A4** configurable by option. Use orientation `portrait` by default.
- Default labels per page (N-up): calculate from label size and page size; provide presets: 2x5 (10 labels), 3x3 (9 labels), or custom rows/cols. Default to best-fit grid for the page size and label size.
- Margins: default 0.25" page margins; allow options to control margins and inter-label spacing.
- Orientation: allow `portrait` or `landscape` option.

### File sizing note

- When embedding raster images into the PDF, rasterize at the configured DPI (default 300 DPI) so each label cell receives a 600×600 px image for 2" x 2".
 

### Endpoint: generateBatchPdf

- URL pattern: `?action=generateBatchPdf&sheetName=<Sheet Name>&items[]=<ITEM_ID>&items[]=<ITEM_ID>&options=<JSON>`

## Acceptance criteria (UI + API)

- Selection UI (Dashboard):
  - A checkbox per item row/card to include it in the batch.
  - A “Select all” control that toggles selection for the current view/filter.
  - The “Generate QR Codes” button remains disabled until at least one item is selected and shows the selected count.
  - Mobile-friendly hit targets; avoid blocking modals during print flows.

- Printing behavior (mobile-first):
  - Single-item: opening `?action=qrImage&k=<key>` opens an HTML page that embeds a single-page PDF (prints from the browser viewer).
  - Batch: calling `?action=generateBatchPdf&sheetName=<>&items[]=<id>...` returns an HTML page that embeds a multi-label PDF suitable for printing without requiring a local agent.
  - PDFs embed PNG artwork at print DPI (default 300 DPI; 2"×2" → 600×600 px per label).

- API semantics:
  - `?action=qrImage&k=<key>` returns an HTML page that embeds a printable single-page PDF for the item. The `format=pdf` parameter is currently ignored.
  - `?action=generateBatchPdf&sheetName=<>&items[]=<id>&options=...` returns an HTML page that embeds the batch PDF. With `options.cache=true`, the PDF is also saved to Drive; a link is shown on the page. No JSON metadata is returned by the endpoint.
  - Only PDFs are produced for printing (embedded); PNG files are not returned as standalone artifacts by these endpoints.