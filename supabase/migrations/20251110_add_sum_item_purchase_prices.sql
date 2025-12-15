-- Migration: add sum_item_purchase_prices column to transactions
-- Adds a persisted numeric column to store the sum of purchase prices for items linked to the transaction
alter table public.transactions
  add column if not exists sum_item_purchase_prices numeric(12,2) not null default 0;

create index if not exists idx_transactions_sum_item_purchase_prices
  on public.transactions (sum_item_purchase_prices);

-- End of migration

