-- Add needs_review flag to transactions
-- Migration intentionally only adds the column and an index.
-- The flag is expected to be maintained dynamically by application code.

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT false;

-- Optional index to speed up queries and filters by this flag
CREATE INDEX IF NOT EXISTS idx_transactions_needs_review ON transactions (needs_review);

-- NOTE: This migration intentionally does NOT add a DB helper function or
-- execute a backfill. The `needs_review` column is intended to be maintained
-- dynamically by application code so it always reflects the current state of
-- a transaction (items, lineage, subtotal/tax).
--
-- Recommended approach (application-driven, authoritative):
-- - Keep the canonical completeness logic in `getTransactionCompleteness`.
-- - After any mutation that could affect completeness (items added/removed/moved,
--   transaction amount changes, lineage updates), compute the boolean using the
--   canonical codepath and write the resulting `needs_review` value into the
--   `transactions` row as part of the same application flow.
-- - This avoids duplicating complex logic in the DB and keeps the single source
--   of truth in application code while allowing the UI to read an inexpensive
--   boolean from the transaction payload for list rendering.
--
-- Optional: If you prefer a separate backfill for historical rows, implement
-- a small Node script that iterates transactions and writes `needs_review`
-- using the application's completeness routine. Do NOT run that backfill as
-- part of a blocking migration for large datasets.


