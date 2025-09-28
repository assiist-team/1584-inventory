Deployment & permissions
========================

1. Create the Apps Script project
   - Open script.google.com and create a new project.
   - Copy `apps_script/Code.gs`, `apps_script/Index.html`, and `apps_script/ItemForm.html` into the project.

2. Set Script Properties
   - In the Apps Script editor: Project Settings → Script properties.
   - Add `INVENTORY_SPREADSHEET_ID` (spreadsheet ID) and optionally `TRANSACTIONS_SPREADSHEET_ID`.

3. Deploy the web app
   - Deploy → New deployment → select `Web app`.
   - Execute as: Me (the script owner). This allows the app to access the spreadsheets without requiring each user to authenticate.
   - Who has access: choose `Anyone` or `Anyone within <your org>` depending on security needs.

4. Test
   - Visit the deployed URL. The `Index.html` UI should load and list projects.
   - Use a test spreadsheet or a copy of your production spreadsheet for initial testing.

Security notes
--------------
- Storing the Spreadsheet ID in script properties avoids hard-coding.
- Executing the script as the owner centralizes access control; be cautious with `Who has access`.
- For stricter access, consider using OAuth and a server-side component that mediates access.


