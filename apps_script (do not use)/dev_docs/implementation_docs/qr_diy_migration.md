## Migrating QR generation from Google Charts API to a DIY implementation

This document describes how to replace network-based QR image generation with an in-repo, DIY implementation. It builds on the behavior and acceptance criteria already documented in `dev_docs/qr_codes.md` and keeps existing endpoints, PDFs, and UI flows intact.

### Goals
- Replace external QR image fetches with locally generated QR artwork.
- Keep current URLs, endpoints, and print flows unchanged for users.
- Preserve output format (PDF for print; embedded PDF responses for mobile-first printing).
- Improve reliability (no external dependency) and enable future caching and performance improvements.

### Current state (before)
- QR artwork is assembled in `apps_script/qr_image.gs`.
- A helper in that file builds a Google Charts API URL and fetches a PNG over the network.
- Single-item and batch print PDFs are still created in `apps_script/qr_image.gs` and returned as HTML pages embedding a PDF.
- Key lookup, endpoints, and routing live in `apps_script/qr_utils.gs` and `apps_script/qr_endpoints.gs`.

### Target state (after)
- QR artwork is generated locally (no network fetch) by new modules inside the Apps Script project.
- The PDF assembly logic and endpoints remain where they are.
- File responsibilities are explicit so maintenance is clear and changes are isolated.

### File layout changes
- Add `apps_script/qr_encoder.gs` — DIY QR encoder that produces a QR data structure usable for rendering.
- Add `apps_script/qr_renderer.gs` — DIY renderer that converts the encoder output into a PNG data URI sized for print; can later support SVG if desired.
- Update `apps_script/qr_image.gs` — replace the network PNG creation with a call into the DIY renderer; keep all PDF assembly and label text logic here.
- (Optional) Add `apps_script/qr_cache.gs` — cache layer for encoder/renderer outputs (e.g., by key) using `CacheService` or Drive if we choose to persist artifacts.
- No change to `apps_script/qr_endpoints.gs` and `apps_script/qr_utils.gs` beyond imports/references if needed.

### Step-by-step migration
1) Create the DIY modules
   - Create `apps_script/qr_encoder.gs` and implement a self-contained QR encoder suitable for our sizes and error correction level.
   - Create `apps_script/qr_renderer.gs` and implement PNG (print DPI) output as a data URI. Keep the default size aligned with `dev_docs/qr_codes.md` (2"×2" at 300 DPI → 600×600 px).

2) Switch `apps_script/qr_image.gs` to the DIY pipeline
   - Replace the code path that constructs the Google Charts URL and fetches PNG bytes with a call to the renderer in `apps_script/qr_renderer.gs`.
   - Keep label text construction, PDF assembly, and embedding logic unchanged so endpoints behave exactly as before.

3) Keep endpoints and routing stable
   - Continue serving single-item print from `apps_script/qr_image.gs` and routing via `apps_script/qr_endpoints.gs`.
   - Continue serving batch print from `apps_script/qr_image.gs` with the same request shape and response (HTML page embedding a PDF).

4) Optional caching
   - If needed, add a small cache layer in `apps_script/qr_cache.gs` that stores PNG data URIs (or intermediate results) by `qr_key`.
   - Caching is an internal optimization and does not change any endpoint behavior.

5) Documentation and comments
   - Update any inline comments in `apps_script/qr_image.gs` that reference the Google Charts API to point to the DIY modules.
   - Keep `dev_docs/qr_codes.md` as the canonical behavior doc; this migration document only describes the implementation transition.

### Rollout plan
- Land the new modules (`apps_script/qr_encoder.gs`, `apps_script/qr_renderer.gs`) behind the existing APIs in `apps_script/qr_image.gs`.
- Verify single-item print by loading the existing print endpoint from a phone and desktop.
- Verify batch print with a small selection set and ensure the embedded PDF renders each label at the correct physical size.
- Once verified, remove the now-unused Google Charts URL construction from `apps_script/qr_image.gs` and any related references.

### Acceptance checklist
- `apps_script/qr_image.gs` no longer performs network fetches to external QR services.
- Single-item print and batch print return HTML pages that embed PDFs, unchanged from a consumer perspective.
- Output label sizing and layout remain consistent with `dev_docs/qr_codes.md` defaults (2"×2" @ 300 DPI; label text truncation unchanged).
- Optional cache behavior (if implemented in `apps_script/qr_cache.gs`) does not alter API semantics.

### Notes and non-goals
- This migration does not change endpoints, URL parameters, or the print viewer behavior.
- SVG output is not required; if later added, it should live in `apps_script/qr_renderer.gs` and continue to flow into PDFs assembled by `apps_script/qr_image.gs`.

### Quick reference
- Core behavior doc: `dev_docs/qr_codes.md`
- Encoder: `apps_script/qr_encoder.gs`
- Renderer: `apps_script/qr_renderer.gs`
- PDF assembly and print endpoints glue: `apps_script/qr_image.gs`
- Optional cache: `apps_script/qr_cache.gs`
- Routing and key resolution (unchanged): `apps_script/qr_endpoints.gs`, `apps_script/qr_utils.gs`


