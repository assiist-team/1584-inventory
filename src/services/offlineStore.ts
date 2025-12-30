interface DBItem {
  itemId: string
  accountId?: string
  projectId?: string | null
  name?: string
  description: string
  source: string
  sku: string
  price?: string
  purchasePrice?: string
  projectPrice?: string
  marketValue?: string
  paymentMethod: string
  disposition?: string | null
  notes?: string
  space?: string
  qrKey: string
  bookmark: boolean
  dateCreated: string
  lastUpdated: string
  taxRatePct?: number
  taxAmountPurchasePrice?: string
  taxAmountProjectPrice?: string
  createdBy?: string
  inventoryStatus?: 'available' | 'allocated' | 'sold'
  businessInventoryLocation?: string
  originTransactionId?: string | null
  latestTransactionId?: string | null
  version: number // For conflict resolution
  last_synced_at?: string // Track when this was last synced
}

interface DBTransaction {
  transactionId: string
  projectId?: string | null
  transactionDate: string
  source: string
  transactionType: string
  paymentMethod: string
  amount: string
  budgetCategory?: string
  categoryId?: string
  notes?: string
  receiptEmailed: boolean
  createdAt: string
  createdBy: string
  status?: 'pending' | 'completed' | 'canceled'
  reimbursementType?: string | null
  triggerEvent?: string
  taxRatePreset?: string
  taxRatePct?: number
  subtotal?: string
  needsReview?: boolean
  sumItemPurchasePrices?: string
  version: number
  last_synced_at?: string
}

interface DBProject {
  id: string
  name: string
  description: string
  clientName: string
  budget?: number
  designFee?: number
  defaultCategoryId?: string
  mainImageUrl?: string
  createdAt: string
  updatedAt: string
  createdBy: string
  version: number
  last_synced_at?: string
}

class OfflineStore {
  private db: IDBDatabase | null = null
  private readonly dbName = 'ledger-offline'
  private readonly dbVersion = 1

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Items store
        if (!db.objectStoreNames.contains('items')) {
          const itemsStore = db.createObjectStore('items', { keyPath: 'itemId' })
          itemsStore.createIndex('projectId', 'projectId', { unique: false })
          itemsStore.createIndex('lastUpdated', 'lastUpdated', { unique: false })
        }

        // Transactions store
        if (!db.objectStoreNames.contains('transactions')) {
          const transactionsStore = db.createObjectStore('transactions', { keyPath: 'transactionId' })
          transactionsStore.createIndex('projectId', 'projectId', { unique: false })
          transactionsStore.createIndex('transactionDate', 'transactionDate', { unique: false })
        }

        // Projects store
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' })
        }
      }
    })
  }

  // Items CRUD
  async getItems(projectId: string): Promise<DBItem[]> {
    if (!this.db) throw new Error('Database not initialized')
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['items'], 'readonly')
      const store = transaction.objectStore('items')
      const index = store.index('projectId')
      const request = index.getAll(projectId)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async saveItems(items: DBItem[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')
    const transaction = this.db.transaction(['items'], 'readwrite')
    const store = transaction.objectStore('items')

    for (const item of items) {
      // Ensure version exists and increment it
      if (!item.version) {
        item.version = 1
      }
      // Set last synced timestamp
      item.last_synced_at = new Date().toISOString()
      store.put(item)
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  // Transactions CRUD
  async getTransactions(projectId: string): Promise<DBTransaction[]> {
    if (!this.db) throw new Error('Database not initialized')
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['transactions'], 'readonly')
      const store = transaction.objectStore('transactions')
      const index = store.index('projectId')
      const request = index.getAll(projectId)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async saveTransactions(transactions: DBTransaction[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')
    const transaction = this.db.transaction(['transactions'], 'readwrite')
    const store = transaction.objectStore('transactions')

    for (const tx of transactions) {
      // Ensure version exists and increment it
      if (!tx.version) {
        tx.version = 1
      }
      // Set last synced timestamp
      tx.last_synced_at = new Date().toISOString()
      store.put(tx)
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  // Projects CRUD
  async getProjects(): Promise<DBProject[]> {
    if (!this.db) throw new Error('Database not initialized')
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['projects'], 'readonly')
      const store = transaction.objectStore('projects')
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async saveProjects(projects: DBProject[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')
    const transaction = this.db.transaction(['projects'], 'readwrite')
    const store = transaction.objectStore('projects')

    for (const project of projects) {
      // Ensure version exists and increment it
      if (!project.version) {
        project.version = 1
      }
      // Set last synced timestamp
      project.last_synced_at = new Date().toISOString()
      store.put(project)
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  // Utility methods
  async clearAll(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')
    const transaction = this.db.transaction(['items', 'transactions', 'projects'], 'readwrite')

    transaction.objectStore('items').clear()
    transaction.objectStore('transactions').clear()
    transaction.objectStore('projects').clear()

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }
}

export const offlineStore = new OfflineStore()
export type { DBItem, DBTransaction, DBProject }