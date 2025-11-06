// Core types for the inventory management system

import { CLIENT_OWES_COMPANY, COMPANY_OWES_CLIENT } from '@/constants/company'

// Tax preset interface (imported from constants for consistency)
export interface TaxPreset {
  id: string;
  name: string;
  rate: number; // percentage, e.g., 8.375
}

export interface Account {
  id: string;
  name: string;
  createdAt: Date;
  createdBy: string;
}

export interface AccountMembership {
  userId: string;
  accountId: string;
  role: 'admin' | 'user';
  joinedAt: Date;
}

export interface BusinessProfile {
  name: string;
  logoUrl: string | null;
  updatedAt: Date;
  updatedBy: string;
  accountId: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  accountId: string; // Links user to account
  role?: 'owner' | null; // System-level owner (optional)
  createdAt: Date;
  lastLogin: Date;
}

export enum UserRole {
  OWNER = 'owner',    // System-level super admin
  ADMIN = 'admin',    // Account-level admin
  USER = 'user'       // Account-level user
}

export interface Invitation {
  id: string;
  email: string;
  accountId: string;
  role: 'admin' | 'user';
  invitedBy: string;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: Date;
  expiresAt: Date;
  acceptedAt?: Date;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  clientName: string;
  budget?: number;
  designFee?: number;
  budgetCategories?: ProjectBudgetCategories;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  settings?: ProjectSettings;
  metadata?: ProjectMetadata;
}

export interface ProjectBudgetCategories {
  designFee: number;
  furnishings: number;
  propertyManagement: number;
  kitchen: number;
  install: number;
  storageReceiving: number;
  fuel: number;
}

export interface ProjectSettings {
  allowPublicAccess: boolean;
  notificationsEnabled: boolean;
}

export interface ProjectMetadata {
  totalItems: number;
  lastActivity: Date;
  completionPercentage: number;
}

export interface Item {
  // Note: This interface defines the FORM field names used in AddItem/EditItem forms
  // Field mapping to Supabase happens in the service layer:
  // - purchase_price (form) ↔ purchase_price (Supabase)
  // - project_price (form) ↔ project_price (Supabase) - formerly resale_price
  // - market_value (form) ↔ market_value (Supabase) - direct mapping
  item_id: string;
  description: string;
  source: string;
  sku: string;
  price?: string;               // What we paid for the item (used in forms)
  purchase_price?: string;      // What we paid for the item
  project_price?: string;       // What we sell it for (Design Business project price) - formerly resale_price
  market_value?: string;        // Current market value - direct mapping
  payment_method: string;
  disposition?: string;
  notes?: string;
  space?: string;               // Space/location where item is placed
  qr_key: string;
  bookmark: boolean;
  transaction_id?: string | null;
  project_id?: string | null;   // null = business inventory, string = allocated to project
  date_created: string;
  last_updated: string;
  images?: ItemImage[];         // Images associated with this item
  // Tax fields
  tax_rate_pct?: number; // percentage, e.g., 8.25
  tax_amount?: string; // USD string, reserved for future auto-calculation

  // Optional transaction selection for form UI
  selectedTransactionId?: string; // UI field for selecting transaction

  // Business Inventory fields (unified with Item)
  inventory_status?: 'available' | 'allocated' | 'sold';
  business_inventory_location?: string; // Warehouse location details
}

// Note: ItemCategory and ItemStatus enums have been removed as they don't align
// with the original Apps Script schema. The forms now use the correct field structure
// that matches the original inventory system.

export interface ItemImage {
  url: string;
  alt: string;
  isPrimary: boolean;
  uploadedAt: Date;
  fileName: string;
  size: number; // in bytes
  mimeType: string;
  caption?: string; // Optional caption for the image
}

export interface TransactionImage {
  url: string;
  fileName: string;
  uploadedAt: Date;
  size: number; // in bytes
  mimeType: string;
}

export interface Dimensions {
  width: number;
  height: number;
  depth?: number;
  unit: 'inches' | 'cm' | 'mm';
}

export interface ItemLocation {
  storage: string;
  shelf: string;
  position: string;
}

export interface QRCodeData {
  data: string;
  generatedAt: Date;
  lastScanned?: Date;
}

export interface FilterOptions {
  disposition?: string;
  source?: string;
  status?: string; // For filtering by item status
  category?: string; // For filtering by category
  tags?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
  searchQuery?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  total?: number;
}

export interface ApiError {
  type: ErrorType;
  message: string;
  code?: string;
  details?: any;
}

export interface Transaction {
  transaction_id: string;
  project_id?: string | null;
  project_name?: string | null;
  transaction_date: string;
  source: string;
  transaction_type: string;
  payment_method: string;
  amount: string;
  budget_category?: string;
  notes?: string;
  transaction_images?: TransactionImage[]; // Legacy field for backward compatibility
  receipt_images?: TransactionImage[]; // New field for receipt images
  other_images?: TransactionImage[]; // New field for other images
  receipt_emailed: boolean;
  created_at: string;
  created_by: string;

  // NEW: Pending Transaction fields for Enhanced Transaction System
  status?: 'pending' | 'completed' | 'canceled';
  reimbursement_type?: typeof CLIENT_OWES_COMPANY | typeof COMPANY_OWES_CLIENT | '' | null | undefined;
  trigger_event?: 'Inventory allocation' | 'Inventory return' | 'Inventory sale' | 'Purchase from client' | 'Manual';

  // NEW: Item linkage for unified inventory system
  item_ids?: string[]; // Links to items in the top-level items collection
  // Tax fields
  tax_rate_preset?: string; // ID of the selected preset (e.g., 'nv', 'ut', etc.) or 'Other' for custom
  tax_rate_pct?: number; // percentage, e.g., 8.25 (calculated from preset or subtotal)
  subtotal?: string; // pre-tax amount as string, e.g. '100.00' (used when tax_rate_preset is 'Other')
}

export enum BudgetCategory {
  DESIGN_FEE = 'Design Fee',
  FURNISHINGS = 'Furnishings',
  PROPERTY_MANAGEMENT = 'Property Management',
  KITCHEN = 'Kitchen',
  INSTALL = 'Install',
  STORAGE_RECEIVING = 'Storage & Receiving',
  FUEL = 'Fuel'
}

export enum ErrorType {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  NETWORK = 'network',
  SERVER = 'server',
  CLIENT = 'client'
}

// Transaction form types and validation
export interface TransactionFormData {
  transaction_date: string;
  source: string;
  transaction_type: string;
  payment_method: string;
  amount: string;
  budget_category?: string;
  notes?: string;
  status?: 'pending' | 'completed' | 'canceled';
  reimbursement_type?: typeof CLIENT_OWES_COMPANY | typeof COMPANY_OWES_CLIENT | '' | null | undefined;
  trigger_event?: 'Inventory allocation' | 'Inventory return' | 'Inventory sale' | 'Purchase from client' | 'Manual';
  transaction_images?: File[]; // Legacy field for backward compatibility
  receipt_images?: File[]; // New field for receipt image files
  other_images?: File[]; // New field for other image files
  receipt_emailed?: boolean;
  items?: TransactionItemFormData[];
  // Tax form fields
  tax_rate_preset?: string; // ID of the selected preset (e.g., 'nv', 'ut', etc.) or 'Other' for custom
  subtotal?: string; // pre-tax amount as string, e.g. '100.00' (used when tax_rate_preset is 'Other')
}

export interface TransactionItemFormData {
  id: string; // temporary id for form management
  description: string;
  sku?: string;
  price?: string; // What we paid for the item (used in forms)
  purchase_price?: string; // What we paid for the item
  project_price?: string; // What we sell it for (Design Business project price) - formerly resale_price
  market_value?: string;
  space?: string;
  notes?: string;
  images?: ItemImage[]; // Images associated with this item
  imageFiles?: File[]; // File objects for upload (not persisted)
}

export interface TransactionValidationErrors {
  transaction_date?: string;
  source?: string;
  transaction_type?: string;
  payment_method?: string;
  amount?: string;
  budget_category?: string;
  notes?: string;
  status?: string;
  reimbursement_type?: string;
  trigger_event?: string;
  transaction_images?: string; // Legacy field for backward compatibility
  receipt_images?: string; // New field for receipt image errors
  other_images?: string; // New field for other image errors
  receipt_emailed?: string;
  items?: string; // General error for items
  general?: string; // General form error
}

export interface TransactionItemValidationErrors {
  description?: string;
  sku?: string;
  price?: string; // Used in form validation
  purchase_price?: string;
  project_price?: string; // What we sell it for (Design Business project price) - formerly resale_price
  market_value?: string;
  space?: string;
  notes?: string;
}

export interface TransactionFormProps {
  projectId: string;
  transactionId?: string;
  onSubmit: (data: TransactionFormData) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<TransactionFormData>;
  isEditing?: boolean;
}

// Business Inventory Types (REMOVED: Use Item interface instead)
// All business inventory functionality now uses the unified Item interface

// Business Inventory Summary Stats
export interface BusinessInventoryStats {
  totalItems: number;
  availableItems: number;
  allocatedItems: number;
  soldItems: number;
}

// Utility type for date values that might be Date, string, or number
export type DateValue = Date | string | number | { toDate?: () => Date; seconds?: number; nanoseconds?: number } | null | undefined

// Common interface for items that can be bookmarked
export interface BookmarkableItem {
  item_id: string;
  bookmark: boolean;
}
