import { offlineStore, type DBItem } from './offlineStore'
import { supabase } from './supabase'
import { operationQueue } from './operationQueue'
import type { Item } from '../types'
import type { Operation } from '../types/operations'

export class OfflineItemService {
  private isOnline = navigator.onLine

  constructor() {
    // Listen for network changes
    window.addEventListener('online', () => this.isOnline = true)
    window.addEventListener('offline', () => this.isOnline = false)
  }

  async getItemsByProject(
    accountId: string,
    projectId: string,
    _filters?: any,
    _pagination?: any
  ): Promise<Item[]> {
    try {
      if (this.isOnline) {
        // Fetch from Supabase and cache locally
        const { data, error } = await supabase
          .from('items')
          .select('*')
          .eq('account_id', accountId)
          .eq('project_id', projectId)
          .order('last_updated', { ascending: false })

        if (error) throw error

        // Convert to DB format and cache
        const dbItems: DBItem[] = data.map(item => ({
          ...item,
          version: 1 // Initial version
        }))
        await offlineStore.saveItems(dbItems)

        // Convert back to Item format
        return data.map(this.convertDbItemToItem)
      } else {
        // Serve from cache
        const cached = await offlineStore.getItems(projectId)
        // Convert back to Item format
        return cached.map(this.convertDbItemToItem)
      }
    } catch (error) {
      console.error('Error fetching items:', error)
      // Fallback to cache even if online but API failed
      try {
        const cached = await offlineStore.getItems(projectId)
        return cached.map(this.convertDbItemToItem)
      } catch (cacheError) {
        throw error // Throw original error if cache also fails
      }
    }
  }

  async createItem(itemData: {
    projectId: string
    name: string
    description?: string
    quantity: number
    unitCost: number
  }): Promise<void> {
    const operation: Omit<Operation, 'id' | 'timestamp' | 'retryCount'> = {
      type: 'CREATE_ITEM',
      data: itemData
    }

    await operationQueue.add(operation)

    // Optimistically update local store
    const tempId = `temp-${Date.now()}`
    const tempItem: DBItem = {
      itemId: tempId,
      projectId: itemData.projectId,
      name: itemData.name,
      description: itemData.description || '',
      source: 'manual',
      sku: `TEMP-${Date.now()}`,
      paymentMethod: 'cash',
      qrKey: crypto.randomUUID(),
      bookmark: false,
      dateCreated: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      version: 1
    }

    await offlineStore.saveItems([tempItem])

    // Trigger immediate processing if online
    if (navigator.onLine) {
      operationQueue.processQueue()
    }
  }

  async updateItem(itemId: string, updates: Partial<{
    name: string
    description: string
    quantity: number
    unitCost: number
  }>): Promise<void> {
    const operation: Omit<Operation, 'id' | 'timestamp' | 'retryCount'> = {
      type: 'UPDATE_ITEM',
      data: { id: itemId, updates }
    }

    await operationQueue.add(operation)

    // Update local store optimistically
    const existingItems = await offlineStore.getItems('') // Get all items for now
    const itemToUpdate = existingItems.find(item => item.itemId === itemId)

    if (itemToUpdate) {
      const optimisticItem = {
        ...itemToUpdate,
        ...updates,
        lastUpdated: new Date().toISOString(),
        version: itemToUpdate.version + 1
      }
      await offlineStore.saveItems([optimisticItem])
    }

    // Trigger immediate processing if online
    if (navigator.onLine) {
      operationQueue.processQueue()
    }
  }

  async deleteItem(itemId: string): Promise<void> {
    const operation: Omit<Operation, 'id' | 'timestamp' | 'retryCount'> = {
      type: 'DELETE_ITEM',
      data: { id: itemId }
    }

    await operationQueue.add(operation)

    // Note: Optimistic deletion from local store would be complex
    // since we need to track deletions. For now, we'll let the
    // React Query invalidation handle this when sync completes.

    // Trigger immediate processing if online
    if (navigator.onLine) {
      operationQueue.processQueue()
    }
  }

  private convertDbItemToItem(dbItem: DBItem): Item {
    return {
      itemId: dbItem.itemId,
      accountId: dbItem.accountId,
      projectId: dbItem.projectId,
      name: dbItem.name,
      description: dbItem.description,
      source: dbItem.source,
      sku: dbItem.sku,
      price: dbItem.price,
      purchasePrice: dbItem.purchasePrice,
      projectPrice: dbItem.projectPrice,
      marketValue: dbItem.marketValue,
      paymentMethod: dbItem.paymentMethod,
      disposition: dbItem.disposition as any,
      notes: dbItem.notes,
      space: dbItem.space,
      qrKey: dbItem.qrKey,
      bookmark: dbItem.bookmark,
      dateCreated: dbItem.dateCreated,
      lastUpdated: dbItem.lastUpdated,
      taxRatePct: dbItem.taxRatePct,
      taxAmountPurchasePrice: dbItem.taxAmountPurchasePrice,
      taxAmountProjectPrice: dbItem.taxAmountProjectPrice,
      createdBy: dbItem.createdBy,
      inventoryStatus: dbItem.inventoryStatus,
      businessInventoryLocation: dbItem.businessInventoryLocation,
      originTransactionId: dbItem.originTransactionId,
      latestTransactionId: dbItem.latestTransactionId
    }
  }
}

export const offlineItemService = new OfflineItemService()