-- Add default_category_id foreign key column to projects table
-- This column references budget_categories and allows projects to have
-- a default budget category that can be used for new transactions.
-- The column is nullable to allow projects without a default category.

-- Verify prerequisite tables exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'budget_categories'
  ) THEN
    RAISE EXCEPTION 'Prerequisite migration missing: budget_categories table not found. Run 017_create_budget_categories.sql before running 019_add_project_default_category_id.sql';
  END IF;
END
$$;

-- Add default_category_id column as nullable foreign key
ALTER TABLE projects
  ADD COLUMN default_category_id UUID REFERENCES budget_categories(id) ON DELETE SET NULL;

-- Create index for efficient lookups and joins
CREATE INDEX idx_projects_default_category_id ON projects(default_category_id);
CREATE INDEX idx_projects_account_default_category ON projects(account_id, default_category_id);

-- Add constraint to ensure default_category_id belongs to the same account as the project
-- This prevents cross-account category assignment
CREATE OR REPLACE FUNCTION check_project_category_account_match()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.default_category_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM budget_categories
      WHERE id = NEW.default_category_id
      AND account_id = NEW.account_id
    ) THEN
      RAISE EXCEPTION 'default_category_id must belong to the same account as the project';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_project_category_account_match
  BEFORE INSERT OR UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION check_project_category_account_match();

-- Add comment
COMMENT ON COLUMN projects.default_category_id IS 'Foreign key to budget_categories table. Optional default category for this project. Must belong to the same account as the project.';

