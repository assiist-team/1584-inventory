-- Add item lineage tracking columns to items table
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS origin_transaction_id TEXT NULL;

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS latest_transaction_id TEXT NULL;

-- Create indexes for lineage columns
CREATE INDEX IF NOT EXISTS idx_items_origin_transaction_id
  ON public.items(origin_transaction_id);

CREATE INDEX IF NOT EXISTS idx_items_latest_transaction_id
  ON public.items(latest_transaction_id);

-- Create item_lineage_edges table for append-only lineage tracking
CREATE TABLE IF NOT EXISTS public.item_lineage_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  item_id TEXT NOT NULL,
  from_transaction_id TEXT NULL,  -- null == from inventory
  to_transaction_id TEXT NULL,     -- null == to inventory
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES users(id),
  note TEXT NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_item_lineage_edges_item_id
  ON public.item_lineage_edges(item_id);

CREATE INDEX IF NOT EXISTS idx_item_lineage_edges_from_transaction_id
  ON public.item_lineage_edges(from_transaction_id);

CREATE INDEX IF NOT EXISTS idx_item_lineage_edges_to_transaction_id
  ON public.item_lineage_edges(to_transaction_id);

CREATE INDEX IF NOT EXISTS idx_item_lineage_edges_created_at
  ON public.item_lineage_edges(created_at);

CREATE INDEX IF NOT EXISTS idx_item_lineage_edges_account_item_created
  ON public.item_lineage_edges(account_id, item_id, created_at);

-- Add RLS policies for item_lineage_edges (mirror items/transactions policies)
-- Allow SELECT for account members
CREATE POLICY "item_lineage_edges_select_policy"
  ON public.item_lineage_edges
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = item_lineage_edges.account_id
      AND is_account_member(accounts.id)
    )
  );

-- Allow INSERT for account members
CREATE POLICY "item_lineage_edges_insert_policy"
  ON public.item_lineage_edges
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = item_lineage_edges.account_id
      AND is_account_member(accounts.id)
    )
  );

-- Add item_lineage_edges to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE item_lineage_edges;

