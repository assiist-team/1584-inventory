import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { operationQueue } from '../operationQueue'
import { offlineStore } from '../offlineStore'

// Mock dependencies
vi.mock('../offlineStore')
vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test-token' } } })
    }
  },
  getCurrentUser: vi.fn().mockResolvedValue({ id: 'test-user' })
}))
vi.mock('../conflictDetector')

describe('OperationQueue', () => {
  beforeEach(async () => {
    // Clear queue before each test
    await operationQueue.clearQueue()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Queue management', () => {
    it('should add operations to queue', async () => {
      const operation = {
        type: 'CREATE_ITEM' as const,
        data: {
          projectId: 'proj-123',
          name: 'Test Item',
          description: 'Test description'
        }
      }

      await operationQueue.add(operation)

      const pending = operationQueue.getPendingOperations()
      expect(pending).toHaveLength(1)
      expect(pending[0].type).toBe('CREATE_ITEM')
      expect(pending[0].accountId).toBeDefined()
      expect(pending[0].updatedBy).toBe('test-user')
      expect(pending[0].version).toBe(1)
    })

    it('should persist queue to IndexedDB', async () => {
      const operation = {
        type: 'UPDATE_ITEM' as const,
        data: {
          id: 'item-123',
          updates: { name: 'Updated Name' }
        }
      }

      await operationQueue.add(operation)

      // Re-initialize to test persistence
      await operationQueue.init()
      const pending = operationQueue.getPendingOperations()

      expect(pending).toHaveLength(1)
    })

    it('should clear queue', async () => {
      const operation = {
        type: 'DELETE_ITEM' as const,
        data: { id: 'item-123' }
      }

      await operationQueue.add(operation)
      expect(operationQueue.getQueueLength()).toBe(1)

      await operationQueue.clearQueue()
      expect(operationQueue.getQueueLength()).toBe(0)
    })
  })

  describe('Operation processing', () => {
    it('should process operations when online', async () => {
      // Mock navigator.onLine
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true })

      const operation = {
        type: 'CREATE_ITEM' as const,
        data: {
          projectId: 'proj-123',
          name: 'Test Item'
        }
      }

      await operationQueue.add(operation)

      // Mock successful execution
      const mockExecute = vi.fn().mockResolvedValue(true)
      vi.spyOn(operationQueue as any, 'executeOperation').mockImplementation(mockExecute)

      await operationQueue.processQueue()

      expect(mockExecute).toHaveBeenCalled()
    })

    it('should not process when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true })

      const operation = {
        type: 'CREATE_ITEM' as const,
        data: {
          projectId: 'proj-123',
          name: 'Test Item'
        }
      }

      await operationQueue.add(operation)

      const mockExecute = vi.fn()
      vi.spyOn(operationQueue as any, 'executeOperation').mockImplementation(mockExecute)

      await operationQueue.processQueue()

      expect(mockExecute).not.toHaveBeenCalled()
    })

    it('should retry failed operations with backoff', async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true })

      const operation = {
        type: 'CREATE_ITEM' as const,
        data: {
          projectId: 'proj-123',
          name: 'Test Item'
        }
      }

      await operationQueue.add(operation)

      // Mock failed execution
      vi.spyOn(operationQueue as any, 'executeOperation').mockResolvedValue(false)

      await operationQueue.processQueue()

      const pending = operationQueue.getPendingOperations()
      expect(pending[0].retryCount).toBe(1)
      expect(pending[0].lastError).toBe('Sync failed')
    })

    it('should give up after max retries', async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true })

      const operation = {
        type: 'CREATE_ITEM' as const,
        data: {
          projectId: 'proj-123',
          name: 'Test Item'
        }
      }

      await operationQueue.add(operation)

      // Set retry count to max
      const pending = operationQueue.getPendingOperations()
      pending[0].retryCount = 5

      // Mock failed execution
      vi.spyOn(operationQueue as any, 'executeOperation').mockResolvedValue(false)

      await operationQueue.processQueue()

      // Operation should be removed after max retries
      expect(operationQueue.getQueueLength()).toBe(0)
    })
  })

  describe('Auth handling', () => {
    it('should require authenticated user for operations', async () => {
      // Mock unauthenticated user
      vi.mocked(await import('../supabase')).getCurrentUser.mockResolvedValueOnce(null)

      const operation = {
        type: 'CREATE_ITEM' as const,
        data: {
          projectId: 'proj-123',
          name: 'Test Item'
        }
      }

      await expect(operationQueue.add(operation)).rejects.toThrow('User must be authenticated')
    })
  })
})