-- Add columns for tracking previous project transaction linkage on inventory items
alter table public.items
  add column if not exists previous_project_transaction_id text null;

alter table public.items
  add column if not exists previous_project_id text null;

-- Supporting indexes for faster lookups when restoring transactions
create index if not exists idx_items_previous_project_transaction_id
  on public.items(previous_project_transaction_id);

create index if not exists idx_items_previous_project_id
  on public.items(previous_project_id);


