# Consolidate duplicated row rendering (keep inline UX)

Updated copy-paste prompt + exact code edits to **extract a shared row renderer** and use it in both cache and server branches of `showInventoryList` in `apps_script/Dashboard.html`. This preserves the inline item view (`openItemInline`) and removes duplicated row HTML while keeping selection state, bookmark/print buttons, and event handling consistent.

---

## Goal
- Remove duplicated list-row HTML between the cache and server render branches by creating a single `renderRowHtml(item, headers, selectionMap)` helper used by both branches.
- Keep the inline item view (`openItemInline` / `renderItemView`) intact.
- Preserve selection checkbox `checked` state using `getSelectionMap(sheetName)`.
- Ensure bookmark and print buttons are present and styled `btn btn-icon` in both branches and inline view.

---

## Problem & rationale

There is duplicated row HTML and event-handling scattered across multiple places (cache-render branch, server-render branch, and inline rendering helpers). That duplication caused the bookmark/print inconsistencies you saw: small UI differences in one copy did not get applied to others, producing shifty or missing icons. Consolidating the row markup into a single `renderRowHtml` reduces the places we must edit and therefore reduces bugs and maintenance cost. This refactor preserves the inline item view and selection behavior while centralizing the row template.

**Caveat:** this is a pragmatic proposal — it should make the UI more consistent and easier to maintain, but it may not fit every constraint of the app (e.g., if the server branch needs slightly different markup for accessibility or analytics). Treat this as a recommended approach and validate in your environment before committing widely.

---

## Implementation details (copy/paste)

1) Add a robust `renderRowHtml` helper near the top of the script section in `apps_script/Dashboard.html` (after `PRINTER_SVG` / `BOOKMARK_SVG` definitions). It must:
- Accept `item` which can be a row-array (from cache/server) or an object (if you ever normalize server data).
- Accept `headers` (array) when `item` is a row-array so fields can be read by index.
- Accept `selectionMap` (object from `getSelectionMap(sheetName)`) to render the checkbox `checked` state.

Copy/paste this function:

```javascript
function renderRowHtml(item, headers, selectionMap){
  var isArray = Array.isArray(item);
  function field(name){
    if (isArray) {
      if (!headers || headers.indexOf(name) === -1) return '';
      var v = item[headers.indexOf(name)];
      return (v === null || v === undefined) ? '' : escapeHtml(String(v));
    }
    var v = (item && item[name]) || '';
    return escapeHtml(String(v));
  }

  var itemId = isArray ? (item[headers.indexOf('item_id')] || '') : (item && item.item_id) || '';
  itemId = String(itemId || '');
  var checked = (selectionMap && selectionMap[itemId]) ? ' checked' : '';

  var desc = field('description');
  var price = field('price');
  var src = field('source');
  var created = field('date_created') || field('date_created');

  var html = '';
  html += '<div class="card" data-item-id="' + encodeURIComponent(itemId) + '" style="cursor:pointer">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
      html += '<div style="display:flex;gap:8px;align-items:center">';
        html += '<input type="checkbox" class="item-select" data-item-id="' + encodeURIComponent(itemId) + '"' + checked + '>';
        html += '<div><strong>' + desc + '</strong></div>';
      html += '</div>';
      html += '<div style="min-width:40px;display:flex;justify-content:flex-end;gap:8px;align-items:center">';
        html += '<button class="btn btn-icon" data-bookmark-item-id="' + encodeURIComponent(itemId) + '" title="Bookmark">' + BOOKMARK_SVG + '</button>';
        html += '<button class="btn btn-icon" data-print-item-id="' + encodeURIComponent(itemId) + '" title="Print QR">' + PRINTER_SVG + '</button>';
      html += '</div>';
    html += '</div>';
    html += '<div style="color:#666">Price: ' + price + '</div>';
    html += '<div style="color:#444">Source: ' + src + '</div>';
    html += '<div style="color:#999;font-size:12px">Created: ' + created + '</div>';
  html += '</div>';
  return html;
}
```

Notes: this helper uses `escapeHtml` already defined in the file.

2) Replace duplicated row-building code in the **cache branch** (where `cached` is used) with this call. Locate the `rows.forEach(function(r){` loop in the cache branch and replace the body with:

```javascript
rows.forEach(function(r){
  html += renderRowHtml(r, headers, getSelectionMap(sheetName));
});
```

3) Replace duplicated row-building code in the **server branch** (after `getSheetValues` success handler) with the same call (pass the `headers` variable returned by the server):

```javascript
rows.forEach(function(r){
  html += renderRowHtml(r, headers, getSelectionMap(sheetName));
});
```

4) Event delegation: keep the existing delegate logic but ensure it's attached only once per container. Use this delegate (it preserves inline behavior via `openItemInline`):

```javascript
var delegate = function onCardClick(e){
  if (e && e.target && e.target.matches && e.target.matches('input.item-select')) return;

  var bookmarkBtn = e.target && e.target.closest && e.target.closest('button[data-bookmark-item-id]');
  if (bookmarkBtn) {
    var bid = decodeURIComponent(bookmarkBtn.getAttribute('data-bookmark-item-id') || '');
    writeDebug('Toggled bookmark for ' + bid);
    if (bookmarkBtn.classList.contains('active')) bookmarkBtn.classList.remove('active'); else bookmarkBtn.classList.add('active');
    return;
  }

  var printBtn = e.target && e.target.closest && e.target.closest('button[data-print-item-id]');
  if (printBtn) {
    var pid = decodeURIComponent(printBtn.getAttribute('data-print-item-id') || '');
    var url = BASE_URL + '?action=itemForm&itemUrlId=' + encodeURIComponent(pid);
    window.open(url + '&_print=true', '_blank');
    return;
  }

  var card = e.target && e.target.closest && e.target.closest('.card[data-item-id]');
  if (!card) return;
  var itemId = decodeURIComponent(card.getAttribute('data-item-id') || '');
  if (!itemId) return alert('Item has no id');
  openItemInline(itemId, sheetName);
};

// Attach once (replace any duplicate attachment code):
try { c.removeEventListener('click', c.__delegateHandler || delegate); } catch(e) {}
c.addEventListener('click', delegate);
c.__delegateHandler = delegate;
```

Important: the `getSelectionMap(sheetName)` call is available in the file and returns the persisted selection map used elsewhere; passing it into `renderRowHtml` preserves checked state.

5) Replacement specifics and examples
- Cache branch (replace the loop):

```javascript
// OLD: rows.forEach(function(r){ /* long inline HTML concat */ });
// NEW:
rows.forEach(function(r){
  html += renderRowHtml(r, headers, getSelectionMap(sheetName));
});
```

- Server branch (replace the loop identically):

```javascript
rows.forEach(function(r){
  html += renderRowHtml(r, headers, getSelectionMap(sheetName));
});
```

6) Sanity checks
- Run linter on `apps_script/Dashboard.html`.
- Manual test plan:
  - Hard-refresh the dashboard.
  - Open a project and view inventory.
  - Verify the list rows show bookmark + print icons correctly for both cached and server-rendered views.
  - Verify selection checkbox state persists and displays as checked when selected.
  - Click a card to open the inline item view (existing inline behavior should remain).
  - Ensure bookmark toggles and print open `ItemForm` with `_print=true`.

---

This updated document provides precise code to paste into `apps_script/Dashboard.html` to dedupe row rendering while preserving inline UX and selection state. If you want, I can apply these changes directly; otherwise share this with a reviewer or another model/dev to implement.



