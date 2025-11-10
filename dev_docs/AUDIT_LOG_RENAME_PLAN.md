# Plan: Rename `audit_logs` → `item_audit_logs`

Purpose
- Make the table name explicit to avoid confusion with `transaction_audit_logs`.

Goals
- Provide a zero-downtime-safe path for renaming.
- Minimize risk by enabling a staged migration (view -> code migration -> rename).
- Provide test, rollback, and checklist items.

Assumptions
- Codebase references `audit_logs` in SQL, server code, and possibly client-side queries.
- RLS/policies and realtime publication may reference the table name.
- CI runs test suite that can catch missed references.

High-level approach (recommended, safe)
1. Create a read-only view `public.item_audit_logs` pointing to `public.audit_logs`.  
   - This gives readable clarity immediately and allows incremental code migration.
   - SQL:
     ```sql
     CREATE OR REPLACE VIEW public.item_audit_logs AS SELECT * FROM public.audit_logs;
     ```
2. Update server and client code to prefer `item_audit_logs` where appropriate. Deploy these code changes over 1-2 deploys.
3. After confirming no writes target the `audit_logs` name (search for INSERT/UPDATE/DELETE), do the atomic rename:
   - Lock writers (short maintenance window) OR ensure app-level quiesce for writers.
   - Run:
     ```sql
     BEGIN;
     ALTER TABLE public.audit_logs RENAME TO public.item_audit_logs;
     -- Recreate any indexes/policies/publication names if necessary (most persist)
     COMMIT;
     ```
4. Create a compatibility view named `public.audit_logs` that selects from `public.item_audit_logs` so any missed references keep working:
   ```sql
   CREATE OR REPLACE VIEW public.audit_logs AS SELECT * FROM public.item_audit_logs;
   ```
5. Gradually remove the compatibility view after a suitable monitoring period and CI verification.

Checklist — Pre-rename search & updates
- [ ] Grep the repo for `audit_logs` occurrences:
  - search for `audit_logs` string and SQL referring to the table
  - search for `.audit_logs` (JS/TS) and raw SQL files
- [ ] Update RLS policies if they reference `audit_logs` by name (policies are attached to tables, so migrating the table with ALTER TABLE RENAME will keep them attached; views will not).
- [ ] Update realtime publication: `ALTER PUBLICATION supabase_realtime DROP TABLE public.audit_logs; ALTER PUBLICATION supabase_realtime ADD TABLE public.item_audit_logs;` (if publication referenced the old name explicitly)
- [ ] Update database triggers/functions that reference the old name
- [ ] Update tests to use the new name
- [ ] Ensure backups/snapshots are in place before the rename

Deployment & cutover plan (detailed)
1. Create `item_audit_logs` view migration and deploy it (no app downtime).
2. Run automated search + tests; start migrating code to use `item_audit_logs`.
3. Coordinate short maintenance window or ensure writers are quiesced for rename commit (recommended < 1 minute).
4. Execute `ALTER TABLE ... RENAME TO ...` in a migration executed during the window.
5. Re-run tests & smoke checks; create compatibility view `audit_logs` if needed.
6. Monitor errors/metrics for 24–48 hours; remove compatibility view when confident.

Rollback plan
- If the rename causes unexpected issues, restore from DB backup or drop the compatibility view and re-create the original table name by reversing rename in a migration.

Post-rename cleanup
- Remove compatibility view `public.audit_logs`.
- Update documentation and `dev_docs` references.
- Notify integrators about the change (if any external integration depends on the table name).

Examples & snippets
- Create view:
  ```sql
  CREATE OR REPLACE VIEW public.item_audit_logs AS SELECT * FROM public.audit_logs;
  ```
- Rename (run during maintenance window):
  ```sql
  BEGIN;
  ALTER TABLE public.audit_logs RENAME TO public.item_audit_logs;
  ALTER PUBLICATION IF EXISTS supabase_realtime DROP TABLE public.audit_logs;
  ALTER PUBLICATION IF EXISTS supabase_realtime ADD TABLE public.item_audit_logs;
  COMMIT;
  ```

Notes
- This plan minimizes risk by allowing a staged migration. If you want, I can also draft the full rename migration and search + patch all code references automatically (higher risk).


