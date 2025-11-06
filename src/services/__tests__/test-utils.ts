import { vi } from 'vitest'
import type { PostgrestError } from '@supabase/supabase-js'

// Use the constant directly instead of importing to avoid path issues
const CLIENT_OWES_COMPANY = 'Client Owes Company'

/**
 * Test utilities for mocking Supabase client
 */

export interface MockSupabaseResponse<T = any> {
  data: T | null
  error: PostgrestError | null
}

/**
 * Creates a mock Supabase query builder chain
 */
export const createMockQueryBuilder = <T = any>(
  mockData: T | null = null,
  mockError: PostgrestError | null = null
) => {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: mockData, error: mockError }),
    maybeSingle: vi.fn().mockResolvedValue({ data: mockData, error: mockError })
  }

  // Make chain thenable (Promise-like)
  chain.then = (onResolve?: (value: MockSupabaseResponse<T>) => any) => {
    return Promise.resolve({ data: mockData, error: mockError }).then(onResolve)
  }
  chain.catch = (onReject?: (error: any) => any) => {
    return Promise.resolve({ data: mockData, error: mockError }).catch(onReject)
  }

  return chain
}

/**
 * Creates a mock Supabase client
 */
export const createMockSupabaseClient = () => {
  const mockFrom = vi.fn(() => createMockQueryBuilder())
  const mockStorage = {
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
      download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
      remove: vi.fn().mockResolvedValue({ data: [], error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/test.jpg' } }),
      list: vi.fn().mockResolvedValue({ data: [], error: null })
    }))
  }
  const mockAuth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: null }, unsubscribe: vi.fn() }))
  }
  const mockChannel = vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
    unsubscribe: vi.fn()
  }))

  return {
    from: mockFrom,
    storage: mockStorage,
    auth: mockAuth,
    channel: mockChannel
  }
}

/**
 * Common error codes for testing
 */
export const createNotFoundError = (): PostgrestError => ({
  code: 'PGRST116',
  message: 'The result contains 0 rows',
  details: null,
  hint: null
})

export const createPermissionError = (): PostgrestError => ({
  code: '42501',
  message: 'permission denied for table',
  details: null,
  hint: null
})

export const createForeignKeyError = (): PostgrestError => ({
  code: '23503',
  message: 'foreign key violation',
  details: null,
  hint: null
})

export const createUniqueConstraintError = (): PostgrestError => ({
  code: '23505',
  message: 'duplicate key value violates unique constraint',
  details: null,
  hint: null
})

/**
 * Mock user data for testing
 */
export const createMockUser = (overrides?: Partial<any>) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  display_name: 'Test User',
  role: null,
  created_at: new Date().toISOString(),
  last_login: new Date().toISOString(),
  ...overrides
})

/**
 * Mock account data for testing
 */
export const createMockAccount = (overrides?: Partial<any>) => ({
  id: 'test-account-id',
  name: 'Test Account',
  created_by: 'test-user-id',
  created_at: new Date().toISOString(),
  ...overrides
})

/**
 * Mock project data for testing
 */
export const createMockProject = (overrides?: Partial<any>) => ({
  id: 'test-project-id',
  account_id: 'test-account-id',
  name: 'Test Project',
  description: 'Test Description',
  client_name: 'Test Client',
  budget: 10000,
  design_fee: 1000,
  budget_categories: {
    designFee: 1000,
    furnishings: 5000,
    propertyManagement: 1000,
    kitchen: 2000,
    install: 500,
    storageReceiving: 300,
    fuel: 200
  },
  created_by: 'test-user-id',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides
})

/**
 * Mock item data for testing
 */
export const createMockItem = (overrides?: Partial<any>) => ({
  item_id: 'test-item-id',
  account_id: 'test-account-id',
  project_id: null,
  description: 'Test Item',
  source: 'Test Source',
  sku: 'TEST-SKU-001',
  purchase_price: '100.00',
  project_price: '150.00',
  market_value: '120.00',
  payment_method: 'Credit Card',
  disposition: 'Available',
  notes: 'Test notes',
  space: 'Living Room',
  qr_key: 'test-qr-key',
  bookmark: false,
  transaction_id: null,
  date_created: new Date().toISOString(),
  last_updated: new Date().toISOString(),
  images: [],
  tax_rate_pct: 8.375,
  tax_amount: '8.38',
  ...overrides
})

/**
 * Mock transaction data for testing
 */
export const createMockTransaction = (overrides?: Partial<any>) => ({
  id: 'test-transaction-id',
  account_id: 'test-account-id',
  project_id: 'test-project-id',
  transaction_date: new Date().toISOString().split('T')[0],
  source: 'Test Source',
  transaction_type: 'Purchase',
  payment_method: 'Credit Card',
  amount: '100.00',
  budget_category: 'Furnishings',
  tax_state: 'NV',
  subtotal: '92.38',
  tax_rate_pct: 8.25,
  tax_amount: '7.62',
  reimbursement_type: CLIENT_OWES_COMPANY,
  status: 'pending',
  notes: 'Test transaction',
  receipt_images: [],
  other_images: [],
  created_by: 'test-user-id',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides
})

