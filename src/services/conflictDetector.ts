import { ConflictItem } from '../types/conflicts'
import { offlineStore, type DBItem } from './offlineStore'
import { supabase } from './supabase'

export class ConflictDetector {
  async detectConflicts(projectId: string): Promise<ConflictItem[]> {
    const conflicts: ConflictItem[] = []

    try {
      // Get local items
      const localItems = await offlineStore.getItems(projectId)

      // Get server items
      const { data: serverItems, error } = await supabase
        .from('items')
        .select('*')
        .eq('project_id', projectId)

      if (error) throw error

      // Compare each local item with server version
      for (const localItem of localItems) {
        const serverItem = serverItems.find(item => item.id === localItem.itemId)

        if (!serverItem) {
          // Item exists locally but not on server - this is a create operation, not a conflict
          continue
        }

        const conflict = this.compareItems(localItem, serverItem)
        if (conflict) {
          conflicts.push(conflict)
        }
      }
    } catch (error) {
      console.error('Error detecting conflicts:', error)
    }

    return conflicts
  }

  private compareItems(localItem: DBItem, serverItem: Record<string, unknown>): ConflictItem | null {
    // Check if versions differ significantly
    const serverVersion = (serverItem.version as number) || 1
    if (localItem.version !== serverVersion) {
      return {
        id: localItem.itemId,
        local: {
          data: localItem,
          timestamp: localItem.lastUpdated,
          version: localItem.version
        },
        server: {
          data: serverItem,
          timestamp: serverItem.updated_at as string,
          version: serverVersion
        },
        field: 'version',
        type: 'version'
      }
    }

    // Check timestamps (server is newer)
    const localTime = new Date(localItem.lastUpdated).getTime()
    const serverTime = new Date(serverItem.updated_at as string).getTime()

    if (serverTime > localTime + 5000) { // 5 second buffer for clock skew
      return {
        id: localItem.itemId,
        local: {
          data: localItem,
          timestamp: localItem.lastUpdated,
          version: localItem.version
        },
        server: {
          data: serverItem,
          timestamp: serverItem.updated_at as string,
          version: serverVersion
        },
        field: 'timestamp',
        type: 'timestamp'
      }
    }

    // Check for content differences in key fields
    const keyFields = ['name', 'quantity', 'unit_cost']
    for (const field of keyFields) {
      const localValue = (localItem as Record<string, unknown>)[field]
      const serverValue = serverItem[field]
      if (localValue !== serverValue) {
        return {
          id: localItem.itemId,
          local: {
            data: localItem,
            timestamp: localItem.lastUpdated,
            version: localItem.version
          },
          server: {
            data: serverItem,
            timestamp: serverItem.updated_at as string,
            version: serverVersion
          },
          field,
          type: 'content'
        }
      }
    }

    return null // No conflict
  }
}

export const conflictDetector = new ConflictDetector()