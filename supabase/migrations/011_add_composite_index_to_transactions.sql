
-- Add a composite index on account_id and project_id for faster lookups
CREATE INDEX idx_transactions_account_id_project_id ON transactions(account_id, project_id);
