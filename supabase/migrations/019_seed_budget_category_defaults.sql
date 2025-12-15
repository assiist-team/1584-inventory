-- Seed budget_categories with default categories for all existing accounts
-- This migration populates sensible default budget categories for each account
-- based on the legacy BudgetCategory enum values.
-- Categories are only created if the account doesn't already have any categories.

DO $$
DECLARE
  account_record RECORD;
  category_name TEXT;
  category_slug TEXT;
  category_names TEXT[] := ARRAY[
    'Design Fee',
    'Furnishings',
    'Property Management',
    'Kitchen',
    'Install',
    'Storage & Receiving',
    'Fuel'
  ];
  category_slugs TEXT[] := ARRAY[
    'design-fee',
    'furnishings',
    'property-management',
    'kitchen',
    'install',
    'storage-receiving',
    'fuel'
  ];
  category_count INTEGER;
BEGIN
  -- Loop through all accounts
  FOR account_record IN SELECT id FROM accounts
  LOOP
    -- Check if account already has any budget categories
    SELECT COUNT(*) INTO category_count
    FROM budget_categories
    WHERE account_id = account_record.id;

    -- Only seed defaults if account has no categories
    IF category_count = 0 THEN
      -- Insert default categories for this account
      FOR i IN 1..array_length(category_names, 1)
      LOOP
        category_name := category_names[i];
        category_slug := category_slugs[i];

        -- Insert category (ignore if slug already exists due to unique constraint)
        INSERT INTO budget_categories (account_id, name, slug, is_archived, created_at, updated_at)
        VALUES (
          account_record.id,
          category_name,
          category_slug,
          FALSE,
          NOW(),
          NOW()
        )
        ON CONFLICT (account_id, slug) DO NOTHING;
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- Add comment
COMMENT ON TABLE budget_categories IS 'Stores account-scoped budget categories for transactions. Default categories are seeded for new accounts via migration 019.';

