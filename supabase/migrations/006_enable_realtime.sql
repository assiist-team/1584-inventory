-- Enable Realtime for tables that need real-time updates
-- This allows Supabase Realtime to listen to changes on these tables

-- Ensure the supabase_realtime publication exists
-- (It should already exist, but this ensures it's there)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Add tables to the publication for realtime subscriptions
-- These commands will error if tables are already added, which is fine
-- You can safely ignore "already exists" errors

ALTER PUBLICATION supabase_realtime ADD TABLE projects;
ALTER PUBLICATION supabase_realtime ADD TABLE items;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;

-- Optional: Add account_members if you want real-time updates for account membership changes
-- ALTER PUBLICATION supabase_realtime ADD TABLE account_members;

