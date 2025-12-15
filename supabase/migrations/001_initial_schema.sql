-- Initial database schema migration for Firebase to Supabase migration
-- This migration creates all tables needed to replace Firestore collections

-- Enable UUID extension
-- Use pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users table (no dependencies)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role TEXT CHECK (role IN ('owner', 'admin', 'designer', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- 2. Accounts table (depends on users)
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_accounts_created_by ON accounts(created_by);

-- 3. Account members table (depends on accounts and users)
CREATE TABLE account_members (
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (account_id, user_id)
);

CREATE INDEX idx_account_members_account_id ON account_members(account_id);
CREATE INDEX idx_account_members_user_id ON account_members(user_id);

-- 4. Projects table (depends on accounts and users)
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  client_name TEXT,
  budget DECIMAL(10, 2),
  design_fee DECIMAL(10, 2),
  budget_categories JSONB DEFAULT '{}'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  item_count INTEGER DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  total_value DECIMAL(10, 2) DEFAULT 0
);

CREATE INDEX idx_projects_account_id ON projects(account_id);
CREATE INDEX idx_projects_updated_at ON projects(updated_at DESC);
CREATE INDEX idx_projects_client_name ON projects(client_name);

-- 5. Items table (depends on accounts, projects, and users)
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  transaction_id TEXT,
  item_id TEXT NOT NULL,
  name TEXT,
  description TEXT,
  sku TEXT,
  source TEXT,
  purchase_price TEXT,
  project_price TEXT,
  market_value TEXT,
  payment_method TEXT,
  disposition TEXT,
  notes TEXT,
  space TEXT,
  qr_key TEXT NOT NULL,
  tax_rate_pct DECIMAL(5, 4),
  tax_amount TEXT,
  inventory_status TEXT CHECK (inventory_status IN ('available', 'allocated', 'sold')),
  business_inventory_location TEXT,
  date_created DATE,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  images JSONB DEFAULT '[]'::jsonb,
  bookmark BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_items_account_id ON items(account_id);
CREATE INDEX idx_items_project_id ON items(project_id);
CREATE INDEX idx_items_transaction_id ON items(transaction_id);
CREATE INDEX idx_items_item_id ON items(item_id);
CREATE INDEX idx_items_qr_key ON items(qr_key);
CREATE INDEX idx_items_last_updated ON items(last_updated DESC);
CREATE INDEX idx_items_project_updated ON items(project_id, last_updated DESC);
CREATE INDEX idx_items_disposition ON items(disposition);
CREATE INDEX idx_items_inventory_status ON items(inventory_status);

-- 6. Transactions table (depends on accounts, projects, and users)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  transaction_id TEXT NOT NULL,
  transaction_date DATE NOT NULL,
  source TEXT,
  transaction_type TEXT,
  amount TEXT NOT NULL,
  description TEXT,
  budget_category TEXT,
  status TEXT CHECK (status IN ('pending', 'completed', 'canceled')),
  payment_method TEXT,
  reimbursement_type TEXT,
  trigger_event TEXT,
  notes TEXT,
  receipt_emailed BOOLEAN DEFAULT FALSE,
  tax_rate_preset TEXT,
  tax_rate_pct DECIMAL(5, 4),
  subtotal TEXT,
  item_ids TEXT[] DEFAULT '{}',
  transaction_images JSONB DEFAULT '[]'::jsonb,
  receipt_images JSONB DEFAULT '[]'::jsonb,
  other_images JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_project_id ON transactions(project_id);
CREATE INDEX idx_transactions_transaction_id ON transactions(transaction_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_transactions_project_created ON transactions(project_id, created_at DESC);
CREATE INDEX idx_transactions_status ON transactions(status, created_at DESC);
CREATE INDEX idx_transactions_reimbursement_type ON transactions(reimbursement_type, created_at DESC);
CREATE INDEX idx_transactions_source ON transactions(source);
CREATE INDEX idx_transactions_transaction_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_budget_category ON transactions(budget_category);

-- 7. Business profiles table (depends on accounts and users)
CREATE TABLE business_profiles (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

CREATE INDEX idx_business_profiles_account_id ON business_profiles(account_id);

-- 8. Tax presets table (depends on accounts)
CREATE TABLE tax_presets (
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  presets JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (account_id)
);

CREATE INDEX idx_tax_presets_account_id ON tax_presets(account_id);

-- 9. Audit logs table (depends on accounts and projects)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('allocation', 'deallocation', 'return')),
  item_id TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  transaction_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_account_id ON audit_logs(account_id);
CREATE INDEX idx_audit_logs_item_id ON audit_logs(item_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- 10. Transaction audit logs table (depends on accounts)
CREATE TABLE transaction_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  transaction_id TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('created', 'updated', 'deleted')),
  old_state JSONB,
  new_state JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transaction_audit_logs_account_id ON transaction_audit_logs(account_id);
CREATE INDEX idx_transaction_audit_logs_transaction_id ON transaction_audit_logs(transaction_id);
CREATE INDEX idx_transaction_audit_logs_timestamp ON transaction_audit_logs(timestamp DESC);

-- 11. Invitations table (depends on accounts and users)
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'expired')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ
);

CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_status ON invitations(status);
CREATE INDEX idx_invitations_account_id ON invitations(account_id);

