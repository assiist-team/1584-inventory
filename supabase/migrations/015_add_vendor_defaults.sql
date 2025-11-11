-- Add vendor_defaults table for storing the top 10 configurable vendor/source slots
-- This table stores exactly 10 slots (indexed 1-10) per account
-- Each slot can contain a vendor name (string) or be null/empty
-- Verify prerequisite RLS helper function exists. Fail early with a clear message if it does not.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'can_access_account'
  ) THEN
    RAISE EXCEPTION 'Prerequisite migration missing: required RLS helper function can_access_account(uuid) not found. Run earlier RLS migrations (e.g. 009/002) before running 015_add_vendor_defaults.sql';
  END IF;
END
$$;

CREATE TABLE vendor_defaults (
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  slots JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_array_length(slots) = 10),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  PRIMARY KEY (account_id)
);

CREATE INDEX idx_vendor_defaults_account_id ON vendor_defaults(account_id);

-- Enable RLS
ALTER TABLE vendor_defaults ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only account admins can read and update vendor defaults
-- RLS Policies: match existing pattern (can_access_account OR is_system_owner)
CREATE POLICY "Users can read vendor defaults in their account or owners can read all"
  ON vendor_defaults FOR SELECT
  USING (can_access_account(account_id) OR is_system_owner());

CREATE POLICY "Users can create vendor defaults in their account or owners can create any"
  ON vendor_defaults FOR INSERT
  WITH CHECK (can_access_account(account_id) OR is_system_owner());

CREATE POLICY "Users can update vendor defaults in their account or owners can update any"
  ON vendor_defaults FOR UPDATE
  USING (can_access_account(account_id) OR is_system_owner())
  WITH CHECK (can_access_account(account_id) OR is_system_owner());

-- Add comment
COMMENT ON TABLE vendor_defaults IS 'Stores exactly 10 configurable vendor/source slots per account for transaction forms';
COMMENT ON COLUMN vendor_defaults.slots IS 'JSONB array of exactly 10 strings (vendor names) or null values';

