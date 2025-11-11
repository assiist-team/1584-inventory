BEGIN;

-- Remove audit_logs from the realtime publication if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'audit_logs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.audit_logs';
  END IF;
END $$;

-- Drop the old table (destructive)
DROP TABLE IF EXISTS public.audit_logs;

-- Create the new table with the intended schema
CREATE TABLE public.item_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('allocation', 'deallocation', 'return')),
  item_id TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  transaction_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_item_audit_logs_account_id ON public.item_audit_logs(account_id);
CREATE INDEX idx_item_audit_logs_item_id ON public.item_audit_logs(item_id);
CREATE INDEX idx_item_audit_logs_timestamp ON public.item_audit_logs(timestamp DESC);

-- RLS and policies
ALTER TABLE public.item_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read item audit logs in their account or owners can read all"
  ON public.item_audit_logs FOR SELECT
  USING (can_access_account(account_id) OR is_system_owner());

CREATE POLICY "Users can create item audit logs in their account or owners can create any"
  ON public.item_audit_logs FOR INSERT
  WITH CHECK (can_access_account(account_id) OR is_system_owner());

-- Add to realtime publication if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.item_audit_logs';
  END IF;
END $$;

COMMIT;


