// Core types for the inventory management system
export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: Date;
  lastLogin: Date;
}

export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  DESIGNER = 'designer',
  VIEWER = 'viewer'
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
  // Field mapping to Firebase happens in the service layer:
  // - purchase_price (form) ↔ purchase_price (Firebase)
  // - project_price (form) ↔ project_price (Firebase) - formerly resale_price
  // - market_value (form) ↔ market_value (Firebase) - direct mapping
  item_id: string;
  description: string;
  source: string;
  sku: string;
  price?: string;               // What we paid for the item (used in forms)
  purchase_price?: string;      // What we paid for the item
  project_price?: string;       // What we sell it for (1584 design project price) - formerly resale_price
  market_value?: string;        // Current market value - direct mapping
  payment_method: string;
  disposition?: string;
  notes?: string;
  space?: string;               // Space/location where item is placed
  qr_key: string;
  bookmark: boolean;
  transaction_id: string;
  project_id: string;
  date_created: string;
  last_updated: string;
  images?: ItemImage[];         // Images associated with this item

  // Optional transaction selection for form UI
  selectedTransactionId?: string; // UI field for selecting transaction

  // NEW: Business Inventory fields
  inventory_status?: 'available' | 'pending' | 'sold';
  current_project_id?: string;  // If currently allocated to a project
  business_inventory_location?: string; // Warehouse location details
  pending_transaction_id?: string; // Links to pending transaction when allocated
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
  project_id: string;
  project_name: string;
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
  status?: 'pending' | 'completed' | 'cancelled';
  reimbursement_type?: 'Client Owes' | 'We Owe' | '' | null | undefined;
  trigger_event?: 'Inventory allocation' | 'Inventory return' | 'Purchase from client' | 'Manual';
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
  status?: 'pending' | 'completed' | 'cancelled';
  reimbursement_type?: 'Client Owes' | 'We Owe' | '' | null | undefined;
  trigger_event?: 'Inventory allocation' | 'Inventory return' | 'Purchase from client' | 'Manual';
  transaction_images?: File[]; // Legacy field for backward compatibility
  receipt_images?: File[]; // New field for receipt image files
  other_images?: File[]; // New field for other image files
  receipt_emailed: boolean;
  items?: TransactionItemFormData[];
}

export interface TransactionItemFormData {
  id: string; // temporary id for form management
  description: string;
  sku?: string;
  price?: string; // What we paid for the item (used in forms)
  purchase_price?: string; // What we paid for the item
  project_price?: string; // What we sell it for (1584 design project price) - formerly resale_price
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
  project_price?: string; // What we sell it for (1584 design project price) - formerly resale_price
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

// Business Inventory Types
export interface BusinessInventoryItem {
  item_id: string;
  description: string;
  source: string;
  sku: string;
  purchase_price?: string;      // What we paid for the item
  project_price?: string;       // What we sell it for (1584 design project price) - formerly resale_price
  market_value?: string;        // Current market value
  payment_method: string;
  disposition?: string;
  notes?: string;
  space?: string;
  qr_key: string;
  bookmark: boolean;
  inventory_status: 'available' | 'pending' | 'sold';
  current_project_id?: string;
  business_inventory_location?: string;
  pending_transaction_id?: string;
  date_created: string;
  last_updated: string;
  images?: ItemImage[];
  transaction_id?: string; // Links to original purchase transaction
}

// Business Inventory Summary Stats
export interface BusinessInventoryStats {
  totalItems: number;
  availableItems: number;
  pendingItems: number;
  soldItems: number;
}

// Utility type for date values that might be Firestore Timestamp, Date, string, or number
export type DateValue = Date | string | number | { toDate?: () => Date; seconds?: number; nanoseconds?: number } | null | undefined

// Common interface for items that can be bookmarked
export interface BookmarkableItem {
  item_id: string;
  bookmark: boolean;
}
