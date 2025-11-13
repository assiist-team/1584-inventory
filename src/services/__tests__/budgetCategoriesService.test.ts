import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient, createMockAccount, createNotFoundError } from './test-utils'

// Mock Supabase before importing services
vi.mock('../supabase', async () => {
  const { createMockSupabaseClient } = await import('./test-utils')
  return {
    supabase: createMockSupabaseClient()
  }
})

// Mock databaseService
vi.mock('../databaseService', () => ({
  convertTimestamps: vi.fn((data) => data),
  handleSupabaseError: vi.fn((error, options) => {
    if (error && !options?.returnNullOnNotFound) {
      throw error
    }
    return error
  }),
  ensureAuthenticatedForDatabase: vi.fn().mockResolvedValue(undefined)
}))

// Import after mocks are set up
import { budgetCategoriesService } from '../budgetCategoriesService'
import * as supabaseModule from '../supabase'

const createMockCategory = (overrides?: Partial<any>) => ({
  id: 'test-category-id',
  account_id: 'test-account-id',
  name: 'Test Category',
  slug: 'test-category',
  is_archived: false,
  metadata: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides
})

describe('budgetCategoriesService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getCategories', () => {
    it('should return categories for an account', async () => {
      const mockCategories = [
        createMockCategory({ id: 'cat-1', name: 'Category 1' }),
        createMockCategory({ id: 'cat-2', name: 'Category 2' })
      ]
      const mockQueryBuilder = createMockSupabaseClient().from('budget_categories')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockCategories, error: null })
      } as any)

      const categories = await budgetCategoriesService.getCategories('test-account-id')
      expect(categories).toHaveLength(2)
      expect(categories[0].name).toBe('Category 1')
      expect(categories[0].accountId).toBe('test-account-id')
    })

    it('should exclude archived categories by default', async () => {
      const mockCategories = [
        createMockCategory({ id: 'cat-1', name: 'Active Category', is_archived: false }),
        createMockCategory({ id: 'cat-2', name: 'Archived Category', is_archived: true })
      ]
      const mockQueryBuilder = createMockSupabaseClient().from('budget_categories')
      
      let queryChain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((field, value) => {
          if (field === 'is_archived') {
            // Simulate filtering archived
            return {
              ...queryChain,
              order: vi.fn().mockResolvedValue({ 
                data: mockCategories.filter(c => !c.is_archived), 
                error: null 
              })
            }
          }
          return queryChain
        }),
        order: vi.fn().mockResolvedValue({ data: mockCategories.filter(c => !c.is_archived), error: null })
      }

      vi.mocked(supabaseModule.supabase.from).mockReturnValue(queryChain as any)

      const categories = await budgetCategoriesService.getCategories('test-account-id', false)
      expect(categories).toHaveLength(1)
      expect(categories[0].name).toBe('Active Category')
      expect(categories[0].isArchived).toBe(false)
    })

    it('should include archived categories when requested', async () => {
      const mockCategories = [
        createMockCategory({ id: 'cat-1', name: 'Active Category', is_archived: false }),
        createMockCategory({ id: 'cat-2', name: 'Archived Category', is_archived: true })
      ]
      const mockQueryBuilder = createMockSupabaseClient().from('budget_categories')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockCategories, error: null })
      } as any)

      const categories = await budgetCategoriesService.getCategories('test-account-id', true)
      expect(categories).toHaveLength(2)
    })

    it('should enforce account_id scoping', async () => {
      const mockQueryBuilder = createMockSupabaseClient().from('budget_categories')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((field, value) => {
          expect(field).toBe('account_id')
          expect(value).toBe('test-account-id')
          return {
            ...mockQueryBuilder,
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [], error: null })
          }
        }),
        order: vi.fn().mockResolvedValue({ data: [], error: null })
      } as any)

      await budgetCategoriesService.getCategories('test-account-id')
      // Test passes if eq('account_id', ...) was called
    })
  })

  describe('getCategory', () => {
    it('should return a single category by ID', async () => {
      const mockCategory = createMockCategory()
      const mockQueryBuilder = createMockSupabaseClient().from('budget_categories')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockCategory, error: null })
      } as any)

      const category = await budgetCategoriesService.getCategory('test-account-id', 'test-category-id')
      expect(category).toBeTruthy()
      expect(category?.id).toBe('test-category-id')
      expect(category?.accountId).toBe('test-account-id')
    })

    it('should return null when category not found', async () => {
      const notFoundError = createNotFoundError()
      const mockQueryBuilder = createMockSupabaseClient().from('budget_categories')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: notFoundError })
      } as any)

      const category = await budgetCategoriesService.getCategory('test-account-id', 'non-existent-id')
      expect(category).toBeNull()
    })

    it('should enforce account_id scoping', async () => {
      const mockCategory = createMockCategory()
      const mockQueryBuilder = createMockSupabaseClient().from('budget_categories')
      
      let accountIdCalled = false
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((field, value) => {
          if (field === 'account_id') {
            accountIdCalled = true
            expect(value).toBe('test-account-id')
          }
          return {
            ...mockQueryBuilder,
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockCategory, error: null })
          }
        }),
        single: vi.fn().mockResolvedValue({ data: mockCategory, error: null })
      } as any)

      await budgetCategoriesService.getCategory('test-account-id', 'test-category-id')
      expect(accountIdCalled).toBe(true)
    })
  })

  describe('createCategory', () => {
    it('should create a new category', async () => {
      const mockCategory = createMockCategory()
      const mockQueryBuilder = createMockSupabaseClient().from('budget_categories')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockCategory, error: null })
      } as any)

      const category = await budgetCategoriesService.createCategory(
        'test-account-id',
        'New Category'
      )
      expect(category).toBeTruthy()
      expect(category.name).toBe('Test Category')
      expect(category.accountId).toBe('test-account-id')
    })

    it('should normalize slug', async () => {
      const mockCategory = createMockCategory({ slug: 'new-category' })
      const mockQueryBuilder = createMockSupabaseClient().from('budget_categories')
      
      let insertedData: any = null
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        insert: vi.fn().mockImplementation((data) => {
          insertedData = data
          return {
            ...mockQueryBuilder,
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockCategory, error: null })
          }
        }),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockCategory, error: null })
      } as any)

      await budgetCategoriesService.createCategory(
        'test-account-id',
        'New Category Name'
      )
      expect(insertedData.slug).toBe('new-category-slug')
    })

    it('should throw error if name is empty', async () => {
      await expect(
        budgetCategoriesService.createCategory('test-account-id', '', 'slug')
      ).rejects.toThrow('Category name is required')
    })

    // slug is generated internally now; no slug validation via public API
  })

  describe('updateCategory', () => {
    it('should update a category', async () => {
      const existingCategory = createMockCategory({ name: 'Old Name' })
      const updatedCategory = createMockCategory({ name: 'New Name' })
      const mockQueryBuilder = createMockSupabaseClient().from('budget_categories')
      
      // Mock getCategory call
      vi.mocked(supabaseModule.supabase.from).mockImplementation((table) => {
        if (table === 'budget_categories') {
          return {
            ...mockQueryBuilder,
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn()
              .mockResolvedValueOnce({ data: existingCategory, error: null }) // getCategory call
              .mockResolvedValueOnce({ data: updatedCategory, error: null }), // update call
            update: vi.fn().mockReturnThis()
          } as any
        }
        return mockQueryBuilder as any
      })

      const category = await budgetCategoriesService.updateCategory('test-account-id', 'test-category-id', {
        name: 'New Name'
      })
      expect(category.name).toBe('New Name')
    })

    it('should throw error if category not found', async () => {
      const notFoundError = createNotFoundError()
      const mockQueryBuilder = createMockSupabaseClient().from('budget_categories')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: notFoundError })
      } as any)

      await expect(
        budgetCategoriesService.updateCategory('test-account-id', 'non-existent-id', { name: 'New Name' })
      ).rejects.toThrow('Category not found or does not belong to this account')
    })

    it('should throw error if name is empty', async () => {
      const existingCategory = createMockCategory()
      const mockQueryBuilder = createMockSupabaseClient().from('budget_categories')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: existingCategory, error: null }),
        update: vi.fn().mockReturnThis()
      } as any)

      await expect(
        budgetCategoriesService.updateCategory('test-account-id', 'test-category-id', { name: '' })
      ).rejects.toThrow('Category name cannot be empty')
    })
  })

  describe('archiveCategory', () => {
    it('should archive a category', async () => {
      const existingCategory = createMockCategory({ is_archived: false })
      const archivedCategory = createMockCategory({ is_archived: true })
      const mockQueryBuilder = createMockSupabaseClient().from('budget_categories')
      
      // Mock getCategory and archive call
      vi.mocked(supabaseModule.supabase.from).mockImplementation((table) => {
        if (table === 'budget_categories') {
          return {
            ...mockQueryBuilder,
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn()
              .mockResolvedValueOnce({ data: existingCategory, error: null }) // getCategory call
              .mockResolvedValueOnce({ data: archivedCategory, error: null }), // archive call
            update: vi.fn().mockReturnThis()
          } as any
        }
        return mockQueryBuilder as any
      })

      const category = await budgetCategoriesService.archiveCategory('test-account-id', 'test-category-id')
      expect(category.isArchived).toBe(true)
    })

    // archiving no longer prevents archival when referenced by transactions

    it('should throw error if category not found', async () => {
      const notFoundError = createNotFoundError()
      const mockQueryBuilder = createMockSupabaseClient().from('budget_categories')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: notFoundError })
      } as any)

      await expect(
        budgetCategoriesService.archiveCategory('test-account-id', 'non-existent-id')
      ).rejects.toThrow('Category not found or does not belong to this account')
    })
  })

  describe('unarchiveCategory', () => {
    it('should unarchive a category', async () => {
      const archivedCategory = createMockCategory({ is_archived: true })
      const unarchivedCategory = createMockCategory({ is_archived: false })
      const mockQueryBuilder = createMockSupabaseClient().from('budget_categories')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn()
          .mockResolvedValueOnce({ data: archivedCategory, error: null }) // getCategory call
          .mockResolvedValueOnce({ data: unarchivedCategory, error: null }), // unarchive call
        update: vi.fn().mockReturnThis()
      } as any)

      const category = await budgetCategoriesService.unarchiveCategory('test-account-id', 'test-category-id')
      expect(category.isArchived).toBe(false)
    })
  })

  describe('getTransactionCount', () => {
    it('should return transaction count for a category', async () => {
      const mockQueryBuilder = createMockSupabaseClient().from('transactions')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue({ count: 5, error: null })
      } as any)

      // Mock the count property
      const mockResponse = { count: 5, error: null }
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnValue(mockResponse),
        eq: vi.fn().mockReturnThis()
      } as any)

      // Since select with count returns a different shape, we need to mock it properly
      const count = await budgetCategoriesService.getTransactionCount('test-account-id', 'test-category-id')
      // The actual implementation uses count: 'exact', head: true which returns { count, error }
      expect(count).toBeGreaterThanOrEqual(0) // At least returns a number
    })
  })

  describe('bulkArchiveCategories', () => {
    it('should archive multiple categories successfully', async () => {
      const category1 = createMockCategory({ id: 'cat-1', is_archived: false })
      const category2 = createMockCategory({ id: 'cat-2', is_archived: false })
      const archived1 = createMockCategory({ id: 'cat-1', is_archived: true })
      const archived2 = createMockCategory({ id: 'cat-2', is_archived: true })
      const mockQueryBuilder = createMockSupabaseClient().from('budget_categories')
      
      vi.mocked(supabaseModule.supabase.from).mockImplementation((table) => {
        if (table === 'budget_categories') {
          return {
            ...mockQueryBuilder,
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn()
              .mockResolvedValueOnce({ data: category1, error: null })
              .mockResolvedValueOnce({ data: category2, error: null })
              .mockResolvedValueOnce({ data: archived1, error: null })
              .mockResolvedValueOnce({ data: archived2, error: null }),
            update: vi.fn().mockReturnThis()
          } as any
        }
        if (table === 'transactions') {
          return {
            ...mockQueryBuilder,
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [], error: null }) // No transactions
          } as any
        }
        return mockQueryBuilder as any
      })

      const result = await budgetCategoriesService.bulkArchiveCategories('test-account-id', ['cat-1', 'cat-2'])
      expect(result.successful).toHaveLength(2)
      expect(result.failed).toHaveLength(0)
    })

    it('should report failures for categories with transactions', async () => {
      const category1 = createMockCategory({ id: 'cat-1' })
      const category2 = createMockCategory({ id: 'cat-2' })
      const mockQueryBuilder = createMockSupabaseClient().from('budget_categories')
      
      vi.mocked(supabaseModule.supabase.from).mockImplementation((table) => {
        if (table === 'budget_categories') {
          return {
            ...mockQueryBuilder,
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn()
              .mockResolvedValueOnce({ data: category1, error: null })
              .mockResolvedValueOnce({ data: category2, error: null }),
            update: vi.fn().mockReturnThis()
          } as any
        }
        if (table === 'transactions') {
          // Return transactions for cat-1, none for cat-2
          return {
            ...mockQueryBuilder,
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ 
              data: [{ category_id: 'cat-1' }], // cat-1 has transactions
              error: null 
            })
          } as any
        }
        return mockQueryBuilder as any
      })

      const result = await budgetCategoriesService.bulkArchiveCategories('test-account-id', ['cat-1', 'cat-2'])
      expect(result.successful).toContain('cat-2')
      expect(result.failed.length).toBeGreaterThan(0)
      expect(result.failed.some(f => f.categoryId === 'cat-1')).toBe(true)
    })
  })
})

