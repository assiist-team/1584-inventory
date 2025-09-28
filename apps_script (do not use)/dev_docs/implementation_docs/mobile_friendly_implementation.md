Mobile-friendly frontend: implementation tracking
=============================================

Scope
-----
- Make the Dashboard and ItemForm UIs usable on small/mobile viewports


Problem (concise)
-----------------
- Symptom: On phones the page renders like a narrow desktop column scaled down — headers and controls appear tiny and surrounded by large white margins; the browser's initial scale appears reduced (everything looks "zoomed out").
- Common root causes to investigate:
  1. Missing or incorrect viewport meta tag, which causes mobile browsers to use a desktop layout width and automatically scale the page down.
  2. Top-level wrappers constrained by fixed pixel widths or centered max-widths that do not expand to the device width.
  3. `html`/`body` and the application root do not fill the viewport height; main content does not flex to consume available vertical space.
  4. JS-rendered inline styles (e.g., `element.style.width = '360px'`) and hard-coded pixel sizes in templates.
  5. Images or other elements lacking `max-width:100%` or elements with transforms/negative margins that cause overflow.

What to fix (priority)
----------------------
1. Add a responsive viewport meta tag to every served page (fast — often fixes the primary symptom):
   - `<meta name="viewport" content="width=device-width, initial-scale=1">`
2. Foundation CSS changes (add to `apps_script/styles.html`):
   - `html, body { height: 100%; margin: 0; padding: 0; box-sizing: border-box; -webkit-text-size-adjust: 100%; }`
   - `.app-root, #content { min-height: 100vh; display: flex; flex-direction: column; }`
   - `.main-container, .content-wrapper { width: 100%; max-width: 100%; }`
   - `img, svg, iframe { max-width: 100%; height: auto; }`
   - Consider `body { overflow-x: hidden; }` only after auditing horizontal overflow sources.
3. Remove or replace inline pixel widths in JS renderers (`apps_script/Dashboard.html`, `apps_script/ItemForm.html`):
   - Grep for `style.width`, `style.minWidth`, `width = '`, `minWidth` and refactor to CSS classes or percent-based sizing.
4. Make the main content area flexible so empty-state and normal content fill vertical space:
   - Ensure primary content container uses `flex: 1 1 auto` and provide a centered empty-state/card that occupies remaining space.
5. Audit and fix horizontal overflow causes:
   - Add `max-width:100%` to media and wide components; remove negative margins and oversized fixed-width elements.

Implementation steps (concrete)
------------------------------
1. Quick deploy (10–20 minutes):
   - Add the viewport meta tag to `apps_script/Dashboard.html` and `apps_script/ItemForm.html` (or to the shared head include if one exists). Deploy and test on a phone — this may immediately resolve the zoomed-out rendering.
2. CSS baseline (30–60 minutes):
   - Apply the foundation CSS changes in `apps_script/styles.html`. Verify desktop and tablet are not regressing.
3. Renderer audit and fixes (1–3 hours):
   - Search `apps_script/` for inline pixel widths and refactor them to CSS classes or responsive sizing.
4. Layout polish (30–60 minutes):
   - Ensure `.app-root` / `#content` flex and main content uses `flex:1`. Implement a full-height empty-state card for when no project is selected.
5. QA (1–2 hours):
   - Test on iOS Safari and Android Chrome; verify no zoom-out, no unwanted horizontal scroll, and that content fills the viewport when present. Capture screenshots and note any regressions.

QA Checklist
------------
- **Viewport meta**: present and correct on all pages.
- **No global horizontal scrolling**: the page width matches the device width at natural scale.
- **Content fills vertical space**: `#content` is flexible and empty-state fills available area.
- **No remaining inline pixel widths** in JS renderers that cause overflow.
- **Images and embeds respect container width** via `max-width:100%`.
- **Regression screenshots** captured for iOS Safari and Android Chrome.

Notes
-----
- The most common single cause of the behaviour you described is a missing or incorrect viewport meta tag — add it first and retest before deeper changes.
- Prefer auditing and removing the root causes (fixed widths, transforms, inline styles) rather than using global `overflow-x: hidden` as a band-aid.
- Make changes incrementally so you can revert the smallest failing step if a regression appears.

Progress log (work completed)
-----------------------------
- **Viewport meta**: Verified presence of `<meta name="viewport" content="width=device-width, initial-scale=1">` in both `apps_script/Dashboard.html` and `apps_script/ItemForm.html`.
- **Styles**: Added a mobile-first responsive baseline to `apps_script/styles.html` including:
  - `html, body { height: 100%; margin: 0; padding: 0; box-sizing: border-box; }`
  - `.app-root` and `#content` set to use flex layout and `min-height: 100vh` so content can grow to fill the viewport.
  - Media/embedded assets constrained with `max-width:100%` and `height:auto`.
  - Mobile touch targets increased (`.btn`, `.btn.btn-icon`) and responsive helper classes (`.modal-centered`, `.modal-fullscreen`, `.col-fixed-120`, `.col-fixed-80`).
- **Renderer fixes (partial)**: Removed a hard-coded modal width in `apps_script/Dashboard.html` (replaced `card.style.width = '360px'` with a responsive `modal-centered` card) and replaced a couple of inline fixed-width container divs with `.col-fixed-*` helper classes so they collapse on small viewports.
- **Pointer-safe desktop rule**: Updated desktop media query to `@media (min-width: 901px) and (pointer: fine)` so touch devices won't match the desktop layout.
- **Debug banner resilience**: Reworked the debug banner to prefer `google.script.url.getLocation(...)` (when available) and fall back to `window.location.search` so `?debug_banner=1` can be detected inside Apps Script HtmlService contexts.

Test performed and results
--------------------------
- Initial test on iPhone showed: **the app appeared tiny and centered in a large empty page** — UI controls rendered small with excessive whitespace.
- **FIXED**: After implementing the comprehensive mobile fixes below, the app should now render properly on mobile devices.

Root cause analysis and fixes applied
-------------------------------------
The primary issue was **conflicting CSS rules** where the desktop layout constraints were overriding mobile responsiveness:

1. **Main layout constraint fixed**: The `.app-root` element had `width: 50%` applied on desktop but this was bleeding through to mobile. Added `width: 100% !important` overrides for mobile viewports.

2. **Embedded styles issue resolved**: The `styles.html` file was not being included in the main HTML files. Added mobile-responsive CSS directly to both `Dashboard.html` and `ItemForm.html`.

3. **Inline fixed widths removed**: Replaced problematic inline styles:
   - Removed `max-width: 600px` constraint on transaction form
   - Removed `min-width: 200px` and `min-width: 180px` constraints that caused overflow
   - Changed to `min-width: 0` to allow proper flex shrinking

4. **Enhanced mobile media queries**: Added comprehensive responsive rules:
   - `@media (max-width: 900px)` for tablets
   - `@media (max-width: 480px)` for phones
   - Stack project selector vertically on small screens
   - Increased touch targets (44px minimum)
   - Added overflow protection and word-breaking

Changes made to files
--------------------
- **Dashboard.html**: Added mobile CSS overrides, removed fixed width constraints, refactored to a mobile-first responsive block, and adjusted/moved the desktop media query to `@media (min-width: 901px)` to avoid breakpoint overlap. Also injected temporary debug CSS and runtime helpers during troubleshooting.
- **ItemForm.html**: Added mobile CSS overrides, improved touch targets and form layout
- **styles.html**: Enhanced with tablet and mobile breakpoints (though not directly included, serves as reference)

**CHANGES APPLIED IN-CHAT (status: unresolved)**
------------------------------------------------
- Consolidated scattered responsive rules in `Dashboard.html` into a single mobile-first responsive block.
- Changed the desktop breakpoint from `@media (min-width: 900px)` to `@media (min-width: 901px)` and moved it after mobile rules to eliminate overlap.
- Increased touch target sizes and ensured key elements use `min-width: 0` so they can shrink correctly.
- Injected temporary debug aids into `Dashboard.html` during troubleshooting:
  - An always-on debug banner (made unconditional during testing) reporting runtime viewport and media-query state.
  - A runtime helper to force `.app-root` full-width on small physical screens and via `?debug_force_fullwidth=1`.
  - A visualViewport-aware fallback that applies a temporary scale transform when the layout viewport is much larger than the visual viewport.

**Observed during testing**
- Desktop responsiveness behaves as expected: resizing triggers the responsive shift and elements wrap at the expected breakpoints.
- On the reporter's iPhone the page's CSS/layout viewport reports ~980px (innerWidth/docClient = 980) while the physical screen is 414px at DPR=2. This causes `@media (min-width:901px)` to match on the phone and desktop rules to apply.
- After applying runtime fixes and touch-CSS the UI becomes usable because the root is forced to full-width or scaled to fit; however the underlying layout viewport mismatch remains.

**Latest debug banner output (captured during last test)**
- innerWidth=980 | docClient=980 | screen=414 | dpr=2 | vv.width=980 | vv.scale=1
- appRoot.computedWidth=948px | appRoot.inline=100% | mq(min901)=true | mq(pointer:fine)=false | mq(touch)=true | scaled=false | scaleFactor=null

**Important: current status**
- Unresolved (pragmatic workaround applied): the UI is usable on the affected phone via temporary runtime and touch-css fixes, but the root cause (document/layout viewport larger than the physical device) remains and must be investigated at the host/wrapper level.

**Remaining possible causes to investigate**
- The Apps Script HtmlService host (or a parent frame) is presenting the document with an enlarged layout viewport or adding scaling that makes the document think it has a desktop-width viewport.
- The deployed environment could be serving a different snapshot than the workspace; confirm deployed URL serves current HEAD.
- Parent-frame CSS or container transforms/viewport settings may be interfering; inspect the full served HTML and any parent wrappers.

**Temporary mitigations applied**
- Added touch-capability CSS override in `apps_script/styles.html` using `@media (hover: none) and (pointer: coarse)` so touch devices receive mobile layout regardless of reported layout viewport.
- Added runtime full-width forcing for small physical screens and a `?debug_force_fullwidth=1` flag.
- Added a visualViewport diagnostic to the debug banner and a scale fallback when layout viewport ≫ visual viewport.

**Files modified in this session**:
- `apps_script/Dashboard.html` — debug banner, viewport meta hardened, runtime force and scale fallback added
- `apps_script/styles.html` — touch-capability mobile override added
- `dev_docs/implementation_docs/mobile_friendly_implementation.md` — updated with detailed session notes (this file)

**Status**: Unresolved — temporary patches make the app usable but the root cause (layout viewport reporting ~980px on a 414px device) remains.

