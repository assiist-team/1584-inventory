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
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  settings?: ProjectSettings;
  metadata?: ProjectMetadata;
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
  // - resale_price (form) ↔ "1584_resale_price" (Firebase)
  // - market_value (form) ↔ market_value (Firebase) - direct mapping
  item_id: string;
  description: string;
  source: string;
  sku: string;
  price: string;
  resale_price?: string;        // Form field name - maps to "1584_resale_price" in Firebase
  market_value?: string;        // Direct mapping - no transformation needed
  payment_method: string;
  disposition: string;
  notes?: string;
  qr_key: string;
  bookmark: boolean;
  transaction_id: string;
  project_id: string;
  date_created: string;
  last_updated: string;
  images?: ItemImage[];         // Images associated with this item
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
  notes?: string;
  transaction_images?: TransactionImage[];
  receipt_emailed: boolean;
  created_at: string;
  created_by: string;
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
  notes?: string;
  transaction_images?: File[];
  receipt_emailed: boolean;
  items?: TransactionItemFormData[];
}

export interface TransactionItemFormData {
  id: string; // temporary id for form management
  description: string;
  sku?: string;
  price: string;
  market_value?: string;
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
  notes?: string;
  transaction_images?: string;
  receipt_emailed?: string;
  items?: string; // General error for items
  general?: string; // General form error
}

export interface TransactionItemValidationErrors {
  description?: string;
  sku?: string;
  price?: string;
  market_value?: string;
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

// Utility type for date values that might be Firestore Timestamp, Date, string, or number
export type DateValue = Date | string | number | { toDate?: () => Date; seconds?: number; nanoseconds?: number } | null | undefined
