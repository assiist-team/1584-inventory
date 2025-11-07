-- Addition script: Create correct test data
-- Run this after deletion script
-- Creates:
--   1. Business inventory transaction with 3 individual items
--   2. Project transaction with 8 individual items (1 table, 4 chairs, 3 pillows, 1 accent chair)

DO $$
DECLARE
  v_business_tx_id text := gen_random_uuid()::text;
  v_project_tx_id text := gen_random_uuid()::text;
  v_item_id text;
  v_qr text;
  v_business_item_ids text[] := ARRAY[]::text[];
  v_project_item_ids text[] := ARRAY[]::text[];
  v_business_total numeric := 0;
  v_project_total numeric := 0;
BEGIN
  -- ============================================
  -- BUSINESS INVENTORY TRANSACTION
  -- ============================================
  
  -- Item 1: Area Rug
  v_item_id := 'I-' || gen_random_uuid()::text;
  v_qr := 'QR-' || gen_random_uuid()::text;
  INSERT INTO items(
    account_id, project_id, transaction_id, item_id, name, description, sku, source,
    purchase_price, project_price, market_value, payment_method, disposition, notes,
    qr_key, bookmark, inventory_status, business_inventory_location, date_created, last_updated, images, created_by, created_at
  ) VALUES (
    '1dd4fd75-8eea-4f7a-98e7-bf45b987ae94',
    NULL, -- Business inventory
    v_business_tx_id,
    v_item_id,
    'Area Rug',
    'Neutral beige wool blend area rug, 8x10',
    'HG-RUG-8X10-001',
    'Homegoods',
    '450.00',
    '475.00',
    '500.00',
    'Client Card',
    'keep',
    'Neutral beige wool blend area rug',
    v_qr,
    false,
    'available',
    'Warehouse A - Section 2',
    current_date,
    now(),
    '[]'::jsonb,
    '4ef35958-597c-4aea-b99e-1ef62352a72d',
    now()
  );
  v_business_item_ids := v_business_item_ids || v_item_id;
  v_business_total := v_business_total + 450.00;

  -- Item 2: Sofa
  v_item_id := 'I-' || gen_random_uuid()::text;
  v_qr := 'QR-' || gen_random_uuid()::text;
  INSERT INTO items(
    account_id, project_id, transaction_id, item_id, name, description, sku, source,
    purchase_price, project_price, market_value, payment_method, disposition, notes,
    qr_key, bookmark, inventory_status, business_inventory_location, date_created, last_updated, images, created_by, created_at
  ) VALUES (
    '1dd4fd75-8eea-4f7a-98e7-bf45b987ae94',
    NULL,
    v_business_tx_id,
    v_item_id,
    'Sofa',
    'Modern sectional sofa in charcoal gray, 3-seater',
    'HG-SOFA-3SEAT-001',
    'Homegoods',
    '1200.00',
    '1300.00',
    '1400.00',
    'Client Card',
    'keep',
    'Modern sectional sofa in charcoal gray',
    v_qr,
    false,
    'available',
    'Warehouse A - Section 2',
    current_date,
    now(),
    '[]'::jsonb,
    '4ef35958-597c-4aea-b99e-1ef62352a72d',
    now()
  );
  v_business_item_ids := v_business_item_ids || v_item_id;
  v_business_total := v_business_total + 1200.00;

  -- Item 3: Coffee Table
  v_item_id := 'I-' || gen_random_uuid()::text;
  v_qr := 'QR-' || gen_random_uuid()::text;
  INSERT INTO items(
    account_id, project_id, transaction_id, item_id, name, description, sku, source,
    purchase_price, project_price, market_value, payment_method, disposition, notes,
    qr_key, bookmark, inventory_status, business_inventory_location, date_created, last_updated, images, created_by, created_at
  ) VALUES (
    '1dd4fd75-8eea-4f7a-98e7-bf45b987ae94',
    NULL,
    v_business_tx_id,
    v_item_id,
    'Coffee Table',
    'Modern glass and metal coffee table',
    'HG-TABLE-COFFEE-001',
    'Homegoods',
    '250.00',
    '265.00',
    '280.00',
    'Client Card',
    'keep',
    'Modern glass and metal coffee table',
    v_qr,
    false,
    'available',
    'Warehouse A - Section 2',
    current_date,
    now(),
    '[]'::jsonb,
    '4ef35958-597c-4aea-b99e-1ef62352a72d',
    now()
  );
  v_business_item_ids := v_business_item_ids || v_item_id;
  v_business_total := v_business_total + 250.00;

  -- Create business inventory transaction
  INSERT INTO transactions(
    account_id, project_id, transaction_id, transaction_date, source, transaction_type,
    amount, description, budget_category, status, payment_method, notes,
    item_ids, receipt_emailed, created_by, created_at, updated_at
  ) VALUES (
    '1dd4fd75-8eea-4f7a-98e7-bf45b987ae94',
    NULL, -- Business inventory has no project_id
    v_business_tx_id,
    current_date,
    'Homegoods',
    'Purchase',
    v_business_total::text,
    'Business inventory purchase from Homegoods',
    'Furnishings',
    'completed',
    'Client Card',
    'Test transaction for business inventory',
    v_business_item_ids,
    false,
    '4ef35958-597c-4aea-b99e-1ef62352a72d',
    now(),
    now()
  );

  -- ============================================
  -- PROJECT TRANSACTION
  -- ============================================

  -- Item 1: Dining Table
  v_item_id := 'I-' || gen_random_uuid()::text;
  v_qr := 'QR-' || gen_random_uuid()::text;
  INSERT INTO items(
    account_id, project_id, transaction_id, item_id, name, description, sku, source,
    purchase_price, project_price, market_value, payment_method, disposition, notes,
    qr_key, bookmark, inventory_status, business_inventory_location, date_created, last_updated, images, created_by, created_at
  ) VALUES (
    '1dd4fd75-8eea-4f7a-98e7-bf45b987ae94',
    'db6f557e-fd22-43f1-8ee1-af836d88101f', -- Test Project
    v_project_tx_id,
    v_item_id,
    'Dining Table',
    'Solid wood dining table, 72 inches, seats 6-8',
    'HG-TABLE-72-001',
    'Homegoods',
    '850.00',
    '900.00',
    '950.00',
    'Client Card',
    'keep',
    'Solid wood dining table',
    v_qr,
    false,
    'allocated',
    NULL,
    current_date,
    now(),
    '[]'::jsonb,
    '4ef35958-597c-4aea-b99e-1ef62352a72d',
    now()
  );
  v_project_item_ids := v_project_item_ids || v_item_id;
  v_project_total := v_project_total + 850.00;

  -- Item 2-5: Dining Chairs (4 individual chairs)
  -- Chair 1
  v_item_id := 'I-' || gen_random_uuid()::text;
  v_qr := 'QR-' || gen_random_uuid()::text;
  INSERT INTO items(
    account_id, project_id, transaction_id, item_id, name, description, sku, source,
    purchase_price, project_price, market_value, payment_method, disposition, notes,
    qr_key, bookmark, inventory_status, business_inventory_location, date_created, last_updated, images, created_by, created_at
  ) VALUES (
    '1dd4fd75-8eea-4f7a-98e7-bf45b987ae94',
    'db6f557e-fd22-43f1-8ee1-af836d88101f',
    v_project_tx_id,
    v_item_id,
    'Dining Chair',
    'Upholstered dining chair',
    'HG-CHAIR-DINE-001',
    'Homegoods',
    '80.00',
    '88.00',
    '95.00',
    'Client Card',
    'keep',
    'Upholstered dining chair',
    v_qr,
    false,
    'allocated',
    NULL,
    current_date,
    now(),
    '[]'::jsonb,
    '4ef35958-597c-4aea-b99e-1ef62352a72d',
    now()
  );
  v_project_item_ids := v_project_item_ids || v_item_id;
  v_project_total := v_project_total + 80.00;

  -- Chair 2
  v_item_id := 'I-' || gen_random_uuid()::text;
  v_qr := 'QR-' || gen_random_uuid()::text;
  INSERT INTO items(
    account_id, project_id, transaction_id, item_id, name, description, sku, source,
    purchase_price, project_price, market_value, payment_method, disposition, notes,
    qr_key, bookmark, inventory_status, business_inventory_location, date_created, last_updated, images, created_by, created_at
  ) VALUES (
    '1dd4fd75-8eea-4f7a-98e7-bf45b987ae94',
    'db6f557e-fd22-43f1-8ee1-af836d88101f',
    v_project_tx_id,
    v_item_id,
    'Dining Chair',
    'Upholstered dining chair',
    'HG-CHAIR-DINE-001',
    'Homegoods',
    '80.00',
    '88.00',
    '95.00',
    'Client Card',
    'keep',
    'Upholstered dining chair',
    v_qr,
    false,
    'allocated',
    NULL,
    current_date,
    now(),
    '[]'::jsonb,
    '4ef35958-597c-4aea-b99e-1ef62352a72d',
    now()
  );
  v_project_item_ids := v_project_item_ids || v_item_id;
  v_project_total := v_project_total + 80.00;

  -- Chair 3
  v_item_id := 'I-' || gen_random_uuid()::text;
  v_qr := 'QR-' || gen_random_uuid()::text;
  INSERT INTO items(
    account_id, project_id, transaction_id, item_id, name, description, sku, source,
    purchase_price, project_price, market_value, payment_method, disposition, notes,
    qr_key, bookmark, inventory_status, business_inventory_location, date_created, last_updated, images, created_by, created_at
  ) VALUES (
    '1dd4fd75-8eea-4f7a-98e7-bf45b987ae94',
    'db6f557e-fd22-43f1-8ee1-af836d88101f',
    v_project_tx_id,
    v_item_id,
    'Dining Chair',
    'Upholstered dining chair',
    'HG-CHAIR-DINE-001',
    'Homegoods',
    '80.00',
    '88.00',
    '95.00',
    'Client Card',
    'keep',
    'Upholstered dining chair',
    v_qr,
    false,
    'allocated',
    NULL,
    current_date,
    now(),
    '[]'::jsonb,
    '4ef35958-597c-4aea-b99e-1ef62352a72d',
    now()
  );
  v_project_item_ids := v_project_item_ids || v_item_id;
  v_project_total := v_project_total + 80.00;

  -- Chair 4
  v_item_id := 'I-' || gen_random_uuid()::text;
  v_qr := 'QR-' || gen_random_uuid()::text;
  INSERT INTO items(
    account_id, project_id, transaction_id, item_id, name, description, sku, source,
    purchase_price, project_price, market_value, payment_method, disposition, notes,
    qr_key, bookmark, inventory_status, business_inventory_location, date_created, last_updated, images, created_by, created_at
  ) VALUES (
    '1dd4fd75-8eea-4f7a-98e7-bf45b987ae94',
    'db6f557e-fd22-43f1-8ee1-af836d88101f',
    v_project_tx_id,
    v_item_id,
    'Dining Chair',
    'Upholstered dining chair',
    'HG-CHAIR-DINE-001',
    'Homegoods',
    '80.00',
    '88.00',
    '95.00',
    'Client Card',
    'keep',
    'Upholstered dining chair',
    v_qr,
    false,
    'allocated',
    NULL,
    current_date,
    now(),
    '[]'::jsonb,
    '4ef35958-597c-4aea-b99e-1ef62352a72d',
    now()
  );
  v_project_item_ids := v_project_item_ids || v_item_id;
  v_project_total := v_project_total + 80.00;

  -- Item 6-8: Throw Pillows (3 individual pillows)
  -- Pillow 1
  v_item_id := 'I-' || gen_random_uuid()::text;
  v_qr := 'QR-' || gen_random_uuid()::text;
  INSERT INTO items(
    account_id, project_id, transaction_id, item_id, name, description, sku, source,
    purchase_price, project_price, market_value, payment_method, disposition, notes,
    qr_key, bookmark, inventory_status, business_inventory_location, date_created, last_updated, images, created_by, created_at
  ) VALUES (
    '1dd4fd75-8eea-4f7a-98e7-bf45b987ae94',
    'db6f557e-fd22-43f1-8ee1-af836d88101f',
    v_project_tx_id,
    v_item_id,
    'Throw Pillow',
    'Decorative throw pillow',
    'HG-PILLOW-001',
    'Homegoods',
    '25.00',
    '26.00',
    '28.00',
    'Client Card',
    'keep',
    'Decorative throw pillow',
    v_qr,
    false,
    'allocated',
    NULL,
    current_date,
    now(),
    '[]'::jsonb,
    '4ef35958-597c-4aea-b99e-1ef62352a72d',
    now()
  );
  v_project_item_ids := v_project_item_ids || v_item_id;
  v_project_total := v_project_total + 25.00;

  -- Pillow 2
  v_item_id := 'I-' || gen_random_uuid()::text;
  v_qr := 'QR-' || gen_random_uuid()::text;
  INSERT INTO items(
    account_id, project_id, transaction_id, item_id, name, description, sku, source,
    purchase_price, project_price, market_value, payment_method, disposition, notes,
    qr_key, bookmark, inventory_status, business_inventory_location, date_created, last_updated, images, created_by, created_at
  ) VALUES (
    '1dd4fd75-8eea-4f7a-98e7-bf45b987ae94',
    'db6f557e-fd22-43f1-8ee1-af836d88101f',
    v_project_tx_id,
    v_item_id,
    'Throw Pillow',
    'Decorative throw pillow',
    'HG-PILLOW-001',
    'Homegoods',
    '25.00',
    '26.00',
    '28.00',
    'Client Card',
    'keep',
    'Decorative throw pillow',
    v_qr,
    false,
    'allocated',
    NULL,
    current_date,
    now(),
    '[]'::jsonb,
    '4ef35958-597c-4aea-b99e-1ef62352a72d',
    now()
  );
  v_project_item_ids := v_project_item_ids || v_item_id;
  v_project_total := v_project_total + 25.00;

  -- Pillow 3
  v_item_id := 'I-' || gen_random_uuid()::text;
  v_qr := 'QR-' || gen_random_uuid()::text;
  INSERT INTO items(
    account_id, project_id, transaction_id, item_id, name, description, sku, source,
    purchase_price, project_price, market_value, payment_method, disposition, notes,
    qr_key, bookmark, inventory_status, business_inventory_location, date_created, last_updated, images, created_by, created_at
  ) VALUES (
    '1dd4fd75-8eea-4f7a-98e7-bf45b987ae94',
    'db6f557e-fd22-43f1-8ee1-af836d88101f',
    v_project_tx_id,
    v_item_id,
    'Throw Pillow',
    'Decorative throw pillow',
    'HG-PILLOW-001',
    'Homegoods',
    '25.00',
    '26.00',
    '28.00',
    'Client Card',
    'keep',
    'Decorative throw pillow',
    v_qr,
    false,
    'allocated',
    NULL,
    current_date,
    now(),
    '[]'::jsonb,
    '4ef35958-597c-4aea-b99e-1ef62352a72d',
    now()
  );
  v_project_item_ids := v_project_item_ids || v_item_id;
  v_project_total := v_project_total + 25.00;

  -- Item 9: Accent Chair
  v_item_id := 'I-' || gen_random_uuid()::text;
  v_qr := 'QR-' || gen_random_uuid()::text;
  INSERT INTO items(
    account_id, project_id, transaction_id, item_id, name, description, sku, source,
    purchase_price, project_price, market_value, payment_method, disposition, notes,
    qr_key, bookmark, inventory_status, business_inventory_location, date_created, last_updated, images, created_by, created_at
  ) VALUES (
    '1dd4fd75-8eea-4f7a-98e7-bf45b987ae94',
    'db6f557e-fd22-43f1-8ee1-af836d88101f',
    v_project_tx_id,
    v_item_id,
    'Accent Chair',
    'Velvet accent chair in navy blue',
    'HG-CHAIR-ACCENT-001',
    'Homegoods',
    '280.00',
    '300.00',
    '320.00',
    'Client Card',
    'keep',
    'Velvet accent chair in navy blue',
    v_qr,
    false,
    'allocated',
    NULL,
    current_date,
    now(),
    '[]'::jsonb,
    '4ef35958-597c-4aea-b99e-1ef62352a72d',
    now()
  );
  v_project_item_ids := v_project_item_ids || v_item_id;
  v_project_total := v_project_total + 280.00;

  -- Create project transaction
  INSERT INTO transactions(
    account_id, project_id, transaction_id, transaction_date, source, transaction_type,
    amount, description, budget_category, status, payment_method, notes,
    item_ids, receipt_emailed, created_by, created_at, updated_at
  ) VALUES (
    '1dd4fd75-8eea-4f7a-98e7-bf45b987ae94',
    'db6f557e-fd22-43f1-8ee1-af836d88101f', -- Test Project
    v_project_tx_id,
    current_date,
    'Homegoods',
    'Purchase',
    v_project_total::text,
    'Project furnishings purchase from Homegoods',
    'Furnishings',
    'completed',
    'Client Card',
    'Test transaction for project items',
    v_project_item_ids,
    false,
    '4ef35958-597c-4aea-b99e-1ef62352a72d',
    now(),
    now()
  );

  RAISE NOTICE 'Business Inventory Transaction: % with % items (Total: $%)', v_business_tx_id, array_length(v_business_item_ids, 1), v_business_total;
  RAISE NOTICE 'Project Transaction: % with % items (Total: $%)', v_project_tx_id, array_length(v_project_item_ids, 1), v_project_total;
END;
$$ LANGUAGE plpgsql;

