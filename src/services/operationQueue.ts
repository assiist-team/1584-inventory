import { Operation, CreateItemOperation, UpdateItemOperation, DeleteItemOperation } from '../types/operations'
import { offlineStore } from './offlineStore'
import { supabase } from './supabase'
import { conflictDetector } from './conflictDetector'

class OperationQueue {
  private queue: Operation[] = []
  private isProcessing = false

  async init(): Promise<void> {
    // Load queued operations from localStorage
    try {
      const stored = localStorage.getItem('operation-queue')
      if (stored) {
        this.queue = JSON.parse(stored)
      }
    } catch (error) {
      console.error('Failed to load operation queue:', error)
      this.queue = []
    }
  }

  async add(operation: Omit<Operation, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    const fullOperation = {
      ...operation,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      retryCount: 0
    } as Operation

    this.queue.push(fullOperation)
    await this.persistQueue()

    // Try to process immediately if online
    if (navigator.onLine) {
      this.processQueue()
    }
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0 || !navigator.onLine) {
      return
    }

    this.isProcessing = true

    try {
      const operation = this.queue[0] // Process FIFO

      const success = await this.executeOperation(operation)

      if (success) {
        this.queue.shift() // Remove completed operation
        await this.persistQueue()
        // Process next operation
        setTimeout(() => this.processQueue(), 100)
      } else {
        // Mark for retry with exponential backoff
        operation.retryCount++
        operation.lastError = 'Sync failed'

        if (operation.retryCount >= 5) {
          // Give up after 5 retries, mark as failed
          console.error('Operation failed permanently:', operation)
          this.queue.shift()
          await this.persistQueue()
        } else {
          // Schedule retry
          const delay = Math.min(1000 * Math.pow(2, operation.retryCount), 30000)
          setTimeout(() => this.processQueue(), delay)
        }

        await this.persistQueue()
      }
    } catch (error) {
      console.error('Error processing queue:', error)
      this.isProcessing = false
    } finally {
      this.isProcessing = false
    }
  }

  private async executeOperation(operation: Operation): Promise<boolean> {
    try {
      // Check for conflicts before executing (Phase 3: Conflict Resolution)
      const projectId = this.getProjectIdFromOperation(operation)
      if (projectId) {
        const conflicts = await conflictDetector.detectConflicts(projectId)
        if (conflicts.length > 0) {
          // For now, log conflicts and skip execution
          // In Phase 4, we'll integrate with UI for resolution
          console.warn('Conflicts detected, skipping operation:', conflicts)
          return false
        }
      }

      switch (operation.type) {
        case 'CREATE_ITEM':
          return await this.executeCreateItem(operation)
        case 'UPDATE_ITEM':
          return await this.executeUpdateItem(operation)
        case 'DELETE_ITEM':
          return await this.executeDeleteItem(operation)
        default:
          console.error('Unknown operation type:', operation.type)
          return false
      }
    } catch (error) {
      console.error('Failed to execute operation:', error)
      return false
    }
  }

  private getProjectIdFromOperation(operation: Operation): string | null {
    switch (operation.type) {
      case 'CREATE_ITEM':
        return (operation as CreateItemOperation).data.projectId
      case 'UPDATE_ITEM':
        // UPDATE_ITEM doesn't have projectId in the current operation structure
        // We'll need to look up the item to get projectId, but for now skip conflict detection
        return null
      case 'DELETE_ITEM':
        // DELETE_ITEM doesn't have projectId in the current operation structure
        // We'll need to look up the item to get projectId, but for now skip conflict detection
        return null
      default:
        return null
    }
  }

  private async executeCreateItem(operation: CreateItemOperation): Promise<boolean> {
    const { data } = operation

    try {
      // Create on server first
      const { data: serverItem, error } = await supabase
        .from('items')
        .insert({
          project_id: data.projectId,
          name: data.name,
          description: data.description,
          // Add other required fields with defaults
          source: 'manual',
          sku: `TEMP-${Date.now()}`,
          payment_method: 'cash',
          qr_key: crypto.randomUUID(),
          bookmark: false,
          date_created: new Date().toISOString(),
          last_updated: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

      // Cache in local store
      const dbItem = {
        ...serverItem,
        version: 1
      }
      await offlineStore.saveItems([dbItem])

      return true
    } catch (error) {
      console.error('Failed to create item on server:', error)
      return false
    }
  }

  private async executeUpdateItem(operation: UpdateItemOperation): Promise<boolean> {
    const { data } = operation

    try {
      // Update server first
      const { error } = await supabase
        .from('items')
        .update(data.updates)
        .eq('item_id', data.id)

      if (error) throw error

      // Update local store
      const existingItems = await offlineStore.getItems('') // Get all items for now
      const itemToUpdate = existingItems.find(item => item.itemId === data.id)

      if (itemToUpdate) {
        const updatedItem = {
          ...itemToUpdate,
          ...data.updates,
          lastUpdated: new Date().toISOString(),
          version: itemToUpdate.version + 1
        }
        await offlineStore.saveItems([updatedItem])
      }

      return true
    } catch (error) {
      console.error('Failed to update item:', error)
      return false
    }
  }

  private async executeDeleteItem(operation: DeleteItemOperation): Promise<boolean> {
    const { data } = operation

    try {
      // Delete from server
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('item_id', data.id)

      if (error) throw error

      // Note: Local store deletion will be handled by cache invalidation
      // in the React Query integration

      return true
    } catch (error) {
      console.error('Failed to delete item:', error)
      return false
    }
  }

  private async persistQueue(): Promise<void> {
    try {
      localStorage.setItem('operation-queue', JSON.stringify(this.queue))
    } catch (error) {
      console.error('Failed to persist operation queue:', error)
    }
  }

  getQueueLength(): number {
    return this.queue.length
  }

  getPendingOperations(): Operation[] {
    return [...this.queue]
  }

  clearQueue(): void {
    this.queue = []
    localStorage.removeItem('operation-queue')
  }
}

export const operationQueue = new OperationQueue()