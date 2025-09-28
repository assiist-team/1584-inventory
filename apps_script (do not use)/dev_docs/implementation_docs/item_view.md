Item view and edit UX — implementation notes
===========================================

Purpose
-------
Describe the read-only item view introduced to replace the previous behavior where clicking an inventory item immediately opened an inline edit form.

Summary of UX changes
---------------------
- Clicking an item opens a read-only view within the `Inventory` tab.
- The view shows key fields in a compact key/value layout and includes an explicit `Edit` button.
- Pressing `Edit` switches the same inline area to an edit form with `Cancel` and `Save` controls.
- A `← Back` button returns to the inventory list. The item id is displayed in the header for reference.

Files touched
-------------
- `apps_script/Dashboard.html` — new render helpers for item view/edit, refined styles.

Implementation details
----------------------
1. Styling
   - Added utility classes: `.btn`, `.btn.ghost`, `.toolbar`, `.kv`, `.field-label`, `.field-value`, `.muted`.
   - Kept `.primary` as the accent button per the existing palette (#9C8160).

2. Item open flow (`openItemInline`)
   - Header now contains `← Back` and the item id.
   - Two helper functions manage rendering:
     - `renderItemView(item)` — read-only layout with an `Edit` button.
     - `renderItemEdit(item)` — form fields, `Cancel` and `Save` buttons; on save, values are persisted via `updateItem` and the view switches back to `renderItemView` with updated values.
   - Cache-first strategy retained: when possible, construct `item` from `getSheetValues` cache; otherwise fallback to `google.script.run.getItem`.
   - Existing guarded retry/logging remains intact.

3. Accessibility/Usability
   - Larger hit targets, clearer visual hierarchy, and key/value layout for quick scanning.
   - `Cancel` returns to read-only view without losing context.

Future enhancements
-------------------
- Persist inline edits in cache after successful save to keep list and view in sync.
- Consider a compact toolbar with `Duplicate`, `Delete` (with confirm), and `View QR` actions as next steps.

Developer tips
--------------
- View/edit functions are local to `openItemInline` to keep state scoped.
- If introducing additional fields, update both renderers to ensure parity.


