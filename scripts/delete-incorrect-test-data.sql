-- Deletion script: Delete ALL transactions and items for the Test Project
-- Run this first to clean up all test data for the project

DO $$
DECLARE
  v_deleted_items_count int;
  v_deleted_transactions_count int;
BEGIN
  -- Delete all items for the test project
  DELETE FROM items
  WHERE account_id = '1dd4fd75-8eea-4f7a-98e7-bf45b987ae94'
    AND project_id = 'db6f557e-fd22-43f1-8ee1-af836d88101f';
  
  GET DIAGNOSTICS v_deleted_items_count = ROW_COUNT;
  
  -- Delete all transactions for the test project
  DELETE FROM transactions
  WHERE account_id = '1dd4fd75-8eea-4f7a-98e7-bf45b987ae94'
    AND project_id = 'db6f557e-fd22-43f1-8ee1-af836d88101f';
  
  GET DIAGNOSTICS v_deleted_transactions_count = ROW_COUNT;
  
  RAISE NOTICE 'Deleted % transactions and % items for Test Project', v_deleted_transactions_count, v_deleted_items_count;
END;
$$ LANGUAGE plpgsql;

