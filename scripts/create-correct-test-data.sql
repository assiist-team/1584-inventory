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
  tax_rate_pct numeric := 0.10; -- 10% tax rate
  v_business_tax numeric := 0;
  v_business_final numeric := 0;
  v_project_tax numeric := 0;
  v_project_final numeric := 0;
  -- per-item temp variables
  v_raw_purchase numeric;
  v_raw_project numeric;
  v_raw_market numeric;
  v_purchase numeric;
  v_project_price numeric;
  v_market numeric;
  -- per-item tax removed; tax is handled at transaction level
BEGIN
  -- ============================================
  -- BUSINESS INVENTORY TRANSACTION
  -- ============================================
  
  -- Item 1: Area Rug
  v_item_id := 'I-' || gen_random_uuid()::text;
  v_qr := 'QR-' || gen_random_uuid()::text;
  -- normalize prices and compute tax for Area Rug
  v_raw_purchase := 450.00;
  v_raw_project := 475.00;
  v_raw_market := 500.00;
  v_purchase := LEAST(v_raw_purchase, v_raw_project, v_raw_market);
  v_market := GREATEST(v_raw_purchase, v_raw_project, v_raw_market);
  v_project_price := v_raw_purchase + v_raw_project + v_raw_market - v_purchase - v_market;
  -- per-item tax calculation removed (transaction-level tax)
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
    v_purchase::text,
    v_project_price::text,
    v_market::text,
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
  v_business_total := v_business_total + v_purchase;

  -- Item 2: Sofa
  v_item_id := 'I-' || gen_random_uuid()::text;
  v_qr := 'QR-' || gen_random_uuid()::text;
  -- normalize prices and compute tax for Sofa
  v_raw_purchase := 1200.00;
  v_raw_project := 1300.00;
  v_raw_market := 1400.00;
  v_purchase := LEAST(v_raw_purchase, v_raw_project, v_raw_market);
  v_market := GREATEST(v_raw_purchase, v_raw_project, v_raw_market);
  v_project_price := v_raw_purchase + v_raw_project + v_raw_market - v_purchase - v_market;
  -- per-item tax calculation removed (transaction-level tax)
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
    v_purchase::text,
    v_project_price::text,
    v_market::text,
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
  v_business_total := v_business_total + v_purchase;

  -- Item 3: Coffee Table
  v_item_id := 'I-' || gen_random_uuid()::text;
  v_qr := 'QR-' || gen_random_uuid()::text;
  -- normalize prices and compute tax for Coffee Table
  v_raw_purchase := 250.00;
  v_raw_project := 265.00;
  v_raw_market := 280.00;
  v_purchase := LEAST(v_raw_purchase, v_raw_project, v_raw_market);
  v_market := GREATEST(v_raw_purchase, v_raw_project, v_raw_market);
  v_project_price := v_raw_purchase + v_raw_project + v_raw_market - v_purchase - v_market;
  -- per-item tax calculation removed (transaction-level tax)
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
    v_purchase::text,
    v_project_price::text,
    v_market::text,
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
  v_business_total := v_business_total + v_purchase;

  -- Create business inventory transaction
  -- compute tax and final amount for business transaction
  v_business_tax := round(v_business_total * tax_rate_pct, 2);
  v_business_final := v_business_total + v_business_tax;

  INSERT INTO transactions(
    account_id, project_id, transaction_id, transaction_date, source, transaction_type,
    amount, description, budget_category, status, payment_method, notes,
    tax_rate_pct, subtotal, item_ids, receipt_emailed, created_by, created_at, updated_at
  ) VALUES (
    '1dd4fd75-8eea-4f7a-98e7-bf45b987ae94',
    NULL, -- Business inventory has no project_id
    v_business_tx_id,
    current_date,
    'Homegoods',
    'Purchase',
    v_business_final::text,
    'Business inventory purchase from Homegoods',
    'Furnishings',
    'completed',
    'Client Card',
    'Test transaction for business inventory',
    tax_rate_pct,
    v_business_total::text,
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
  -- normalize prices and compute tax for Dining Table
  v_raw_purchase := 850.00;
  v_raw_project := 900.00;
  v_raw_market := 950.00;
  v_purchase := LEAST(v_raw_purchase, v_raw_project, v_raw_market);
  v_market := GREATEST(v_raw_purchase, v_raw_project, v_raw_market);
  v_project_price := v_raw_purchase + v_raw_project + v_raw_market - v_purchase - v_market;
  -- per-item tax calculation removed (transaction-level tax)
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
    v_purchase::text,
    v_project_price::text,
    v_market::text,
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
  v_project_total := v_project_total + v_purchase;

  -- Item 2-5: Dining Chairs (4 individual chairs)
  -- Chair 1
  v_item_id := 'I-' || gen_random_uuid()::text;
  v_qr := 'QR-' || gen_random_uuid()::text;
  -- normalize prices and compute tax for Dining Chair
  v_raw_purchase := 80.00;
  v_raw_project := 88.00;
  v_raw_market := 95.00;
  v_purchase := LEAST(v_raw_purchase, v_raw_project, v_raw_market);
  v_market := GREATEST(v_raw_purchase, v_raw_project, v_raw_market);
  v_project_price := v_raw_purchase + v_raw_project + v_raw_market - v_purchase - v_market;
  -- per-item tax calculation removed (transaction-level tax)
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
    v_purchase::text,
    v_project_price::text,
    v_market::text,
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
  v_project_total := v_project_total + v_purchase;

  -- Chair 2
  v_item_id := 'I-' || gen_random_uuid()::text;
  v_qr := 'QR-' || gen_random_uuid()::text;
  -- normalize prices and compute tax for Dining Chair
  v_raw_purchase := 80.00;
  v_raw_project := 88.00;
  v_raw_market := 95.00;
  v_purchase := LEAST(v_raw_purchase, v_raw_project, v_raw_market);
  v_market := GREATEST(v_raw_purchase, v_raw_project, v_raw_market);
  v_project_price := v_raw_purchase + v_raw_project + v_raw_market - v_purchase - v_market;
  -- per-item tax calculation removed (transaction-level tax)
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
    v_purchase::text,
    v_project_price::text,
    v_market::text,
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
  v_project_total := v_project_total + v_purchase;

  -- Chair 3
  v_item_id := 'I-' || gen_random_uuid()::text;
  v_qr := 'QR-' || gen_random_uuid()::text;
  -- normalize prices and compute tax for Dining Chair
  v_raw_purchase := 80.00;
  v_raw_project := 88.00;
  v_raw_market := 95.00;
  v_purchase := LEAST(v_raw_purchase, v_raw_project, v_raw_market);
  v_market := GREATEST(v_raw_purchase, v_raw_project, v_raw_market);
  v_project_price := v_raw_purchase + v_raw_project + v_raw_market - v_purchase - v_market;
  -- per-item tax calculation removed (transaction-level tax)
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
    v_purchase::text,
    v_project_price::text,
    v_market::text,
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
  v_project_total := v_project_total + v_purchase;

  -- Chair 4
  v_item_id := 'I-' || gen_random_uuid()::text;
  v_qr := 'QR-' || gen_random_uuid()::text;
  -- normalize prices and compute tax for Dining Chair
  v_raw_purchase := 80.00;
  v_raw_project := 88.00;
  v_raw_market := 95.00;
  v_purchase := LEAST(v_raw_purchase, v_raw_project, v_raw_market);
  v_market := GREATEST(v_raw_purchase, v_raw_project, v_raw_market);
  v_project_price := v_raw_purchase + v_raw_project + v_raw_market - v_purchase - v_market;
  -- per-item tax calculation removed (transaction-level tax)
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
    v_purchase::text,
    v_project_price::text,
    v_market::text,
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
  v_project_total := v_project_total + v_purchase;

  -- Item 6-8: Throw Pillows (3 individual pillows)
  -- Pillow 1
  v_item_id := 'I-' || gen_random_uuid()::text;
  v_qr := 'QR-' || gen_random_uuid()::text;
  -- normalize prices and compute tax for Throw Pillow
  v_raw_purchase := 25.00;
  v_raw_project := 26.00;
  v_raw_market := 28.00;
  v_purchase := LEAST(v_raw_purchase, v_raw_project, v_raw_market);
  v_market := GREATEST(v_raw_purchase, v_raw_project, v_raw_market);
  v_project_price := v_raw_purchase + v_raw_project + v_raw_market - v_purchase - v_market;
  -- per-item tax calculation removed (transaction-level tax)
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
    v_purchase::text,
    v_project_price::text,
    v_market::text,
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
  v_project_total := v_project_total + v_purchase;

  -- Pillow 2
  v_item_id := 'I-' || gen_random_uuid()::text;
  v_qr := 'QR-' || gen_random_uuid()::text;
  -- normalize prices and compute tax for Throw Pillow
  v_raw_purchase := 25.00;
  v_raw_project := 26.00;
  v_raw_market := 28.00;
  v_purchase := LEAST(v_raw_purchase, v_raw_project, v_raw_market);
  v_market := GREATEST(v_raw_purchase, v_raw_project, v_raw_market);
  v_project_price := v_raw_purchase + v_raw_project + v_raw_market - v_purchase - v_market;
  -- per-item tax calculation removed (transaction-level tax)
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
    v_purchase::text,
    v_project_price::text,
    v_market::text,
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
  v_project_total := v_project_total + v_purchase;

  -- Pillow 3
  v_item_id := 'I-' || gen_random_uuid()::text;
  v_qr := 'QR-' || gen_random_uuid()::text;
  -- normalize prices and compute tax for Throw Pillow
  v_raw_purchase := 25.00;
  v_raw_project := 26.00;
  v_raw_market := 28.00;
  v_purchase := LEAST(v_raw_purchase, v_raw_project, v_raw_market);
  v_market := GREATEST(v_raw_purchase, v_raw_project, v_raw_market);
  v_project_price := v_raw_purchase + v_raw_project + v_raw_market - v_purchase - v_market;
  -- per-item tax calculation removed (transaction-level tax)
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
    v_purchase::text,
    v_project_price::text,
    v_market::text,
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
  v_project_total := v_project_total + v_purchase;

  -- Item 9: Accent Chair
  v_item_id := 'I-' || gen_random_uuid()::text;
  v_qr := 'QR-' || gen_random_uuid()::text;
  -- normalize prices and compute tax for Accent Chair
  v_raw_purchase := 280.00;
  v_raw_project := 300.00;
  v_raw_market := 320.00;
  v_purchase := LEAST(v_raw_purchase, v_raw_project, v_raw_market);
  v_market := GREATEST(v_raw_purchase, v_raw_project, v_raw_market);
  v_project_price := v_raw_purchase + v_raw_project + v_raw_market - v_purchase - v_market;
  -- per-item tax calculation removed (transaction-level tax)
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
    v_purchase::text,
    v_project_price::text,
    v_market::text,
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
  v_project_total := v_project_total + v_purchase;

  -- Create project transaction
  -- compute tax and final amount for project transaction
  v_project_tax := round(v_project_total * tax_rate_pct, 2);
  v_project_final := v_project_total + v_project_tax;

  INSERT INTO transactions(
    account_id, project_id, transaction_id, transaction_date, source, transaction_type,
    amount, description, budget_category, status, payment_method, notes,
    tax_rate_pct, subtotal, item_ids, receipt_emailed, created_by, created_at, updated_at
  ) VALUES (
    '1dd4fd75-8eea-4f7a-98e7-bf45b987ae94',
    'db6f557e-fd22-43f1-8ee1-af836d88101f', -- Test Project
    v_project_tx_id,
    current_date,
    'Homegoods',
    'Purchase',
    v_project_final::text,
    'Project furnishings purchase from Homegoods',
    'Furnishings',
    'completed',
    'Client Card',
    'Test transaction for project items',
    tax_rate_pct,
    v_project_total::text,
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

