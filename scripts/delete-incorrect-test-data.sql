-- Deletion script: Delete ALL transactions and items for the Test Project
-- Run this first to clean up all test data for the project

DO $$
DECLARE
  v_deleted_items_count int;
  v_deleted_transactions_count int;
  v_deleted_item_audit_logs_count int;
  v_deleted_transaction_audit_logs_count int;
BEGIN
  -- Delete all items for the test account
  DELETE FROM items
  WHERE account_id = '2d612868-852e-4a80-9d02-9d10383898d4';
  GET DIAGNOSTICS v_deleted_items_count = ROW_COUNT;

  -- Delete all transactions for the test account
  DELETE FROM transactions
  WHERE account_id = '2d612868-852e-4a80-9d02-9d10383898d4';
  GET DIAGNOSTICS v_deleted_transactions_count = ROW_COUNT;

  -- Delete audit logs for the test account (if table exists)
  DELETE FROM item_audit_logs
  WHERE account_id = '2d612868-852e-4a80-9d02-9d10383898d4';
  GET DIAGNOSTICS v_deleted_item_audit_logs_count = ROW_COUNT;

  -- Delete transaction audit logs for the test account (if table exists)
  DELETE FROM transaction_audit_logs
  WHERE account_id = '2d612868-852e-4a80-9d02-9d10383898d4';
  GET DIAGNOSTICS v_deleted_transaction_audit_logs_count = ROW_COUNT;

  RAISE NOTICE 'Deleted % transactions, % items, % item_audit_logs, % transaction_audit_logs for Test Account', v_deleted_transactions_count, v_deleted_items_count, v_deleted_item_audit_logs_count, v_deleted_transaction_audit_logs_count;
END;
$$ LANGUAGE plpgsql;

