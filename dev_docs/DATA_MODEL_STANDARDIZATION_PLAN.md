### Data Model Standardization Plan

A practical, step-by-step plan to standardize data structures and field names across the project, eliminate redundant/ambiguous fields, and establish guardrails to keep consistency over time. This plan is written to enable a junior developer to execute the work methodically and traceably.

---

### Goals
- **Consistency**: Use the same field names and shapes for common concepts across all documents and operations.
- **Clarity**: Remove redundant/ambiguous fields (e.g., `transactionDate` vs `createdAt`).
- **Safety**: Migrate data with dual-read/dual-write and a reversible path.
- **Traceability**: Ensure every change is discoverable, reviewable, and auditable.

---

### Scope
- All Firestore collections and subcollections used by the app.
- All TypeScript types in `src/types/` and any domain types embedded elsewhere.
- All service code in `src/services/` (e.g., `inventoryService.ts`).
- All UI code that reads/writes affected fields (components, pages, hooks).
- Firestore security rules and indexes if impacted.

---

### Canonical Field Dictionary (cross-cutting)
Use these field names and semantics everywhere they apply. For dates/times, prefer Firestore `Timestamp` at rest; convert to `Date` only at the edges.

- **id**: Firestore document ID (string). Not stored unless required; when stored, name is `id`.
- **schemaVersion**: Integer representing the schema version of the stored document.
- **createdAt**: When the document was first created in the database (server timestamp).
- **createdBy**: The user ID that created the document (`users/{uid}` ID, string).
- **updatedAt**: When the document was last updated (server timestamp). Always present after first update.
- **updatedBy**: The user ID that last updated the document (string).
- **deletedAt**: Soft delete timestamp. Absent/`null` means not deleted.
- **deletedBy**: The user ID that soft-deleted this document (string).
- **status**: Canonical lifecycle indicator. Allowed values per domain (see domain tables below). Avoid separate boolean flags and a string status for the same meaning.
- **tags**: `string[]` of user-defined tags.
- **notes**: Freeform text notes.
- **projectId / itemId / transactionId / ...**: Singular noun with `Id` suffix for references. Prefer `...Id` over ambiguous `...Ref` strings unless storing a Firestore `DocumentReference` object.
- **occurredAt**: Use for domain events (e.g., a financial transaction date/time when it happened). Distinct from `createdAt` which is when a record was inserted.
- **effectiveAt**: Use for rules/budgeting when a value takes effect, if different from when it occurred.

Money and quantities:
- **money**: Use a consistent shape when amounts and currency appear together. Canonical shape: `{ amountMinor: number, currencyCode: string }` where `amountMinor` is in the smallest unit (e.g., cents). If a single amount appears without currency, prefer `amountMinor` and require the context to supply the `currencyCode`.
- **quantity**: Numeric quantity for items. When units matter, include `unit` (e.g., `pcs`, `kg`, `lb`), or a domain-specific field.

Files and images:
- **images**: Array of `{ storagePath, url, width, height, createdAt, createdBy }` where `storagePath` and `url` are consistent with image service.

---

### Domain Canonicals and Status Values

Transactions (financial or inventory movement):
- Required: `occurredAt`, `createdAt`, `createdBy`
- Optional: `updatedAt`, `updatedBy`, `deletedAt`, `deletedBy`, `notes`, `tags`
- Relationships: `projectId`, `itemId` (when applicable)
- Amounts: prefer `{ money: { amountMinor, currencyCode } }` or domain equivalents (e.g., `total` -> `money`)
- Status: `status` in { `posted`, `void`, `pending` } as applicable

Items (catalog or inventory items):
- Required: `createdAt`, `createdBy`, `name`
- Optional: `updatedAt`, `updatedBy`, `deletedAt`, `deletedBy`, `description`, `tags`
- Relationships: `projectId` (if items are project-scoped)
- Status: `status` in { `active`, `archived` }

Projects:
- Required: `name`, `createdAt`, `createdBy`
- Optional: `updatedAt`, `updatedBy`, `deletedAt`, `deletedBy`, `notes`, `tags`
- Status: `status` in { `active`, `archived` }

Business Inventory Transactions:
- Same as Transactions with domain-specific fields for source/target locations.
- Prefer `occurredAt` for the real-world move date and `createdAt` for record creation.

Images/Attachments:
- Use `images` array shape listed above.

---

### Old → New Field Mapping (examples and rules)
These are common synonyms we will consolidate. Use the “New Canonical” column going forward.

| Concept | Example Current Names (any of these) | New Canonical |
|---|---|---|
| Created timestamp | `created_at`, `creationDate`, `createdOn`, `dateCreated` | `createdAt` |
| Created by | `createdByUid`, `creator`, `owner`, `userId` (when creator) | `createdBy` |
| Updated timestamp | `updated_at`, `lastUpdated`, `modifiedAt`, `updatedOn` | `updatedAt` |
| Updated by | `updatedByUid`, `modifiedBy`, `lastModifiedBy`, `editorId` | `updatedBy` |
| Deleted flag | `isDeleted`, `deleted`, `archived` | Prefer `deletedAt` (+ optional `deletedBy`). Use `status: archived` for archives, not deletions |
| Transaction date | `transactionDate`, `date`, `timestamp` (domain-specific) | `occurredAt` |
| Amount | `amount`, `amountCents`, `price`, `cost`, `total` | `money.amountMinor` (+ `currencyCode`) or domain field pointing to money |
| References | `project`, `projectRef`, `projectID` | `projectId` |
| References | `item`, `itemRef`, `itemID` | `itemId` |
| Generic date | `date`, `timestamp` | Avoid ambiguous names. Choose `createdAt`, `updatedAt`, `occurredAt`, or `effectiveAt` |

Rules of thumb:
- If the field’s meaning is "when it was inserted", it is `createdAt`.
- If the field’s meaning is "when a real-world event occurred", it is `occurredAt`.
- If both exist, keep both; never treat them as interchangeable.
- Use a single boolean only if it cannot be modeled by `status` or `deletedAt`. Prefer explicit `status` values to avoid multiple flags.

---

### Conventions and Guardrails
- **Naming**: camelCase for field names; singular noun + `Id` for references.
- **Time**: Timestamps are Firestore `Timestamp` in UTC. Convert at the UI boundary.
- **Money**: Always store in minor units with an explicit `currencyCode`.
- **Schema version**: Add `schemaVersion` to all canonical docs; increment when making breaking schema changes.
- **Soft delete**: Prefer `deletedAt` (+ optional `deletedBy`). Do not use `isDeleted` and `deletedAt` together.
- **Status**: Single `status` string per document type; avoid redundant booleans.
- **Extensibility**: Use `metadata: Record<string, unknown>` only where needed to avoid schema creep.

---

### Execution Plan (Junior Dev Playbook)
This is the step-by-step process to execute changes safely and traceably.

1) Discovery and Inventory (no code changes)
- Read `src/types/index.ts` and list all field names by domain (Transactions, Items, Projects, Business Inventory, Images).
- Search the codebase for potential synonyms. Use ripgrep (install `rg` if necessary):

```bash
rg -n --no-ignore -S "created_at|creationDate|createdOn|dateCreated|createdAt" src
rg -n --no-ignore -S "updated_at|lastUpdated|modifiedAt|updatedOn|updatedAt" src
rg -n --no-ignore -S "updatedBy|updated_by|modifiedBy|lastModifiedBy|editorId" src
rg -n --no-ignore -S "transactionDate|occurredAt|purchaseDate|date\b|timestamp\b" src
rg -n --no-ignore -S "amountCents|amountMinor|amount\b|price\b|cost\b|total\b" src
rg -n --no-ignore -S "isDeleted|deletedAt|archived|isArchived|status" src
rg -n --no-ignore -S "projectId|project\b|projectRef|projectID" src
rg -n --no-ignore -S "itemId|item\b|itemRef|itemID" src
```

- Create an inventory spreadsheet (or markdown table) with columns: `File`, `Line`, `Domain`, `Current Field`, `Intended Canonical`, `Notes`.
- Submit the inventory as a PR artifact for review before proceeding.

2) Canonicalization Spec (documentation-first)
- Draft a short spec per domain documenting the final field list for each document type using the Canonical Field Dictionary and Domain Canonicals above.
- Include explicit Old → New mapping for every field found in step 1.
- Get approval from a senior reviewer.

3) Add Schema Version and Dual-Read/Dual-Write (implementation scaffold)
- Introduce `schemaVersion` to each document type (e.g., start at `1`).
- Reading: update reads to accept both old and new fields, preferring new canonicals when present.
- Writing: update writes to produce the new canonical fields while still populating old fields (if necessary) for backward compatibility until migration completes.
- Add TODO checklists in PR description to ensure each domain has dual-read/dual-write enabled before data migration.

4) Data Migration Plan (idempotent and staged)
- Write a migration spec per collection: batches, filters, field transforms, and validation queries.
- Plan to migrate in small batches (e.g., 500–1000 docs at a time) and record progress with a resumable cursor.
- Ensure migrations are idempotent: running twice should not damage data.
- Define validation queries and spot checks (sample counts per status, date ranges, and money totals).

5) Update Firestore Rules and Indexes
- Update `firestore.rules` to authorize new fields and enforce invariants (e.g., `createdAt` server-only).
- Add or update indexes required by the new `status`/date fields or queries relying on `occurredAt`.

6) UI/Service Refactors
- Update TypeScript types in `src/types/` to reflect canonical fields only.
- Update services (e.g., `src/services/inventoryService.ts`) to read/write canonical fields and support dual-read.
- Update components/pages/hooks to consume canonical fields. Remove reliance on deprecated names.

7) Run Migration and Verify
- Execute the migration in stages, verifying after each batch.
- Monitor errors and logs; compare pre/post counts and totals.
- When all documents are migrated and verified, flip reads to use canonical fields only.

8) Cleanup and Lock Down
- Remove dual-write to deprecated fields.
- Remove dead code that references old names.
- Set a linter/check to forbid deprecated names (see Enforcement below).
- Increment `schemaVersion` and record the change in this document.

---

### Enforcement and Tooling
- **Linter rule**: Add a banned-terms rule forbidding old field names in TypeScript (e.g., custom ESLint rule or regex-based lint). The rule should fail CI when deprecated names are used.
- **Type gate**: Centralize common field types (e.g., a BaseDocument type) in `src/types/` and reuse everywhere.
- **PR template**: Include a checklist (see below) to force confirmation of dual-read/dual-write, migration coverage, and UI updates.
- **Schema doc**: Keep this plan and a minimal reference of canonical fields in `dev_docs/DATA_SCHEMA.md` synchronized.

---

### PR Checklist (paste this into PR descriptions)
- [ ] Inventory updated for this domain (files and field mappings)
- [ ] Types updated to canonical fields
- [ ] Services read both old and new fields (dual-read)
- [ ] Services write new canonical fields (dual-write)
- [ ] UI updated to consume canonical fields
- [ ] Firestore rules updated and reviewed
- [ ] Indexes added/updated (if needed)
- [ ] Migration spec prepared (idempotent, batched)
- [ ] Migration executed for this domain
- [ ] Validation checks passed
- [ ] Deprecated names removed; linter rule enforces bans

---

### Domain-by-Domain To-Do (execution sequence)

1) Transactions
- Replace any `transactionDate`/`date` with `occurredAt`.
- Keep `createdAt` for insertion time. Never treat `occurredAt` and `createdAt` as the same.
- Consolidate `amount` fields under `money.amountMinor` + `currencyCode`.
- Standardize `status` (prefer `posted`, `pending`, `void`).

2) Items
- Ensure `createdAt`, `createdBy`, `updatedAt`, `updatedBy` are present and consistent.
- Consolidate status to `active`/`archived`.
- Normalize references: `projectId` (if applicable).

3) Projects
- Ensure canonical audit fields.
- Prefer `status` = `active`/`archived`.

4) Business Inventory (items and transactions)
- Use `occurredAt` for movements; `createdAt` for record creation.
- Normalize location/source/target fields with consistent names.

5) Images/Attachments
- Use `images` array shape; drop ad-hoc fields.

---

### Validation and Acceptance Criteria
- All domains use canonical field names only in `src/types/`.
- No occurrences of deprecated names in the codebase (verified via ripgrep and linter).
- Firestore documents sampled from each collection contain expected canonical fields and `schemaVersion`.
- Dual-read removed and code reads/writes canonicals exclusively.
- All relevant UI flows function with real data after migration.

---

### Risk and Rollback
- Dual-read/dual-write allows runtime compatibility during rollout.
- Migration is idempotent and batched; failures can resume.
- Rollback path: pause writes, revert to old read path, and re-run with corrections.

---

### Maintenance
- Add any new document types to the Canonical Field Dictionary first.
- Require the PR checklist for all schema-affecting changes.
- Keep `dev_docs/DATA_SCHEMA.md` and this plan updated with each schema change (bump `schemaVersion`).


