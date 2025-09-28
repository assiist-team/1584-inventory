### Style consolidation plan — mobile-first, single source of truth

Goal
-----
- Consolidate all application CSS into a single canonical file: `apps_script/styles.html`.
- Deliver a mobile-first design that does not rely on runtime scaling except as a guarded fallback for broken hosts.

Principles
----------
- Mobile-first: default rules should target phones and scale up via `@media (min-width: ...)`.
- Single source of truth: no duplicated large `<style>` blocks in `Dashboard.html` or `ItemForm.html`.
- Defensive: include touch-capability overrides and overflow guards to survive odd host/iframe behavior.

Phase 1 — Canonical stylesheet (`apps_script/styles.html`)
---------------------------------------------------------
- Base/reset
  - `html, body { height:100%; margin:0; padding:0; box-sizing:border-box; -webkit-text-size-adjust:100%; }`
  - Universal `box-sizing` and typography tokens.

- Layout containers
  - `.app-root, #content { min-height:100vh; display:flex; flex-direction:column; }`
  - `.app-root { width:100%; margin:0 auto; padding:0 8px; }`

- Components and utilities
  - Buttons, cards, lists, toolbars, `.kv` grid, form inputs, radios — consistent spacing, focus styles.
  - Helper utilities: `.col-fixed-120`, `.col-fixed-80`, `.modal-centered`, `.modal-fullscreen`, `min-width:0` helpers.

- Media and embeds
  - `img, svg, iframe { max-width:100%; height:auto; }`

- Media queries (mobile-first)
  - `@media (max-width: 900px)` — tablet rules: stack project row, full-width controls, wrap toolbars.
  - `@media (max-width: 480px)` — phone: increase hit targets to ≥44px, reduce gaps, full-width cards, overflow-wrap.
  - `@media (min-width: 901px) and (pointer: fine)` — desktop: 50% centered wrapper.
  - Touch override: `@media (hover: none) and (pointer: coarse)` to force the mobile layout for touch devices even if the layout viewport lies.

- Overflow guards
  - `overflow-wrap: anywhere; word-break: break-word;` on card/content/list elements.

Phase 2 — Template wiring
-------------------------
- Replace embedded large `<style>` blocks in `apps_script/Dashboard.html` and `apps_script/ItemForm.html` with a server-side include in the `<head>`:

```html
<?!= include('styles') ?>
```

- Preserve per-page `meta viewport` in each page head:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

- Keep only minimal, page-specific styles inline if strictly necessary (e.g., a tiny one-off override). Everything else lives in `styles.html`.

Phase 3 — Remove inline fixed sizing from renderers
--------------------------------------------------
- Find and replace hard-coded widths/styles in JS renderers (`style.width`, `min-width:`, inline `width` attributes) with utility classes.
- Ensure all flex/grid children that must shrink have `min-width:0` so they collapse correctly on small viewports.

Phase 4 — Host/sandbox handling and guarded fallbacks
-----------------------------------------------------
- Keep `HtmlService` responses configured to allow embedding (`setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)`) and prefer native rendering where the Apps Script environment supports it.
- Keep the `visualViewport` scaling fallback as a guarded, opt-in debugging feature behind a query-string flag (e.g. `?debug_scale=1`) — disable by default.
- Add an iframe-detection debug banner behind `?debug_banner=1` that reports: `innerWidth`, `document.documentElement.clientWidth`, `window.screen.width`, `devicePixelRatio`, `visualViewport.width`, and whether `window !== window.parent`.

Phase 5 — QA & acceptance criteria
---------------------------------
- On iPhone (Safari) and Android (Chrome):
  - The page should render at natural scale (no zoomed-out tiny UI).
  - No horizontal scroll at the device's natural scale.
  - `@media (min-width:901px)` must NOT match on the phone; touch overrides should match.
  - `.app-root` should occupy the viewport width and key controls should meet touch-target sizes.

- On desktop: 50% centered wrapper and no regressions.

Phase 6 — Documentation & developer notes
----------------------------------------
- Update `dev_docs/implementation_docs/mobile_friendly_implementation.md` to reference `style_consolidation.md` and note the debug flags: `?debug_banner=1` and `?debug_scale=1`.
- Add brief examples of utility classes (`.col-fixed-120`, `.modal-centered`) and instructions for creating new components that follow the layout rules.

Implementation steps I will take if you approve
-----------------------------------------------
1. Move the canonical CSS into `apps_script/styles.html` (merge any missing rules from existing embedded blocks).
2. Add `<?!= include('styles') ?>` to the `<head>` of both `Dashboard.html` and `ItemForm.html`.
3. Remove embedded `<style>` blocks from those files (leave tiny per-page overrides if required).
4. Replace inline fixed widths in renderers with utility classes and `min-width:0` where needed.
5. Add the iframe debug banner behind `?debug_banner=1` and keep the `visualViewport` scaling behind `?debug_scale=1`.

If that plan looks good, reply "Proceed" and I will perform steps 1–3 immediately and open a PR-style edit set for your review.


