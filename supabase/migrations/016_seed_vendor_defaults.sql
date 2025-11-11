-- Seed vendor_defaults with first 10 entries from TRANSACTION_SOURCES
-- This migration populates vendor_defaults for all existing accounts
-- The first 10 vendors are: Homegoods, Amazon, Wayfair, Target, Ross, Arhaus, Pottery Barn, Crate & Barrel, West Elm, Living Spaces

DO $$
DECLARE
  account_record RECORD;
  initial_slots JSONB;
BEGIN
  -- Define the first 10 vendors from TRANSACTION_SOURCES constant (store as plain strings)
  initial_slots := jsonb_build_array(
    'Homegoods',
    'Amazon',
    'Wayfair',
    'Target',
    'Ross',
    'Arhaus',
    'Pottery Barn',
    'Crate & Barrel',
    'West Elm',
    'Living Spaces'
  );

  -- Loop through all accounts and seed vendor_defaults if they don't exist
  FOR account_record IN SELECT id FROM accounts
  LOOP
    -- Only insert if vendor_defaults doesn't already exist for this account
    INSERT INTO vendor_defaults (account_id, slots, updated_at)
    SELECT account_record.id, initial_slots, NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM vendor_defaults WHERE account_id = account_record.id
    );
  END LOOP;
END $$;

