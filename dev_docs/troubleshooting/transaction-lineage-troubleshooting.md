# Troubleshooting: Item lineage deallocation errors (404 / PGRST205 / 406)

This document collects symptoms, likely causes, diagnostic checks, and remediation steps for errors encountered when moving an item from a project to business inventory (deallocation) while the app attempts to append a lineage edge.

Observed symptoms (example logs)
- 406 (Not Acceptable) for a `transactions` REST GET request:
  - GET .../rest/v1/transactions?...transaction_id=eq.INV_SALE_...
  - Browser/console shows `406 (Not Acceptable)`
- 404 (Not Found) for `item_lineage_edges` REST GET/POST:
  - GET .../rest/v1/item_lineage_edges?... 404
  - POST .../rest/v1/item_lineage_edges?select=* 404
- App-level error from lineage helper:
  - PGRST205: "Could not find the table 'public.item_lineage_edges' in the schema cache"

High-level likely causes
- The `item_lineage_edges` table (or its schema) hasn't been created/applied to the target Supabase/Postgres instance (migration not run or applied to wrong project).
- PostgREST (the Supabase REST layer) schema cache doesn't include the new table (PostgREST needs the table present when it loaded its schema).
- The client is pointing at the wrong Supabase project or a wrong DB URL/keys.
- RLS / permissions / policies or REST configuration preventing access (rarely causes 404; more likely 401/403).
- 406 response indicates the server couldn't satisfy the requested Accept/content negotiation — often a signature of PostgREST not being able to produce the content type (or misconfigured request headers).

Diagnostic checklist (in order)
1. Confirm you're hitting the correct Supabase project
   - Verify the client `SUPABASE_URL` / project reference in the running app matches the intended instance.
2. Check the table exists directly in the DB
   - Run (psql or Supabase SQL editor):
     ```sql
     SELECT table_schema, table_name
     FROM information_schema.tables
     WHERE table_name = 'item_lineage_edges';
     ```
   - Expect a row: `public | item_lineage_edges`
3. Inspect the migration files in this repo
   - See `supabase/migrations/012_add_item_lineage.sql` and `supabase/migrations/013_backfill_item_lineage.sql` exist in the repository.
4. Ensure migrations have been applied to the target DB
   - If you use Supabase CLI or a CI job, run your migration apply command for the target project (e.g., `supabase db push` or your deployment pipeline).
   - Or, manually run the SQL from `012_add_item_lineage.sql` in the Supabase SQL editor.
5. If the table exists but REST still 404 / PGRST205:
   - PostgREST uses an internal schema cache. If PostgREST started before the table existed, it may not see it.
   - Remedy: restart the PostgREST server / Supabase REST process or trigger a schema reload.
     - On Supabase Cloud, you may need to redeploy or temporarily restart the project services (or wait a short time after applying migration).
6. Verify the REST endpoint manually
   - Use curl with the anon or service key:
     ```bash
     curl -i -H "apikey: $SUPABASE_ANON_KEY" \
       "https://<your-project>.supabase.co/rest/v1/item_lineage_edges?select=*"
     ```
   - 200 => table accessible. 404 => PostgREST doesn't see the table.
7. Check row-level security / policies
   - Even with RLS, missing table/schema is a different error; but ensure policies allow INSERT/SELECT for the authenticated role as expected.
8. Confirm the `item_lineage_edges` table is in the `supabase_realtime` publication (if you rely on realtime)
   - The migration plan suggests adding it to the publication so realtime clients can subscribe.

Common remediation steps
- If the table is missing:
  1. Apply the migration to the correct DB. Example using Supabase SQL editor: paste the SQL from `supabase/migrations/012_add_item_lineage.sql` and run it.
  2. After the SQL runs, retry the REST call to confirm it returns 200.
- If the table exists but PostgREST returns PGRST205 / 404:
  1. Restart PostgREST / the Supabase service so the schema cache reloads. On self-hosted PostgREST, restart the process.
  2. In Supabase Cloud, try re-deploying or toggling a harmless setting to force reload; otherwise wait a short period and retry.
- If you applied the migration to the wrong project:
  - Re-run the migration against the correct project or restore the migration in the proper environment.
- If you see 406 on `transactions` GET:
  - Verify the request headers that your client is sending (supabase-js normally sets correct Accept headers).
  - Confirm the `transactions` table exists and `transaction_id` column exists and is the expected type.
  - Try the same request with curl to compare responses and headers; a working curl confirms client-side header/config mismatch.

Quick verification queries (examples)
- Confirm table exists:
```sql
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'item_lineage_edges';
```
- Check recent inserts (once table accessible):
```sql
SELECT id, item_id, from_transaction_id, to_transaction_id, created_at
FROM public.item_lineage_edges
WHERE item_id = 'I-f768b8bd-72ea-4715-b4af-fe30c62577fd'
ORDER BY created_at DESC
LIMIT 5;
```
- Example PostgREST curl test:
```bash
curl -i -H "apikey: $SUPABASE_ANON_KEY" \
  "https://<your-project>.supabase.co/rest/v1/item_lineage_edges?select=id,created_at&item_id=eq.I-f768b8bd-72ea-4715-b4af-fe30c62577fd&limit=1"
```

Notes about feature flags and rollout
- The plan uses `VITE_ENABLE_ITEM_LINEAGE`. If this is enabled in the client but the DB schema isn't present, clients will attempt lineage REST requests and fail. During rollout:
  - Keep the flag `false` until migrations are applied.
  - Or guard writes: app code should treat lineage writes as non-fatal (the code already logs non-critical failure) until schema is live.

If everything looks correct but failures continue
- Confirm your environment variables (SUPABASE_URL / key) in the running frontend/backend match the target project.
- Inspect server logs for PostgREST or Supabase dashboard logs for schema/cache reload errors.
- If using Supabase Cloud and the migration was applied, contact Supabase support with the PGRST205 and timestamps if the REST layer fails to see the new table after a reasonable time.

References in repo
- Migration files:
  - `supabase/migrations/012_add_item_lineage.sql`
  - `supabase/migrations/013_backfill_item_lineage.sql`
- Types & services touched by lineage:
  - `src/types/index.ts`
  - `src/services/inventoryService.ts`
  - `src/services/lineageService.ts` (new service; ensure deployed to runtime)

If you want, I can:
- Add a short checklist to the repo README linking to this doc.
- Add a small runtime guard in `appendItemLineageEdge` to detect missing-table errors and surface a link to this doc in the console.

--- 
Created on: 2025-11-09

Full console logs for a deallocation:

🚀 Starting deallocation process for item: I-f768b8bd-72ea-4715-b4af-fe30c62577fd
inventoryService.ts:2984 🔄 handleInventoryDesignation called: {itemId: 'I-f768b8bd-72ea-4715-b4af-fe30c62577fd', projectId: 'db6f557e-fd22-43f1-8ee1-af836d88101f', disposition: 'inventory'}
inventoryService.ts:2992 🔍 Getting item details for: I-f768b8bd-72ea-4715-b4af-fe30c62577fd
inventoryService.ts:2998 ✅ Item found: I-f768b8bd-72ea-4715-b4af-fe30c62577fd disposition: inventory projectId: db6f557e-fd22-43f1-8ee1-af836d88101f
inventoryService.ts:3046 🏦 Creating/updating Sale transaction for inventory designation
inventoryService.ts:49 📋 Audit logged: deallocation for item I-f768b8bd-72ea-4715-b4af-fe30c62577fd
supabase.ts:57 [AuthFetch] {method: 'GET', path: '/auth/v1/user', status: 200, elapsedMs: 154}
inventoryService.ts:3131 🏦 Creating/updating sale transaction for item: I-f768b8bd-72ea-4715-b4af-fe30c62577fd
inventoryService.ts:3165 🔑 Canonical transaction ID: INV_SALE_db6f557e-fd22-43f1-8ee1-af836d88101f
supabase.ts:47  GET https://rwevbekceexnoaabdnbz.supabase.co/rest/v1/transactions?select=*&account_id=eq.1dd4fd75-8eea-4f7a-98e7-bf45b987ae94&transaction_id=eq.INV_SALE_db6f557e-fd22-43f1-8ee1-af836d88101f 406 (Not Acceptable)
window.fetch @ supabase.ts:47
(anonymous) @ @supabase_supabase-js.js?v=621f9df8:6118
(anonymous) @ @supabase_supabase-js.js?v=621f9df8:6136
await in (anonymous)
then @ @supabase_supabase-js.js?v=621f9df8:606Understand this error
inventoryService.ts:3238 🆕 Creating new INV_SALE transaction with amount: 26.00
inventoryService.ts:3248 ✅ Sale transaction created/updated successfully
inventoryService.ts:3070 📦 Moving item to business inventory...
supabase.ts:57 [AuthFetch] {method: 'GET', path: '/auth/v1/user', status: 200, elapsedMs: 135}
supabase.ts:47  GET https://rwevbekceexnoaabdnbz.supabase.co/rest/v1/item_lineage_edges?select=id%2Ccreated_at&account_id=eq.1dd4fd75-8eea-4f7a-98e7-bf45b987ae94&item_id=eq.I-f768b8bd-72ea-4715-b4af-fe30c62577fd&from_transaction_id=eq.ffbf531f-f6ff-43e9-a132-aefd41e377f1&to_transaction_id=eq.INV_SALE_db6f557e-fd22-43f1-8ee1-af836d88101f&created_at=gte.2025-11-09T22%3A21%3A36.793Z&order=created_at.desc&limit=1 404 (Not Found)
window.fetch @ supabase.ts:47
(anonymous) @ @supabase_supabase-js.js?v=621f9df8:6118
(anonymous) @ @supabase_supabase-js.js?v=621f9df8:6136
await in (anonymous)
then @ @supabase_supabase-js.js?v=621f9df8:606Understand this error
supabase.ts:47  POST https://rwevbekceexnoaabdnbz.supabase.co/rest/v1/item_lineage_edges?select=* 404 (Not Found)
window.fetch @ supabase.ts:47
(anonymous) @ @supabase_supabase-js.js?v=621f9df8:6118
(anonymous) @ @supabase_supabase-js.js?v=621f9df8:6136
await in (anonymous)
then @ @supabase_supabase-js.js?v=621f9df8:606Understand this error
lineageService.ts:81 ❌ Failed to append lineage edge: {code: 'PGRST205', details: null, hint: null, message: "Could not find the table 'public.item_lineage_edges' in the schema cache"}
overrideMethod @ hook.js:608
appendItemLineageEdge @ lineageService.ts:81
await in appendItemLineageEdge
handleInventoryDesignation @ inventoryService.ts:3085
await in handleInventoryDesignation
handleItemDeallocation @ inventoryService.ts:3296
updateDisposition @ InventoryList.tsx:134
await in updateDisposition
onClick @ InventoryList.tsx:568
callCallback2 @ chunk-UPELNCPK.js?v=621f9df8:3674
invokeGuardedCallbackDev @ chunk-UPELNCPK.js?v=621f9df8:3699
invokeGuardedCallback @ chunk-UPELNCPK.js?v=621f9df8:3733
invokeGuardedCallbackAndCatchFirstError @ chunk-UPELNCPK.js?v=621f9df8:3736
executeDispatch @ chunk-UPELNCPK.js?v=621f9df8:7014
processDispatchQueueItemsInOrder @ chunk-UPELNCPK.js?v=621f9df8:7034
processDispatchQueue @ chunk-UPELNCPK.js?v=621f9df8:7043
dispatchEventsForPlugins @ chunk-UPELNCPK.js?v=621f9df8:7051
(anonymous) @ chunk-UPELNCPK.js?v=621f9df8:7174
batchedUpdates$1 @ chunk-UPELNCPK.js?v=621f9df8:18913
batchedUpdates @ chunk-UPELNCPK.js?v=621f9df8:3579
dispatchEventForPluginEventSystem @ chunk-UPELNCPK.js?v=621f9df8:7173
dispatchEventWithEnableCapturePhaseSelectiveHydrationWithoutDiscreteEventReplay @ chunk-UPELNCPK.js?v=621f9df8:5478
dispatchEvent @ chunk-UPELNCPK.js?v=621f9df8:5472
dispatchDiscreteEvent @ chunk-UPELNCPK.js?v=621f9df8:5449Understand this error
inventoryService.ts:3088 ⚠️ Failed to append lineage edge (non-critical): {code: 'PGRST205', details: null, hint: null, message: "Could not find the table 'public.item_lineage_edges' in the schema cache"}
overrideMethod @ hook.js:608
handleInventoryDesignation @ inventoryService.ts:3088
await in handleInventoryDesignation
handleItemDeallocation @ inventoryService.ts:3296
updateDisposition @ InventoryList.tsx:134
await in updateDisposition
onClick @ InventoryList.tsx:568
callCallback2 @ chunk-UPELNCPK.js?v=621f9df8:3674
invokeGuardedCallbackDev @ chunk-UPELNCPK.js?v=621f9df8:3699
invokeGuardedCallback @ chunk-UPELNCPK.js?v=621f9df8:3733
invokeGuardedCallbackAndCatchFirstError @ chunk-UPELNCPK.js?v=621f9df8:3736
executeDispatch @ chunk-UPELNCPK.js?v=621f9df8:7014
processDispatchQueueItemsInOrder @ chunk-UPELNCPK.js?v=621f9df8:7034
processDispatchQueue @ chunk-UPELNCPK.js?v=621f9df8:7043
dispatchEventsForPlugins @ chunk-UPELNCPK.js?v=621f9df8:7051
(anonymous) @ chunk-UPELNCPK.js?v=621f9df8:7174
batchedUpdates$1 @ chunk-UPELNCPK.js?v=621f9df8:18913
batchedUpdates @ chunk-UPELNCPK.js?v=621f9df8:3579
dispatchEventForPluginEventSystem @ chunk-UPELNCPK.js?v=621f9df8:7173
dispatchEventWithEnableCapturePhaseSelectiveHydrationWithoutDiscreteEventReplay @ chunk-UPELNCPK.js?v=621f9df8:5478
dispatchEvent @ chunk-UPELNCPK.js?v=621f9df8:5472
dispatchDiscreteEvent @ chunk-UPELNCPK.js?v=621f9df8:5449Understand this warning
inventoryService.ts:49 📋 Audit logged: deallocation for item I-f768b8bd-72ea-4715-b4af-fe30c62577fd
inventoryService.ts:3103 ✅ Item moved to business inventory successfully
inventoryService.ts:3105 ✅ Deallocation completed successfully
InventoryList.tsx:140 ✅ Deallocation completed successfully
