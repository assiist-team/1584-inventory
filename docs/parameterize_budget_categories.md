# Parameterize Budget Categories (per-account)

Decision: implement account-scoped budget categories with no backfill and no legacy fallbacks. Historical transactions will not be automatically mapped to new categories; categories will be applied going forward and can be assigned manually via admin UI or a one-time manual operation later.

## Goals
- Provide a first-class `budget_categories` table scoped to `account_id`.
- Surface CRUD in Settings so each account can manage its own categories.
- Store categories by id on transactions going forward (`category_id`).
- Avoid any automated backfill or fallback behavior during migration.

## High-level steps
1. Schema
   - Create `budget_categories` table:
     - `id` (PK), `account_id` (FK), `name`, `slug`, `metadata`, `created_at`, `updated_at`.
   - Add `category_id` column (FK) to `transactions`. Leave existing legacy `category` string untouched for the moment, but do not implement any code that falls back to it.
2. Backend
   - Add CRUD endpoints for account-scoped `budget_categories`.
   - Ensure `transactions` creation/update accepts `category_id` and enforces `account_id` scoping.
3. Frontend
   - Add Settings UI to list/create/edit/delete categories for the current account.
   - Update transaction creation/edit UI to require selecting a `category_id`.
4. Seeds & defaults
   - Add optional seed file(s) to populate sensible defaults per account when onboarding new accounts.
5. Rollout
   - Deploy backend+frontend changes that use `category_id` for reads/writes.
   - Run migrations to add the table and the `category_id` column.
   - Allow administrators to create categories and assign them to transactions manually (bulk UI or script) if desired.
   - Optionally, once every account has categories assigned, make `transactions.category_id` NOT NULL and remove legacy column in a later release.

## Consequences of "no backfill, no fallback"
- Existing transactions will retain their legacy `category` string (if present) but the app will not read or display that string once the UI is switched to use `category_id` exclusively.
- You must provide a manual workflow (UI or script) to assign categories to historical transactions if you want them categorized.
- This approach avoids migration-time load and complexity, but requires operational coordination.

## Files to be edited / added
Note: adjust paths to match your repo layout if names differ.

- Database migrations
  - `supabase/migrations/017_create_budget_categories.sql` (new)
  - `supabase/migrations/018_add_transaction_category_id.sql` (new; add FK to `transactions`)
  - `supabase/migrations/019_seed_budget_category_defaults.sql` (optional seed)

- Backend (API / services / models)
  - `backend/src/models/budgetCategory.ts` (new)
  - `backend/src/services/budgetCategoriesService.ts` (new)
  - `backend/src/routes/budgetCategories.ts` (new endpoint)
  - `backend/src/routes/transactions.ts` (update to accept `category_id`)
  - `backend/src/schemas/budgetCategorySchema.ts` (validation)
  - `backend/src/types/budget.ts` or `backend/src/types/index.ts` (type defs)

- Frontend (UI / hooks / components)
  - `frontend/src/pages/settings/Categories.tsx` (new Settings page/section)
  - `frontend/src/components/CategorySelect.tsx` (reusable selector)
  - `frontend/src/components/TransactionForm.tsx` (update to require category)
  - `frontend/src/hooks/useCategories.ts` (data fetching + cache)
  - `frontend/src/constants/defaultCategories.ts` (optional)
  - `src/constants/transactionSources.ts` (review if defaults reference vendors/categories)

- Tests & QA
  - `tests/api/budgetCategories.test.ts`
  - `tests/api/transactions_category.test.ts`
  - `tests/ui/settings/categories.spec.ts`

- Docs
  - `docs/parameterize_budget_categories.md` (this file)
  - `README.md` or `docs/deploy.md` (update rollout steps)

## Minimal required changes to keep disruption low
- Implement and deploy API+UI that writes/reads `category_id` only.
- Add `category_id` column as nullable so migration is fast and reversible.
- Add admin Settings page so accounts can create categories immediately after migration.
- Defer making `category_id` NOT NULL and dropping legacy column until after accounts have categories assigned.

## Rollout checklist
- [ ] Create migrations and commit.
- [ ] Implement backend endpoints and validation.
- [ ] Implement Settings UI and Transaction form changes.
- [ ] Deploy backend + frontend in a coordinated release.
- [ ] Run DB migrations.
- [ ] Admins create categories per account.
- [ ] Optionally make `category_id` NOT NULL and drop legacy column in a later safe release.


## Notes / Recommendations
- Provide a small admin bulk-assign UI to let operators assign categories to historical transactions (manual step outside migration).
- Use slugs and account-scoping in `budget_categories` to make programmatic matching easier later if you decide to backfill.

## Frontend — Project creation (authoritative)
When a new project is created the UI will use the account's budget categories from Settings. The `CreateProject` form will present a category selector populated from `budget_categories` for the current account and will persist the selected `default_category_id` on the project (if the product model stores a project default).

Files to modify (project creation):
  - `frontend/src/pages/projects/CreateProject.tsx`
  - `frontend/src/components/ProjectSettings.tsx`
  - `frontend/src/components/ProjectDefaultsForm.tsx`
  - `frontend/src/hooks/useCategories.ts`
  - `backend/src/routes/projects.ts`
  - `backend/src/services/projectsService.ts`
  - `backend/src/schemas/projectSchema.ts`

## Frontend & Backend — Budget Progress Tracking (authoritative)
All budget progress reporting and aggregation will use `category_id` joined to `budget_categories`. Update all aggregation queries, views, reports, and UI components to reference `budget_categories.id` (and `budget_categories.name` for labels).

Files to modify (budget progress):
  - `frontend/src/components/BudgetProgressChart.tsx`
  - `frontend/src/pages/project/BudgetOverview.tsx`
  - `frontend/src/pages/account/BudgetDashboard.tsx`
  - `frontend/src/hooks/useBudgetProgress.ts`
  - `backend/src/services/budgetProgressService.ts`
  - `backend/src/routes/budgetProgress.ts`
  - `backend/src/reports/budgetReports.ts`
  - Database views / materialized views / aggregate scripts (e.g. `supabase/views/budget_progress_view.sql`)

Tests to update:
  - `tests/ui/budgetProgress.spec.ts`
  - `tests/api/budgetProgress.test.ts`

## Permissions & scoping
- Ensure all frontend components and backend endpoints enforce `account_id` scoping for categories and progress reads/writes. Never expose categories from other accounts.
- Consider adding feature flags or rollout gating for toggling new category-based reporting in staging before production.

## Existing non-doc/test files that reference budget progress
The following files in the repository reference budget progress and must be included in implementation and testing. (Docs and test files are intentionally excluded.)
- `src/pages/Projects.tsx`
- `src/pages/ProjectDetail.tsx`
- `src/components/ui/BudgetProgress.tsx`
- `dist/assets/BudgetProgress.js`
- `dist/assets/BudgetProgress.js.map`
- `dist/assets/Projects.js`
- `dist/assets/Projects.js.map`
- `dist/assets/ProjectDetail.js`
- `dist/assets/ProjectDetail.js.map`
- `dist/assets/index.js`

