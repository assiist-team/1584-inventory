-- 014_enable_item_lineage_rls.sql
-- Enable Row Level Security and create explicit policies for item_lineage_edges
-- This migration assumes helper functions `can_access_account(account_id)` and
-- `is_system_owner()` already exist (defined in earlier RLS migrations).

BEGIN;

-- Enable RLS on the table
ALTER TABLE public.item_lineage_edges ENABLE ROW LEVEL SECURITY;

-- Remove any existing policies to ensure idempotency
DROP POLICY IF EXISTS "item_lineage_edges_select_policy" ON public.item_lineage_edges;
DROP POLICY IF EXISTS "item_lineage_edges_insert_policy" ON public.item_lineage_edges;
DROP POLICY IF EXISTS "Owners can modify or remove edges" ON public.item_lineage_edges;

-- Allow account members (or system owners) to SELECT edges for their account
CREATE POLICY "Users can read item_lineage_edges in their account or owners"
  ON public.item_lineage_edges FOR SELECT
  USING (can_access_account(account_id) OR is_system_owner());

-- Allow account members (or system owners) to INSERT new edges (append-only)
CREATE POLICY "Users can create item_lineage_edges in their account or owners"
  ON public.item_lineage_edges FOR INSERT
  WITH CHECK (can_access_account(account_id) OR is_system_owner());

-- Restrict UPDATE and DELETE to system owners only (keeps table effectively append-only)
CREATE POLICY "Owners can update edges"
  ON public.item_lineage_edges FOR UPDATE
  USING (is_system_owner())
  WITH CHECK (is_system_owner());

CREATE POLICY "Owners can delete edges"
  ON public.item_lineage_edges FOR DELETE
  USING (is_system_owner());

-- Ensure realtime publication includes the table (no-op if already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'item_lineage_edges'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.item_lineage_edges';
  END IF;
END
$$;

COMMIT;


