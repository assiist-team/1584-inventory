Frontend overview
=================

Files
-----
- `apps_script/Index.html` — main control panel UI served by Apps Script.
- `apps_script/ItemForm.html` — item edit form used for QR links.

Behavior
--------
- On load, the frontend calls `?action=listSheets` to populate the project selector.
- When a project is selected and opened, the control panel shows three main tabs: `Inventory`, `Transactions`, and `Add`.
- `Inventory` tab displays the project's inventory list. Tapping an item opens the item details/edit view within the same screen and shows a `Back` control to return to the list (no separate browser navigation). The item view can be used for both viewing and editing a single item.
- `Transactions` tab displays transaction history and controls for adding transactions.
- `Add` is a contextual action area (replaces the previous standalone `Add Inventory` button) and exposes the small form for creating inventory rows; submission POSTs to `appendInventory` and receives `item_id` + `qr_link`.
- Previously-named `Edit Inventory` is now the `Inventory` tab — it calls `?action=getSheet&sheet=SheetName` to populate the list, and tapping items opens the in-screen item view/edit form.

Styling
-------
- Use the `style_guide.md` tokens: primary color `#9C8160`, secondary `#03DAC6`, spacing scale `4 / 8 / 16 / 24 / 32`, row height target ~72dp.
- The current `Index.html` includes minimal mobile-friendly CSS that follows the guide; feel free to extract a small CSS file later.

Improvements
------------
- Replace the simple list rendering with a structured list that maps headers to fields.
- Add client-side validation and nicer UX for form submission and success/failure states.
- Add a QR scanner integration (mobile camera) or allow pasting/scanning QR to open item edit URL.
- Implement the in-screen item view: when an inventory row is tapped, transition to a single-item view that shows details and edit controls and provides a visible `Back` control to return to the list. This improves discoverability on mobile and keeps navigation within the app shell.


