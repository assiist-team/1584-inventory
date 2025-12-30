import { offlineStore, type DBItem } from './offlineStore'
import { supabase } from './supabase'
import type { Item } from '../types'

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
      taxAmount: dbItem.taxAmount,
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