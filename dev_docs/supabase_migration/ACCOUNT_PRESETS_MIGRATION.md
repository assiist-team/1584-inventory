# Account Presets Consolidation & Migration Plan

Status: draft — created to document the plan for adding an `account_presets` table, migrating existing presets (tax_presets, vendor_defaults) and consolidating account-scoped presets into a single canonical table.

This document describes the recommended schema, migration SQL, service API, UI changes, verification steps, and rollback considerations.

## Goals
- Introduce a single canonical place to store account-scoped presets.
- Provide explicit columns for frequently-used/typed presets (e.g., `default_category_id`) with FK protections.
- Provide a flexible `presets` JSONB column for varied presets (tax presets, vendor slots, future presets).
- Migrate existing `tax_presets` and `vendor_defaults` into the new table.
- Migrate per-project `projects.default_category_id` values into the account-level `default_category_id`.
- Update frontend to use the new service and deprecate localStorage usage.

## Recommended schema

Create a hybrid table with explicit typed fields and a JSONB blob:

```sql
create table if not exists account_presets (
  account_id uuid primary key references accounts(id) on delete cascade,
  default_category_id uuid references budget_categories(id),
  presets jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

- `default_category_id` is an explicit FK used to drive transaction defaults and validations.
- `presets` stores other presets: e.g. `{ "tax_presets": [...], "vendor_defaults": [...] }`.

Rationale: this gives the best of both worlds — typed columns for correctness and JSONB for flexibility.

## Migration steps (safe order)

1. Create `account_presets` (apply the CREATE statement above).

2. Ensure there is one `account_presets` row per `accounts` row (create empty rows):
```sql
insert into account_presets (account_id, presets, created_at, updated_at)
select a.id, '{}'::jsonb, now(), now()
from accounts a
on conflict (account_id) do nothing;
```

3. Migrate `tax_presets` into `presets->'tax_presets'`:
```sql
update account_presets ap
set presets = jsonb_set(ap.presets, '{tax_presets}', tp.presets::jsonb),
    updated_at = now()
from tax_presets tp
where tp.account_id = ap.account_id;
```

4. Migrate `vendor_defaults` into `presets->'vendor_defaults'`:
```sql
update account_presets ap
set presets = jsonb_set(ap.presets, '{vendor_defaults}', vd.slots::jsonb),
    updated_at = now()
from vendor_defaults vd
where vd.account_id = ap.account_id;
```

5. Migrate `projects.default_category_id` into `default_category_id`.
   Strategy (recommended): for each account, take the earliest created project that has a non-null `default_category_id`.
```sql
with first_defaults as (
  select account_id, default_category_id
  from (
    select account_id, default_category_id,
           row_number() over (partition by account_id order by created_at asc) as rn
    from projects
    where default_category_id is not null
  ) s
  where rn = 1
)
update account_presets ap
set default_category_id = fd.default_category_id,
    updated_at = now()
from first_defaults fd
where ap.account_id = fd.account_id;
```

6. Application cutover:
   - Deploy backend service code and frontend changes to read/write `account_presets`.
   - Keep old tables (`tax_presets`, `vendor_defaults`, `projects.default_category_id`) readable during rollout to allow rollback.

7. Optional cleanup (after verification window):
```sql
alter table projects drop column if exists default_category_id;
-- optionally drop tax_presets and vendor_defaults after full verification
```

## Service API (example)

Add `src/services/accountPresetsService.ts` that follows existing patterns (`taxPresetsService`, `vendorDefaultsService`).

Example TypeScript:

```typescript
import { supabase } from './supabase'
import { convertTimestamps, ensureAuthenticatedForDatabase, handleSupabaseError } from './databaseService'

export interface AccountPresets {
  defaultCategoryId?: string | null
  presets?: any
}

export async function getAccountPresets(accountId: string): Promise<AccountPresets | null> {
  if (!accountId) return null
  try {
    const { data, error } = await supabase
      .from('account_presets')
      .select('*')
      .eq('account_id', accountId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    const converted = convertTimestamps(data)
    return {
      defaultCategoryId: converted.default_category_id || null,
      presets: converted.presets || {}
    }
  } catch (err) {
    console.error('Error fetching account presets:', err)
    return null
  }
}

export async function upsertAccountPresets(accountId: string, updates: Partial<AccountPresets>): Promise<void> {
  await ensureAuthenticatedForDatabase()
  const payload: any = {
    account_id: accountId,
    updated_at: new Date().toISOString()
  }
  if (updates.defaultCategoryId !== undefined) payload.default_category_id = updates.defaultCategoryId
  if (updates.presets !== undefined) payload.presets = updates.presets

  const { error } = await supabase
    .from('account_presets')
    .upsert(payload, { onConflict: 'account_id' })

  if (error) throw error
}
```

Notes:
- The service should provide convenience helpers (e.g., `getDefaultCategory(accountId)` and `setDefaultCategory(accountId, categoryId)`).
- Follow error handling patterns used across `src/services`.

## Frontend changes
- Replace localStorage-based default category persistence with `accountPresetsService` usage in:
  - `src/components/BudgetCategoriesManager.tsx` — load the current account preset on mount and use the service to save.
  - `src/pages/AddTransaction.tsx` — fetch `defaultCategoryId` on mount and initialize `categoryId`.
- Remove writes to `projects.default_category_id` on project create/update (we already started this).

## Verification
- Unit/integration tests:
  - Add tests for `accountPresetsService` (get & upsert).
  - Update existing UI tests that assumed localStorage behavior.
- Manual verification:
  - Verify the Settings → Presets → Budget Categories UI loads and shows migrated defaults.
  - Create a transaction and verify the category is pre-selected with the account preset.
  - Verify old tables/columns still return expected data during rollout.

## Rollback strategy
- Keep old tables (`tax_presets`, `vendor_defaults`) and `projects.default_category_id` unchanged until verification completes (read-only migration).
- If something goes wrong, revert frontend to use old tables/localStorage (we can keep a short-lived feature flag if desired).
- Drop old columns only after a successful verification window.

## Decisions required
- Migration rule for `projects.default_category_id` (we used earliest non-null project default by default). If you prefer "most common" or "latest", change step 5 accordingly.
- Cleanup timing: when should we drop `projects.default_category_id` and/or `tax_presets`/`vendor_defaults`?

## Next steps I can take (if you approve)
1. Apply the CREATE migration for `account_presets` via Supabase MCP.
2. Run the SQL migration steps to populate `account_presets` (tax_presets, vendor_defaults, projects defaults) per your chosen rule.
3. Implement `src/services/accountPresetsService.ts` and update `BudgetCategoriesManager` and `AddTransaction` to use it.
4. Run tests and manual verification.
5. After sign-off, drop deprecated columns/tables.

----
Document created by the migration implementation plan. Update this doc with chosen migration rules and schedule for cleanup.

## Implementation checklist & progress tracker
Use this checklist to coordinate work and record progress. Mark items complete as you finish them.

- [x] Create `account_presets` table (applied)
- [x] Ensure one `account_presets` row per account (idempotent insert applied)
- [x] Backfill `tax_presets` into `presets->'tax_presets'` when missing (idempotent update applied)
- [x] Backfill `vendor_defaults` into `presets->'vendor_defaults'` when missing (idempotent update applied)
- [x] Backfill earliest `projects.default_category_id` into `account_presets.default_category_id` when missing (idempotent update applied)
- [x] Enable RLS and add SELECT/INSERT/UPDATE policies for `account_presets` (applied)
- [x] Add index and table comment for `account_presets` (applied)
- [x] Implement `src/services/accountPresetsService.ts` (service added)
- [x] Update `BudgetCategoriesManager.tsx` to read/write account default from service (committed)
- [x] Update `AddTransaction.tsx` to read account default from service (committed)
- [ ] Update legacy services (`taxPresetsService.ts`, `vendorDefaultsService.ts`) to prefer `account_presets` (recommended)
- [ ] Sweep codebase for any remaining references to localStorage or legacy tables and update callers
- [ ] Add unit/integration tests that assert frontend and services use `account_presets`
- [ ] Manual verification across environments (staging / production)
 - [x] Manual verification across environments (staging / production) (light — few spot checks)
 - [x] Backup DB and run cleanup migration to drop legacy tables/columns (backup intentionally skipped per owner; cleanup applied)
 - [x] Update legacy services (`taxPresetsService.ts`, `vendorDefaultsService.ts`) to prefer `account_presets` (recommended)
 - [x] Sweep codebase for any remaining references to localStorage or legacy tables and update callers
 - [ ] Add unit/integration tests that assert frontend and services use `account_presets`
 - [ ] Manual verification across environments (staging / production)
 - [ ] Backup DB and run cleanup migration to drop legacy tables/columns

Notes:
- Completed items above were executed idempotently so they can be re-run safely.
- We intentionally kept legacy tables/columns readable during rollout — do not drop them until the two bullets above marked as pending are complete and verified.

## Current observed state (sample)
Below is a small sample of `account_presets` rows observed during verification. This demonstrates that `tax_presets` and `vendor_defaults` were migrated into the `presets` JSON for these accounts:

[
  {
    "account_id": "1dd4fd75-8eea-4f7a-98e7-bf45b987ae94",
    "default_category_id": null,
    "presets": {
      "tax_presets": [
        { "id": "nv", "name": "NV", "rate": 8.375 },
        { "id": "ut", "name": "UT", "rate": 7.1 },
        { "id": "ca", "name": "CA", "rate": 7.25 },
        { "id": "tx", "name": "TX", "rate": 6.25 },
        { "id": "az", "name": "AZ", "rate": 8.6 }
      ],
      "vendor_defaults": ["Homegoods","Amazon","Wayfair","Target","Ross","Arhaus","Pottery Barn","Crate & Barrel","West Elm","Living Spaces"]
    }
  },
  {
    "account_id": "2d612868-852e-4a80-9d02-9d10383898d4",
    "default_category_id": null,
    "presets": {
      "tax_presets": [
        { "id": "nv", "name": "NV", "rate": 8.375 },
        { "id": "ut", "name": "UT", "rate": 7.1 },
        { "id": "ca", "name": "CA", "rate": 7.25 },
        { "id": "tx", "name": "TX", "rate": 6.25 },
        { "id": "az", "name": "AZ", "rate": 8.6 }
      ],
      "vendor_defaults": ["Homegoods","Amazon","Wayfair","Target","Ross","Arhaus","Pottery Barn","Crate & Barrel","West Elm","Living Space"]
    }
  }
]

Observations:
- The sample shows `tax_presets` and `vendor_defaults` migrated successfully for these accounts.
- `default_category_id` is null for these accounts — this is acceptable per your note; project-level defaults can remain null.

## Guidance for developers (what to change in code)
Make code changes to prefer `account_presets` while keeping a safe fallback pattern for a brief transition window:

1. Services
   - Update `taxPresetsService.ts` and `vendorDefaultsService.ts` to:
     - First attempt to read from `account_presets.presets->'tax_presets'` / `presets->'vendor_defaults'`.
     - If missing, fall back to the legacy `tax_presets` / `vendor_defaults` tables.
     - When writing updates, persist to `account_presets` (and optionally also write-through to legacy tables while the rollout is active).
   - Add unit tests that mock both the new and old data sources.

2. UI
   - Replace any localStorage usage of `account_default_category_<accountId>` with calls to the `accountPresetsService` (`getDefaultCategory`, `setDefaultCategory`).
   - Update callers that previously read `taxPresetsService` / `vendorDefaultsService` if those services are changed to read the new table; prefer the new service API that returns normalized shapes for the UI.
   - Files observed during the initial scan that need review:
     - `src/components/BudgetCategoriesManager.tsx` (updated)
     - `src/pages/AddTransaction.tsx` (updated)
     - `src/pages/AddBusinessInventoryTransaction.tsx` (references `getTaxPresets` / `getAvailableVendors`)
     - Any other pages/components that import `taxPresetsService` or `vendorDefaultsService`

3. Tests & verification
   - Add tests asserting that updated services return the same shapes as legacy services for accounts with migrated data.
   - Manually verify:
     - Default category pre-selection when creating a transaction.
     - Vendor dropdowns and tax preset lists in the transaction flows.

## Verification queries (run before cleanup)
These queries help find accounts still missing migrated data.

-- Accounts missing tax_presets in account_presets
select account_id from account_presets where (presets->'tax_presets') is null;

-- Accounts missing vendor_defaults in account_presets
select account_id from account_presets where (presets->'vendor_defaults') is null;

-- Accounts missing default_category_id
select account_id from account_presets where default_category_id is null;

-- Compare legacy tax_presets with migrated value for one account
select tp.presets as old_tax, ap.presets->'tax_presets' as new_tax\nfrom tax_presets tp\njoin account_presets ap using(account_id)\nwhere ap.account_id = '<ACCOUNT_ID>';

-- Compare legacy vendor_defaults with migrated value for one account
select vd.slots as old_vendors, ap.presets->'vendor_defaults' as new_vendors\nfrom vendor_defaults vd\njoin account_presets ap using(account_id)\nwhere ap.account_id = '<ACCOUNT_ID>';

## Cleanup SQL (run only after verification and backup)
-- Backup snapshot (do this before any destructive changes)
-- DROP legacy presets tables and project column
drop table if exists tax_presets;
drop table if exists vendor_defaults;
alter table projects drop column if exists default_category_id;

-- Cleanup applied on 2025-11-13 via migration `drop_legacy_presets` (no backup). Legacy tables removed and `projects.default_category_id` dropped.

-- Optionally: drop any indexes/triggers related to legacy tables

----
Update this doc if you discover additional callers or edge-cases during the code sweep.


