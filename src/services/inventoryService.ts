import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  getCountFromServer,
  deleteField,
  serverTimestamp
} from 'firebase/firestore'
import { STATE_TAX_RATE_PCT, SupportedTaxState } from '@/constants/tax'
import { db, convertTimestamps, ensureAuthenticatedForStorage } from './firebase'
import { toDateOnlyString } from '@/utils/dateUtils'
import type { Item, Project, FilterOptions, PaginationOptions, Transaction, TransactionItemFormData, BusinessInventoryStats } from '@/types'

// Audit Logging Service for allocation/de-allocation events
export const auditService = {
  // Log allocation/de-allocation events
  async logAllocationEvent(
    eventType: 'allocation' | 'deallocation' | 'return',
    itemId: string,
    projectId: string | null,
    transactionIdOrDetails: any,
    detailsOrUndefined?: Record<string, any>
  ): Promise<void> {
    try {
      // Handle different calling patterns
      let transactionId: string | null | undefined = null
      let details: Record<string, any> = {}

      if (typeof transactionIdOrDetails === 'string') {
        transactionId = transactionIdOrDetails
        details = detailsOrUndefined || {}
      } else {
        transactionId = null
        details = transactionIdOrDetails || {}
      }

      const auditRef = collection(db, 'audit_logs')
      await addDoc(auditRef, {
        event_type: eventType,
        item_id: itemId,
        project_id: projectId,
        transaction_id: transactionId,
        details: details,
        timestamp: serverTimestamp(),
        created_at: new Date().toISOString()
      })
      console.log(`📋 Audit logged: ${eventType} for item ${itemId}`)
    } catch (error) {
      console.warn('⚠️ Failed to log audit event (non-critical):', error)
      // Don't throw - audit logging failures shouldn't break the main flow
    }
  },

  // Log transaction state changes
  async logTransactionStateChange(
    transactionId: string,
    changeType: 'created' | 'updated' | 'deleted',
    oldState?: any,
    newState?: any
  ): Promise<void> {
    try {
      const auditRef = collection(db, 'transaction_audit_logs')
      await addDoc(auditRef, {
        transaction_id: transactionId,
        change_type: changeType,
        old_state: oldState,
        new_state: newState,
        timestamp: serverTimestamp(),
        created_at: new Date().toISOString()
      })
      console.log(`📋 Transaction audit logged: ${changeType} for ${transactionId}`)
    } catch (error) {
      console.warn('⚠️ Failed to log transaction audit (non-critical):', error)
      // Don't throw - audit logging failures shouldn't break the main flow
    }
  }
}

// Project Services
export const projectService = {
  // Get all projects for current user
  async getProjects(): Promise<Project[]> {
    // Ensure authentication before Firestore operations
    await ensureAuthenticatedForStorage()

    const projectsRef = collection(db, 'projects')
    const q = query(projectsRef, orderBy('updatedAt', 'desc'))

    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => {
      const data = convertTimestamps(doc.data())
      return {
        id: doc.id,
        ...data
      } as Project
    })
  },

  // Get single project
  async getProject(projectId: string): Promise<Project | null> {
    // Ensure authentication before Firestore operations
    await ensureAuthenticatedForStorage()

    const projectRef = doc(db, 'projects', projectId)
    const projectSnap = await getDoc(projectRef)

    if (projectSnap.exists()) {
      const data = convertTimestamps(projectSnap.data())
      return {
        id: projectSnap.id,
        ...data
      } as Project
    }
    return null
  },

  // Create new project
  async createProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const projectsRef = collection(db, 'projects')
    const now = new Date()

    const newProject = {
      ...projectData,
      createdAt: now,
      updatedAt: now
    }

    const docRef = await addDoc(projectsRef, newProject)
    return docRef.id
  },

  // Update project
  async updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
    const projectRef = doc(db, 'projects', projectId)
    await updateDoc(projectRef, {
      ...updates,
      updatedAt: new Date()
    })
  },

  // Delete project
  async deleteProject(projectId: string): Promise<void> {
    const projectRef = doc(db, 'projects', projectId)
    await deleteDoc(projectRef)
  },

  // Subscribe to projects
  subscribeToProjects(callback: (projects: Project[]) => void) {
    const projectsRef = collection(db, 'projects')
    const q = query(projectsRef, orderBy('updatedAt', 'desc'))

    return onSnapshot(q, (snapshot) => {
      const projects = snapshot.docs.map(doc => {
        const data = convertTimestamps(doc.data())
        return {
          id: doc.id,
          ...data
        } as Project
      })
      callback(projects)
    })
  }
}

// Item Services (REMOVED - migrated to unifiedItemsService)
// This service was completely removed after successful migration to unified collection

// Transaction Services
export const transactionService = {
  // Get transactions for a project (top-level collection)
  async getTransactions(projectId: string): Promise<Transaction[]> {
    const transactionsRef = collection(db, 'transactions')
    const q = query(
      transactionsRef,
      where('project_id', '==', projectId),
      orderBy('created_at', 'desc')
    )

    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => {
      const data = convertTimestamps(doc.data())

      const transactionData = {
        ...data,
        transaction_images: Array.isArray(data.transaction_images) ? data.transaction_images : [],
        receipt_images: Array.isArray(data.receipt_images) ? data.receipt_images : [],
        other_images: Array.isArray(data.other_images) ? data.other_images : []
      }

      return {
        transaction_id: doc.id,
        ...transactionData
      } as Transaction
    })
  },

  // Get single transaction (top-level only - post-migration)
  async getTransaction(_projectId: string, transactionId: string): Promise<Transaction | null> {
    const transactionRef = doc(db, 'transactions', transactionId)
    const transactionSnap = await getDoc(transactionRef)

    if (transactionSnap.exists()) {
      const data = convertTimestamps(transactionSnap.data())

      console.log('inventoryService - raw data:', data)
      console.log('inventoryService - transaction_images:', data.transaction_images)
      console.log('inventoryService - transaction_images type:', typeof data.transaction_images)

      const transactionData = {
        ...data,
        transaction_images: Array.isArray(data.transaction_images) ? data.transaction_images : [],
        receipt_images: Array.isArray(data.receipt_images) ? data.receipt_images : [],
        other_images: Array.isArray(data.other_images) ? data.other_images : []
      }

      console.log('inventoryService - processed transactionData:', transactionData)

      return {
        transaction_id: transactionSnap.id,
        ...transactionData
      } as Transaction
    }

    return null
  },

  // Get transaction by ID across all projects (for business inventory) - top-level only
  async getTransactionById(transactionId: string): Promise<{ transaction: Transaction | null; projectId: string | null }> {
    const transactionRef = doc(db, 'transactions', transactionId)
    const transactionSnap = await getDoc(transactionRef)

    if (transactionSnap.exists()) {
      const data = convertTimestamps(transactionSnap.data())
      const transactionData = {
        ...data,
        transaction_images: Array.isArray(data.transaction_images) ? data.transaction_images : [],
        receipt_images: Array.isArray(data.receipt_images) ? data.receipt_images : [],
        other_images: Array.isArray(data.other_images) ? data.other_images : []
      }

      return {
        transaction: {
          transaction_id: transactionSnap.id,
          ...transactionData
        } as Transaction,
        projectId: data.project_id || null
      }
    }

    return { transaction: null, projectId: null }
  },

  // Create new transaction (top-level collection)
  async createTransaction(
    projectId: string | null | undefined,
    transactionData: Omit<Transaction, 'transaction_id' | 'created_at'>,
    items?: TransactionItemFormData[]
  ): Promise<string> {
    try {
      const transactionsRef = collection(db, 'transactions')
      const now = new Date()

      const newTransaction = {
        ...transactionData,
        project_id: projectId,
        created_at: now.toISOString(),
        // Set default values for new fields if not provided
        status: transactionData.status || 'completed',
        reimbursement_type: transactionData.reimbursement_type || null,
        trigger_event: transactionData.trigger_event || null
      }

      console.log('Creating transaction:', newTransaction)
      console.log('Transaction items:', items)

      // Apply tax mapping for NV/UT or compute from subtotal when Other
      const txToSave: any = { ...newTransaction }

      // Apply tax mapping for NV/UT or compute from subtotal for Other
      if (txToSave.tax_state === 'NV' || txToSave.tax_state === 'UT') {
        // Require mapping to exist
        const mapped = STATE_TAX_RATE_PCT[txToSave.tax_state as SupportedTaxState]
        if (mapped === undefined || mapped === null) {
          throw new Error('Configured tax rate for selected state is missing.')
        }
        txToSave.tax_rate_pct = mapped
        // Remove subtotal for mapped states
        if (txToSave.subtotal !== undefined) {
          delete txToSave.subtotal
        }
      } else if (txToSave.tax_state === 'Other') {
        // Validate subtotal presence
        const amountNum = parseFloat((txToSave.amount as any) || '0')
        const subtotalNum = parseFloat((txToSave.subtotal as any) || '0')
        if (isNaN(subtotalNum) || subtotalNum <= 0) {
          throw new Error('Subtotal must be greater than 0 when Tax state is Other.')
        }
        if (isNaN(amountNum) || amountNum < subtotalNum) {
          throw new Error('Subtotal cannot exceed the total amount.')
        }
        const rate = ((amountNum - subtotalNum) / subtotalNum) * 100
        txToSave.tax_rate_pct = Math.round(rate * 10000) / 10000 // 4 decimal places
      }

      const docRef = await addDoc(transactionsRef, txToSave)
      const transactionId = docRef.id
      console.log('Transaction created successfully:', transactionId)

      // Create items linked to this transaction if provided
      if (items && items.length > 0) {
        console.log('Creating items for transaction:', transactionId)
        // Propagate tax_rate_pct to created items if present on transaction
        const itemsToCreate = items.map(i => ({ ...i }))
        const createdItemIds = await unifiedItemsService.createTransactionItems(
          projectId || '',
          transactionId,
          transactionData.transaction_date,
          transactionData.source, // Pass transaction source to items
          itemsToCreate,
          txToSave.tax_rate_pct
        )
        console.log('Created items:', createdItemIds)

        // tax_rate_pct is included at item creation when possible (see createTransactionItems)
      }

      return transactionId
    } catch (error) {
      console.error('Error creating transaction:', error)
      throw error // Re-throw to preserve original error for debugging
    }
  },

  // Update transaction (top-level collection)
  async updateTransaction(_projectId: string, transactionId: string, updates: Partial<Transaction>): Promise<void> {
    const transactionRef = doc(db, 'transactions', transactionId)

    // Apply business rules for reimbursement type and status
    const finalUpdates: any = { ...updates }

    // If status is being set to 'completed', clear reimbursement_type
    if (finalUpdates.status === 'completed' && finalUpdates.reimbursement_type !== undefined) {
      finalUpdates.reimbursement_type = deleteField()
    }

    // If reimbursement_type is being set to empty string, also clear it
    if (finalUpdates.reimbursement_type === '') {
      finalUpdates.reimbursement_type = deleteField()
    }

    // If reimbursement_type is being set to a non-empty value, ensure status is not 'completed'
    if (finalUpdates.reimbursement_type && finalUpdates.status === 'completed') {
      // Set status to 'pending' if reimbursement_type is being set to a non-empty value and status is 'completed'
      finalUpdates.status = 'pending'
    }

    // Filter out undefined values to prevent Firebase errors
    const cleanUpdates: any = {}
    Object.keys(finalUpdates).forEach(key => {
      if (finalUpdates[key] !== undefined) {
        cleanUpdates[key] = finalUpdates[key]
      }
    })

    // Apply tax mapping / computation before save
    const processedUpdates: any = { ...cleanUpdates }
    if (processedUpdates.tax_state === 'NV' || processedUpdates.tax_state === 'UT') {
      try {
        processedUpdates.tax_rate_pct = STATE_TAX_RATE_PCT[processedUpdates.tax_state as SupportedTaxState]
        // Remove subtotal when using mapped states
        if (processedUpdates.subtotal !== undefined) {
          processedUpdates.subtotal = deleteField()
        }
      } catch (e) {
        console.warn('Tax mapping failed during update:', e)
      }
    } else if (processedUpdates.tax_state === 'Other') {
      // compute from provided subtotal and amount if present in finalUpdates or existing doc
      const txSnap = await getDoc(transactionRef)
      const existing = txSnap.exists() ? txSnap.data() : {}
      const amountVal = processedUpdates.amount !== undefined ? parseFloat(processedUpdates.amount) : parseFloat(existing.amount || '0')
      const subtotalVal = processedUpdates.subtotal !== undefined ? parseFloat(processedUpdates.subtotal) : parseFloat(existing.subtotal || '0')
      if (!isNaN(amountVal) && !isNaN(subtotalVal) && subtotalVal > 0 && amountVal >= subtotalVal) {
        const rate = ((amountVal - subtotalVal) / subtotalVal) * 100
        processedUpdates.tax_rate_pct = Math.round(rate * 10000) / 10000
      }
    }

    await updateDoc(transactionRef, processedUpdates)

    // If tax_rate_pct is set in updates, propagate to items
    if (processedUpdates.tax_rate_pct !== undefined) {
      try {
        const items = await unifiedItemsService.getItemsForTransaction(_projectId, transactionId)
        if (items && items.length > 0) {
          const batch = writeBatch(db)
          items.forEach(item => {
            const itemRef = doc(db, 'items', item.item_id)
            batch.update(itemRef, { tax_rate_pct: processedUpdates.tax_rate_pct, last_updated: new Date().toISOString() })
          })
          await batch.commit()
        }
      } catch (e) {
        console.warn('Failed to propagate tax_rate_pct to items:', e)
      }
    }
  },

  // Delete transaction (top-level collection)
  async deleteTransaction(_projectId: string, transactionId: string): Promise<void> {
    const transactionRef = doc(db, 'transactions', transactionId)
    await deleteDoc(transactionRef)
  },

  // Subscribe to transactions (top-level collection)
  subscribeToTransactions(_projectId: string, callback: (transactions: Transaction[]) => void) {
    const transactionsRef = collection(db, 'transactions')
    const q = query(
      transactionsRef,
      where('project_id', '==', _projectId),
      orderBy('created_at', 'desc')
    )

    return onSnapshot(q, (snapshot) => {
      const transactions = snapshot.docs.map(doc => {
        const data = convertTimestamps(doc.data())

        const transactionData = {
          ...data,
          transaction_images: Array.isArray(data.transaction_images) ? data.transaction_images : [],
          receipt_images: Array.isArray(data.receipt_images) ? data.receipt_images : [],
          other_images: Array.isArray(data.other_images) ? data.other_images : []
        }

        return {
          transaction_id: doc.id,
          ...transactionData
        } as Transaction
      })
      callback(transactions)
    })
  },

  // Subscribe to single transaction for real-time updates (top-level collection)
  subscribeToTransaction(
    _projectId: string,
    transactionId: string,
    callback: (transaction: Transaction | null) => void
  ) {
    const transactionRef = doc(db, 'transactions', transactionId)

    return onSnapshot(transactionRef, (doc) => {
      if (doc.exists()) {
        const data = convertTimestamps(doc.data())

        console.log('inventoryService - real-time raw data:', data)
        console.log('inventoryService - real-time transaction_images:', data.transaction_images)

        const transactionData = {
          ...data,
          transaction_images: Array.isArray(data.transaction_images) ? data.transaction_images : [],
          receipt_images: Array.isArray(data.receipt_images) ? data.receipt_images : [],
          other_images: Array.isArray(data.other_images) ? data.other_images : []
        }

        console.log('inventoryService - real-time processed transactionData:', transactionData)

        const transaction = {
          transaction_id: doc.id,
          ...transactionData
        } as Transaction
        callback(transaction)
      } else {
        callback(null)
      }
    })
  },

  // Get pending transactions for a project
  async getPendingTransactions(projectId: string): Promise<Transaction[]> {
    const transactionsRef = collection(db, 'projects', projectId, 'transactions')
    const q = query(
      transactionsRef,
      where('status', '==', 'pending'),
      orderBy('created_at', 'desc')
    )

    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => {
      const data = convertTimestamps(doc.data())

      const transactionData = {
        ...data,
        transaction_images: Array.isArray(data.transaction_images) ? data.transaction_images : [],
        receipt_images: Array.isArray(data.receipt_images) ? data.receipt_images : [],
        other_images: Array.isArray(data.other_images) ? data.other_images : []
      }

      return {
        transaction_id: doc.id,
        ...transactionData
      } as Transaction
    })
  },

  // Update transaction status (for completing/cancelling pending transactions)
  async updateTransactionStatus(
    projectId: string,
    transactionId: string,
    status: 'pending' | 'completed' | 'canceled',
    updates?: Partial<Transaction>
  ): Promise<void> {
    const transactionRef = doc(db, 'projects', projectId, 'transactions', transactionId)

    const updateData: any = {
      status: status,
      ...updates
    }

    // Set transaction_date to current time if completing
    if (status === 'completed' && !updates?.transaction_date) {
      updateData.transaction_date = toDateOnlyString(new Date())
    }

    // Add last_updated timestamp
    updateData.last_updated = new Date().toISOString()

    await updateDoc(transactionRef, updateData)
  },

  // Utility queries for Business Inventory and reporting (top-level collection)
  async getInventoryRelatedTransactions(): Promise<Transaction[]> {
    const transactionsRef = collection(db, 'transactions')
    const q = query(
      transactionsRef,
      where('reimbursement_type', 'in', ['Client Owes', 'We Owe']),
      orderBy('created_at', 'desc')
    )

    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => {
      const data = convertTimestamps(doc.data())

      const transactionData = {
        ...data,
        transaction_images: Array.isArray(data.transaction_images) ? data.transaction_images : [],
        receipt_images: Array.isArray(data.receipt_images) ? data.receipt_images : [],
        other_images: Array.isArray(data.other_images) ? data.other_images : []
      }

      return {
        transaction_id: doc.id,
        ...transactionData
      } as Transaction
    })
  },

  // Get business inventory transactions (project_id == null)
  async getBusinessInventoryTransactions(): Promise<Transaction[]> {
    const transactionsRef = collection(db, 'transactions')
    const q = query(
      transactionsRef,
      where('project_id', '==', null),
      orderBy('created_at', 'desc')
    )

    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => {
      const data = convertTimestamps(doc.data())

      const transactionData = {
        ...data,
        transaction_images: Array.isArray(data.transaction_images) ? data.transaction_images : [],
        receipt_images: Array.isArray(data.receipt_images) ? data.receipt_images : [],
        other_images: Array.isArray(data.other_images) ? data.other_images : []
      }

      return {
        transaction_id: doc.id,
        ...transactionData
      } as Transaction
    })
  }
}

// Unified Items Collection Services (NEW)
export const unifiedItemsService = {
  // Get items for a project (project_id == projectId)
  async getItemsByProject(
    projectId: string,
    filters?: FilterOptions,
    pagination?: PaginationOptions
  ): Promise<Item[]> {
    await ensureAuthenticatedForStorage()

    const itemsRef = collection(db, 'items')
    let q = query(itemsRef, where('project_id', '==', projectId))

    // Apply filters
    if (filters?.status) {
      q = query(q, where('disposition', '==', filters.status))
    }

    if (filters?.category) {
      q = query(q, where('source', '==', filters.category))
    }

    if (filters?.tags && filters.tags.length > 0) {
      q = query(q, where('tags', 'array-contains-any', filters.tags))
    }

    if (filters?.priceRange) {
      q = query(
        q,
        where('project_price', '>=', filters.priceRange.min),
        where('project_price', '<=', filters.priceRange.max)
      )
    }

    // Apply search
    if (filters?.searchQuery) {
      const searchTerm = filters.searchQuery.toLowerCase()
      q = query(
        q,
        where('description', '>=', searchTerm),
        where('description', '<=', searchTerm + '\uf8ff')
      )
    }

    // Apply sorting and pagination
    q = query(q, orderBy('last_updated', 'desc'))

    if (pagination) {
      q = query(q, limit(pagination.limit))
      if (pagination.page > 0) {
        q = query(q, limit(pagination.page * pagination.limit))
      }
    }

    const querySnapshot = await getDocs(q)

    // Apply client-side filtering for complex queries
    let items = querySnapshot.docs.map(doc => ({
      item_id: doc.id,
      ...doc.data()
    } as Item))

    // Apply client-side search if needed
    if (filters?.searchQuery && items.length > 0) {
      const searchTerm = filters.searchQuery.toLowerCase()
      items = items.filter(item =>
        item.description.toLowerCase().includes(searchTerm) ||
        item.source.toLowerCase().includes(searchTerm) ||
        item.sku.toLowerCase().includes(searchTerm) ||
        item.payment_method.toLowerCase().includes(searchTerm)
      )
    }

    return items
  },

  // Subscribe to items for a project
  subscribeToItemsByProject(
    projectId: string,
    callback: (items: Item[]) => void,
    filters?: FilterOptions
  ) {
    const itemsRef = collection(db, 'items')
    let q = query(itemsRef, where('project_id', '==', projectId), orderBy('last_updated', 'desc'))

    if (filters?.status) {
      q = query(q, where('disposition', '==', filters.status))
    }

    if (filters?.category) {
      q = query(q, where('source', '==', filters.category))
    }

    if (filters?.searchQuery) {
      const searchTerm = filters.searchQuery.toLowerCase()
      q = query(
        q,
        where('description', '>=', searchTerm),
        where('description', '<=', searchTerm + '\uf8ff')
      )
    }

    return onSnapshot(q, (snapshot) => {
      let items = snapshot.docs.map(doc => ({
        item_id: doc.id,
        ...doc.data()
      } as Item))

      // Apply client-side search if needed
      if (filters?.searchQuery) {
        const searchTerm = filters.searchQuery.toLowerCase()
        items = items.filter(item =>
          item.description.toLowerCase().includes(searchTerm) ||
          item.source.toLowerCase().includes(searchTerm) ||
          item.sku.toLowerCase().includes(searchTerm) ||
          item.payment_method.toLowerCase().includes(searchTerm)
        )
      }

      callback(items)
    })
  },

  // Get business inventory items (project_id == null)
  async getBusinessInventoryItems(
    filters?: { status?: string; searchQuery?: string },
    pagination?: PaginationOptions
  ): Promise<Item[]> {
    await ensureAuthenticatedForStorage()

    const itemsRef = collection(db, 'items')
    let q = query(itemsRef, where('project_id', '==', null))

    // Apply filters
    if (filters?.status) {
      q = query(q, where('inventory_status', '==', filters.status))
    }

    // Apply sorting and pagination
    q = query(q, orderBy('last_updated', 'desc'))

    if (pagination) {
      q = query(q, limit(pagination.limit))
      if (pagination.page > 0) {
        q = query(q, limit(pagination.page * pagination.limit))
      }
    }

    const querySnapshot = await getDocs(q)

    let items = querySnapshot.docs.map(doc => ({
      item_id: doc.id,
      ...doc.data()
    } as Item))

    // Apply client-side search if needed
    if (filters?.searchQuery) {
      const searchTerm = filters.searchQuery.toLowerCase()
      items = items.filter(item =>
        item.description.toLowerCase().includes(searchTerm) ||
        item.source.toLowerCase().includes(searchTerm) ||
        item.sku.toLowerCase().includes(searchTerm) ||
        item.business_inventory_location?.toLowerCase().includes(searchTerm)
      )
    }

    return items
  },

  // Subscribe to business inventory items
  subscribeToBusinessInventory(
    callback: (items: Item[]) => void,
    filters?: { status?: string; searchQuery?: string }
  ) {
    const itemsRef = collection(db, 'items')
    let q = query(itemsRef, where('project_id', '==', null), orderBy('last_updated', 'desc'))

    if (filters?.status) {
      q = query(q, where('inventory_status', '==', filters.status))
    }

    return onSnapshot(q, (snapshot) => {
      let items = snapshot.docs.map(doc => ({
        item_id: doc.id,
        ...doc.data()
      } as Item))

      // Apply client-side search if needed
      if (filters?.searchQuery) {
        const searchTerm = filters.searchQuery.toLowerCase()
        items = items.filter(item =>
          item.description.toLowerCase().includes(searchTerm) ||
          item.source.toLowerCase().includes(searchTerm) ||
          item.sku.toLowerCase().includes(searchTerm) ||
          item.business_inventory_location?.toLowerCase().includes(searchTerm)
        )
      }

      callback(items)
    })
  },

  // Create new item
  async createItem(itemData: Omit<Item, 'item_id' | 'date_created' | 'last_updated'>): Promise<string> {
    await ensureAuthenticatedForStorage()

    const itemsRef = collection(db, 'items')
    const now = new Date()

    const newItem: any = {
      ...itemData,
      inventory_status: itemData.inventory_status || 'available',
      date_created: now.toISOString(),
      last_updated: now.toISOString()
    }

    // If item is being created with a transaction_id but missing tax_rate_pct,
    // attempt to read the transaction and inherit its tax_rate_pct.
    try {
      if (newItem.transaction_id && newItem.tax_rate_pct === undefined) {
        const txRef = doc(db, 'transactions', newItem.transaction_id)
        const txSnap = await getDoc(txRef)
        if (txSnap.exists()) {
          const txData: any = txSnap.data()
          if (txData.tax_rate_pct !== undefined && txData.tax_rate_pct !== null) {
            newItem.tax_rate_pct = txData.tax_rate_pct
          }
        }
      }
    } catch (e) {
      console.warn('Failed to inherit tax_rate_pct when creating item:', e)
    }

    const docRef = await addDoc(itemsRef, newItem)
    return docRef.id
  },

  // Update item
  async updateItem(itemId: string, updates: Partial<Item>): Promise<void> {
    await ensureAuthenticatedForStorage()

    const itemRef = doc(db, 'items', itemId)

    const firebaseUpdates: any = {
      last_updated: new Date().toISOString()
    }

    if (updates.inventory_status !== undefined) firebaseUpdates.inventory_status = updates.inventory_status
    if (updates.project_id !== undefined) firebaseUpdates.project_id = updates.project_id
    if (updates.business_inventory_location !== undefined) firebaseUpdates.business_inventory_location = updates.business_inventory_location
    if (updates.transaction_id !== undefined) firebaseUpdates.transaction_id = updates.transaction_id
    if (updates.purchase_price !== undefined) firebaseUpdates.purchase_price = updates.purchase_price
    if (updates.project_price !== undefined) firebaseUpdates.project_price = updates.project_price
    if (updates.description !== undefined) firebaseUpdates.description = updates.description
    if (updates.source !== undefined) firebaseUpdates.source = updates.source
    if (updates.sku !== undefined) firebaseUpdates.sku = updates.sku
    if (updates.market_value !== undefined) firebaseUpdates.market_value = updates.market_value
    if (updates.payment_method !== undefined) firebaseUpdates.payment_method = updates.payment_method
    if (updates.disposition !== undefined) firebaseUpdates.disposition = updates.disposition
    if (updates.notes !== undefined) firebaseUpdates.notes = updates.notes
    if (updates.space !== undefined) firebaseUpdates.space = updates.space
    if (updates.bookmark !== undefined) firebaseUpdates.bookmark = updates.bookmark
    if (updates.images !== undefined) firebaseUpdates.images = updates.images
    if (updates.tax_rate_pct !== undefined) firebaseUpdates.tax_rate_pct = updates.tax_rate_pct
    if (updates.tax_amount !== undefined) firebaseUpdates.tax_amount = updates.tax_amount

    // If transaction_id is being set/changed and caller did not provide tax_rate_pct,
    // attempt to inherit the transaction's tax_rate_pct and include it in the update.
    try {
      const willSetTransaction = updates.transaction_id !== undefined && updates.transaction_id !== null
      const missingTax = updates.tax_rate_pct === undefined || updates.tax_rate_pct === null
      if (willSetTransaction && missingTax) {
        const txId = updates.transaction_id as string
        if (txId) {
          const txRef = doc(db, 'transactions', txId)
          const txSnap = await getDoc(txRef)
          if (txSnap.exists()) {
            const txData: any = txSnap.data()
            if (txData.tax_rate_pct !== undefined && txData.tax_rate_pct !== null) {
              firebaseUpdates.tax_rate_pct = txData.tax_rate_pct
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to inherit tax_rate_pct when updating item:', e)
    }

    await updateDoc(itemRef, firebaseUpdates)
  },

  // Delete item
  async deleteItem(itemId: string): Promise<void> {
    await ensureAuthenticatedForStorage()

    const itemRef = doc(db, 'items', itemId)
    await deleteDoc(itemRef)
  },

  // Get items for a transaction (by transaction_id)
  async getItemsForTransaction(_projectId: string, transactionId: string): Promise<Item[]> {
    await ensureAuthenticatedForStorage()

    const itemsRef = collection(db, 'items')
    const q = query(
      itemsRef,
      where('transaction_id', '==', transactionId),
      orderBy('date_created', 'asc')
    )

    const querySnapshot = await getDocs(q)

    return querySnapshot.docs.map(doc => ({
      item_id: doc.id,
      ...doc.data()
    } as Item))
  },

  // Allocate single item to project (follows ALLOCATION_TRANSACTION_LOGIC.md deterministic flows)
  async allocateItemToProject(
    itemId: string,
    projectId: string,
    amount?: string,
    notes?: string,
    space?: string
  ): Promise<string> {
    await ensureAuthenticatedForStorage()

    // Get the item to determine current state and calculate amount
    const item = await this.getItemById(itemId)
    if (!item) {
      throw new Error('Item not found')
    }

    const finalAmount = amount || item.project_price || item.market_value || '0.00'
    const currentTransactionId: string | null = item.transaction_id || null

    console.log('🔄 Starting allocation process:', {
      itemId,
      projectId,
      currentTransactionId,
      itemProjectId: item.project_id,
      finalAmount
    })

    // Log allocation start (catch errors to prevent cascading failures)
    try {
      await (auditService.logAllocationEvent as any)('allocation', itemId, item.project_id, currentTransactionId, {
        action: 'allocation_started',
        target_project_id: projectId,
        current_transaction_id: currentTransactionId,
        amount: finalAmount
      })
    } catch (auditError) {
      console.warn('⚠️ Failed to log allocation start:', auditError)
    }

    // DETERMINISTIC FLOW LOGIC from ALLOCATION_TRANSACTION_LOGIC.md

    // Scenario A: Item currently in a Sale (Project X)
    if (currentTransactionId?.startsWith('INV_SALE_')) {
      const currentProjectId = currentTransactionId.replace('INV_SALE_', '')

      if (currentProjectId === projectId) {
        // A.1: Remove item from Sale and move to Inventory (delete Sale if empty)
        console.log('📋 Scenario A.1: Item in Sale, allocating to same project → move to inventory')
        return await this.handleSaleToInventoryMove(itemId, currentTransactionId, projectId, finalAmount, notes, space)
      } else {
        // A.2: Allocate to different project - remove from Sale, add to Purchase (Project Y)
        console.log('📋 Scenario A.2: Item in Sale, allocating to different project')
        return await this.handleSaleToDifferentProjectMove(itemId, currentTransactionId, projectId, finalAmount, notes, space)
      }
    }

    // Scenario B: Item currently in a Purchase (Project X)
    if (currentTransactionId?.startsWith('INV_PURCHASE_')) {
      const currentProjectId = currentTransactionId.replace('INV_PURCHASE_', '')

      if (currentProjectId === projectId) {
        // B.1: Allocate to same project - remove from Purchase, update amount, delete if empty
        console.log('📋 Scenario B.1: Item in Purchase, allocating to same project')
        return await this.handlePurchaseToInventoryMove(itemId, currentTransactionId, projectId, finalAmount, notes, space)
      } else {
        // B.2: Allocate to different project - remove from Purchase, add to Sale (Project Y)
        console.log('📋 Scenario B.2: Item in Purchase, allocating to different project')
        return await this.handlePurchaseToDifferentProjectMove(itemId, currentTransactionId, projectId, finalAmount, notes, space)
      }
    }

    // Scenario C: Item in Inventory (no transaction)
    // Only treat as inventory when there is no transaction_id. Previously this
    // branch also treated items with a null project_id as inventory which
    // incorrectly bypassed removal from existing INV_SALE_/INV_PURCHASE_
    // transactions. Require absence of currentTransactionId to follow the
    // inventory -> purchase flow.
    if (!currentTransactionId) {
      console.log('📋 Scenario C: Item in inventory, allocating to project')
      return await this.handleInventoryToPurchaseMove(itemId, projectId, finalAmount, notes, space)
    }

    // Fallback: Unknown scenario, treat as new allocation
    console.log('📋 Fallback: Unknown scenario, treating as new allocation')
    return await this.handleInventoryToPurchaseMove(itemId, projectId, finalAmount, notes)
  },

  // Helper: Handle A.1 - Remove item from Sale (same project)
  async handleSaleToPurchaseMove(
    itemId: string,
    currentTransactionId: string,
    projectId: string,
    finalAmount: string,
    notes?: string,
    space?: string
  ): Promise<string> {
    const purchaseTransactionId = `INV_PURCHASE_${projectId}`

    // Remove item from existing Sale transaction
    await this.removeItemFromTransaction(itemId, currentTransactionId, finalAmount)

    // Add item to Purchase transaction (create if none)
    await this.addItemToTransaction(itemId, purchaseTransactionId, finalAmount, 'Purchase', 'Inventory allocation', notes)

    // Update item status
    await this.updateItem(itemId, {
      project_id: projectId,
      inventory_status: 'allocated',
      transaction_id: purchaseTransactionId,
      disposition: 'keep',
      space: space
    })

    console.log('✅ A.1 completed: Sale → Purchase (same project)')

    // Log successful allocation (catch errors to prevent cascading failures)
    try {
      await auditService.logAllocationEvent('allocation', itemId, projectId, purchaseTransactionId, {
        action: 'allocation_completed',
        scenario: 'A.1',
        from_transaction: currentTransactionId,
        to_transaction: purchaseTransactionId,
        amount: finalAmount
      })
    } catch (auditError) {
      console.warn('⚠️ Failed to log allocation completion:', auditError)
    }

    return purchaseTransactionId
  },

  // Helper: Handle A.1 (authoritative) - Remove item from Sale and move to Inventory (same project)
  async handleSaleToInventoryMove(
    itemId: string,
    currentTransactionId: string,
    _projectId: string,
    finalAmount: string,
    _notes?: string,
    space?: string
  ): Promise<string> {
    // Remove item from existing Sale transaction
    await this.removeItemFromTransaction(itemId, currentTransactionId, finalAmount)

    // Update item status to inventory
    // Per A.1: allocate back to the same project without creating an INV_PURCHASE
    // i.e. set the item's project and mark as allocated, but do not attach a
    // purchase transaction.
    await this.updateItem(itemId, {
      project_id: _projectId,
      inventory_status: 'allocated',
      transaction_id: null,
      disposition: 'keep',
      space: space ?? ''
    })

    console.log('✅ A.1 completed: Sale → Inventory (same project)')

    // Log successful move (catch errors to prevent cascading failures)
    try {
      await auditService.logAllocationEvent('allocation', itemId, _projectId, null, {
        action: 'allocation_completed',
        scenario: 'A.1',
        from_transaction: currentTransactionId,
        to_status: 'allocated',
        amount: finalAmount
      })
    } catch (auditError) {
      console.warn('⚠️ Failed to log allocation completion (A.1):', auditError)
    }

    // Return original sale transaction id (may have been deleted)
    return currentTransactionId
  },

  // Helper: Handle A.2 - Remove item from Sale, add to Purchase (different project)
  async handleSaleToDifferentProjectMove(
    itemId: string,
    currentTransactionId: string,
    newProjectId: string,
    finalAmount: string,
    notes?: string,
    space?: string
  ): Promise<string> {
    const purchaseTransactionId = `INV_PURCHASE_${newProjectId}`

    // Remove item from existing Sale transaction
    await this.removeItemFromTransaction(itemId, currentTransactionId, finalAmount)

    // Add item to Purchase transaction for new project (create if none)
    await this.addItemToTransaction(itemId, purchaseTransactionId, finalAmount, 'Purchase', 'Inventory allocation', notes)

    // Update item status
    await this.updateItem(itemId, {
      project_id: newProjectId,
      inventory_status: 'allocated',
      transaction_id: purchaseTransactionId,
      disposition: 'keep',
      space: space
    })

    console.log('✅ A.2 completed: Sale → Purchase (different project)')

    // Log successful allocation (catch errors to prevent cascading failures)
    try {
      await auditService.logAllocationEvent('allocation', itemId, newProjectId, purchaseTransactionId, {
        action: 'allocation_completed',
        scenario: 'A.2',
        from_transaction: currentTransactionId,
        to_transaction: purchaseTransactionId,
        amount: finalAmount
      })
    } catch (auditError) {
      console.warn('⚠️ Failed to log allocation completion:', auditError)
    }

    return purchaseTransactionId
  },

  // Helper: Handle B.1 - Remove item from Purchase (same project)
  async handlePurchaseToInventoryMove(
    itemId: string,
    currentTransactionId: string,
    _projectId: string,
    finalAmount: string,
    _notes?: string,
    space?: string
  ): Promise<string> {
    // Remove item from existing Purchase transaction
    await this.removeItemFromTransaction(itemId, currentTransactionId, finalAmount)

    // Update item status to inventory
    await this.updateItem(itemId, {
      project_id: null,
      inventory_status: 'available',
      disposition: 'inventory',
      notes: _notes,
      space: space ?? ''
    })

    console.log('✅ B.1 completed: Purchase → Inventory (same project)')

    // Log successful deallocation (catch errors to prevent cascading failures)
    try {
      await auditService.logAllocationEvent('deallocation', itemId, null, 'inventory', {
        action: 'deallocation_completed',
        scenario: 'B.1',
        from_transaction: currentTransactionId,
        to_status: 'inventory',
        amount: finalAmount
      })
    } catch (auditError) {
      console.warn('⚠️ Failed to log deallocation completion:', auditError)
    }

    return currentTransactionId // Return the original transaction ID since item is now in inventory
  },

  // Helper: Handle B.2 - Remove item from Purchase, add to Sale (different project)
  async handlePurchaseToDifferentProjectMove(
    itemId: string,
    currentTransactionId: string,
    newProjectId: string,
    finalAmount: string,
    notes?: string,
    space?: string
  ): Promise<string> {
    const saleTransactionId = `INV_SALE_${newProjectId}`

    // Remove item from existing Purchase transaction
    await this.removeItemFromTransaction(itemId, currentTransactionId, finalAmount)

    // Add item to Sale transaction for new project (create if none)
    await this.addItemToTransaction(itemId, saleTransactionId, finalAmount, 'To Inventory', 'Inventory sale', notes)

    // Update item status
    await this.updateItem(itemId, {
      project_id: null,
      inventory_status: 'available',
      transaction_id: saleTransactionId,
      disposition: 'inventory',
      space: space ?? ''
    })

    console.log('✅ B.2 completed: Purchase → Sale (different project)')

    // Log successful allocation (catch errors to prevent cascading failures)
    try {
      await auditService.logAllocationEvent('allocation', itemId, null, saleTransactionId, {
        action: 'allocation_completed',
        scenario: 'B.2',
        from_transaction: currentTransactionId,
        to_transaction: saleTransactionId,
        amount: finalAmount
      })
    } catch (auditError) {
      console.warn('⚠️ Failed to log allocation completion:', auditError)
    }

    return saleTransactionId
  },

  // Helper: Handle C - Add item to Purchase (new allocation)
  async handleInventoryToPurchaseMove(
    itemId: string,
    projectId: string,
    finalAmount: string,
    notes?: string,
    space?: string
  ): Promise<string> {
    const purchaseTransactionId = `INV_PURCHASE_${projectId}`

    // Add item to Purchase transaction (create if none)
    await this.addItemToTransaction(itemId, purchaseTransactionId, finalAmount, 'Purchase', 'Inventory allocation', notes)

    // Update item status
    await this.updateItem(itemId, {
      project_id: projectId,
      inventory_status: 'allocated',
      transaction_id: purchaseTransactionId,
      disposition: 'keep',
      space: space
    })

    console.log('✅ C completed: Inventory → Purchase (new allocation)')

    // Log successful allocation (catch errors to prevent cascading failures)
    try {
      await auditService.logAllocationEvent('allocation', itemId, projectId, purchaseTransactionId, {
        action: 'allocation_completed',
        scenario: 'C',
        from_status: 'inventory',
        to_transaction: purchaseTransactionId,
        amount: finalAmount
      })
    } catch (auditError) {
      console.warn('⚠️ Failed to log allocation completion:', auditError)
    }

    return purchaseTransactionId
  },

  // Helper: Remove item from transaction and update amounts
  async removeItemFromTransaction(itemId: string, transactionId: string, _itemAmount: string): Promise<void> {
    const transactionRef = doc(db, 'transactions', transactionId)
    const transactionSnap = await getDoc(transactionRef)

    if (!transactionSnap.exists()) {
      console.warn('⚠️ Transaction not found for removal:', transactionId)
      return
    }

    const existingData = transactionSnap.data()
    const existingItemIds = existingData.item_ids || []
    const updatedItemIds = existingItemIds.filter((id: string) => id !== itemId)

    if (updatedItemIds.length === 0) {
      // No items left - delete transaction
      try {
        await deleteDoc(transactionRef)
        console.log('🗑️ Deleted empty transaction:', transactionId)

        // Log transaction deletion (catch errors to prevent cascading failures)
        try {
          await auditService.logTransactionStateChange(transactionId, 'deleted', existingData, null)
        } catch (auditError) {
          console.warn('⚠️ Failed to log transaction deletion:', auditError)
        }
      } catch (error) {
        console.error('❌ Failed to delete empty transaction:', transactionId, error)
        // Don't throw - allow the allocation to continue even if deletion fails
      }
    } else {
      // Recalculate amount from remaining items
      try {
        const itemsRef = collection(db, 'items')
        const itemsQuery = query(itemsRef, where('__name__', 'in', updatedItemIds))
        const itemsSnapshot = await getDocs(itemsQuery)

        const totalAmount = itemsSnapshot.docs
          .map(doc => doc.data().project_price || doc.data().market_value || '0.00')
          .reduce((sum: number, price: string) => sum + parseFloat(price || '0'), 0)
          .toFixed(2)
        // Prevent negative totals
        const safeAmount = parseFloat(totalAmount) < 0 ? '0.00' : totalAmount

        const updateData = {
          item_ids: updatedItemIds,
          amount: safeAmount,
          last_updated: new Date().toISOString()
        }

        await updateDoc(transactionRef, updateData)
        console.log('🔄 Updated transaction after removal:', transactionId, 'new amount:', safeAmount)

        // Log transaction update (catch errors to prevent cascading failures)
        try {
          await auditService.logTransactionStateChange(transactionId, 'updated', existingData, updateData)
        } catch (auditError) {
          console.warn('⚠️ Failed to log transaction update:', auditError)
        }
      } catch (error) {
        console.error('❌ Failed to update transaction after removal:', transactionId, error)
        // Don't throw - allow the allocation to continue
      }
    }
  },

  // Helper: Add item to transaction (create if none exists)
  async addItemToTransaction(
    itemId: string,
    transactionId: string,
    amount: string,
    transactionType: 'Purchase' | 'Sale' | 'To Inventory',
    triggerEvent: string,
    notes?: string
  ): Promise<void> {
    const transactionRef = doc(db, 'transactions', transactionId)
    const transactionSnap = await getDoc(transactionRef)

    if (transactionSnap.exists()) {
      // Transaction exists - add item and recalculate amount
      try {
        const existingData = transactionSnap.data()
        const existingItemIds = existingData.item_ids || []
        const updatedItemIds = [...new Set([...existingItemIds, itemId])] // Avoid duplicates

        // Get all items to recalculate amount
        const itemsRef = collection(db, 'items')
        const itemsQuery = query(itemsRef, where('__name__', 'in', updatedItemIds))
        const itemsSnapshot = await getDocs(itemsQuery)

        const totalAmount = itemsSnapshot.docs
          .map(doc => doc.data().project_price || doc.data().market_value || '0.00')
          .reduce((sum: number, price: string) => sum + parseFloat(price || '0'), 0)
          .toFixed(2)
        // Prevent negative totals
        const safeAmount = parseFloat(totalAmount) < 0 ? '0.00' : totalAmount

        const updateData = {
          item_ids: updatedItemIds,
          amount: safeAmount,
          last_updated: new Date().toISOString()
        }

        await updateDoc(transactionRef, updateData)
        console.log('🔄 Added item to existing transaction:', transactionId, 'new amount:', safeAmount)

        // Log transaction update (catch errors to prevent cascading failures)
        try {
          await auditService.logTransactionStateChange(transactionId, 'updated', existingData, updateData)
        } catch (auditError) {
          console.warn('⚠️ Failed to log transaction update:', auditError)
        }

        // If the transaction has a tax rate, propagate it to the added item
        try {
          const txTax = existingData.tax_rate_pct
          if (txTax !== undefined && txTax !== null) {
            const itemRef = doc(db, 'items', itemId)
            await updateDoc(itemRef, { tax_rate_pct: txTax, last_updated: new Date().toISOString() })
          }
        } catch (e) {
          console.warn('Failed to set tax_rate_pct on added item:', itemId, e)
        }
      } catch (error) {
        console.error('❌ Failed to update existing transaction:', transactionId, error)
        // Don't throw - allow the allocation to continue
      }
    } else {
      // Create new transaction
      try {
        const project = await projectService.getProject(transactionId.replace(transactionType === 'Purchase' ? 'INV_PURCHASE_' : 'INV_SALE_', ''))
        const projectName = project?.name || 'Other'

        const transactionData = {
          project_id: transactionId.replace(transactionType === 'Purchase' ? 'INV_PURCHASE_' : 'INV_SALE_', ''),
          project_name: null,
          transaction_date: toDateOnlyString(new Date()),
          source: transactionType === 'Purchase' ? 'Inventory' : projectName,
          transaction_type: transactionType,
          payment_method: 'Pending',
          amount: amount,
          budget_category: 'Furnishings',
          notes: notes || `Transaction for items ${transactionType === 'Purchase' ? 'purchased from' : 'sold to'} ${transactionType === 'Purchase' ? 'inventory' : 'project'}`,
          status: 'pending' as const,
          reimbursement_type: transactionType === 'Purchase' ? 'Client Owes' : 'We Owe',
          trigger_event: triggerEvent,
          item_ids: [itemId],
          created_by: 'system',
          created_at: new Date().toISOString(),
          last_updated: new Date().toISOString()
        }

        await setDoc(transactionRef, transactionData)
        console.log('🆕 Created new transaction:', transactionId, 'amount:', amount)

        // Log transaction creation (catch errors to prevent cascading failures)
        try {
          await auditService.logTransactionStateChange(transactionId, 'created', null, transactionData)
        } catch (auditError) {
          console.warn('⚠️ Failed to log transaction creation:', auditError)
        }
      } catch (error) {
        console.error('❌ Failed to create new transaction:', transactionId, error)
        // Don't throw - allow the allocation to continue
      }
    }
  },

  // Batch allocate multiple items to project (updates INV_PURCHASE_<projectId> transaction)
  async batchAllocateItemsToProject(
    itemIds: string[],
    projectId: string,
    allocationData: {
      amount?: string;
      notes?: string;
      space?: string;
    } = {}
  ): Promise<string> {
    await ensureAuthenticatedForStorage()

    // Fetch the requested items by id (inspect transaction_id per-item to
    // implement A.1 vs A.2 decisions). Do NOT rely solely on project_id.
    const itemsRef = collection(db, 'items')
    const itemsQuery = query(itemsRef, where('__name__', 'in', itemIds))
    const itemsSnapshot = await getDocs(itemsQuery)

    if (itemsSnapshot.empty) {
      throw new Error('No items found for allocation')
    }

    const canonicalTransactionId = `INV_PURCHASE_${projectId}`

    // Process each item individually so we can apply A.1/A.2 rules per item.
    for (const itemDoc of itemsSnapshot.docs) {
      const itemId = itemDoc.id
      const itemData: any = itemDoc.data()
      const finalAmount = allocationData.amount || itemData.project_price || itemData.market_value || '0.00'
      const currentTransactionId: string | null = itemData.transaction_id || null

      // Scenario A: Item currently in a Sale (Project X)
      if (currentTransactionId?.startsWith('INV_SALE_')) {
        const saleProjectId = currentTransactionId.replace('INV_SALE_', '')

        if (saleProjectId === projectId) {
          // A.1: Remove item from Sale and DO NOT add to Purchase. Assign back to
          // the same project (mark allocated) but do not create an INV_PURCHASE.
          console.log('📋 Batch A.1: Item in sale for target project — removing from sale and assigning to project', itemId)
          await this.removeItemFromTransaction(itemId, currentTransactionId, finalAmount)
          await this.updateItem(itemId, {
            project_id: projectId,
            inventory_status: 'allocated',
            transaction_id: null,
            disposition: 'keep',
            notes: allocationData.notes,
            space: allocationData.space || '',
            last_updated: new Date().toISOString()
          })
          continue
        } else {
          // A.2: Remove from Sale then add to Purchase for target project
          console.log('📋 Batch A.2: Item in sale for different project — moving to purchase for target project', itemId)
          await this.removeItemFromTransaction(itemId, currentTransactionId, finalAmount)
          await this.addItemToTransaction(itemId, canonicalTransactionId, finalAmount, 'Purchase', 'Inventory allocation', allocationData.notes)
          await this.updateItem(itemId, {
            project_id: projectId,
            inventory_status: 'allocated',
            transaction_id: canonicalTransactionId,
            disposition: 'keep',
            space: allocationData.space || '',
            last_updated: new Date().toISOString()
          })
          continue
        }
      }

      // Scenario C: Item in Inventory (no transaction_id) — add to Purchase
      if (!currentTransactionId) {
        console.log('📋 Batch C: Item in inventory — adding to purchase', itemId)
        await this.addItemToTransaction(itemId, canonicalTransactionId, finalAmount, 'Purchase', 'Inventory allocation', allocationData.notes)
        await this.updateItem(itemId, {
          project_id: projectId,
          inventory_status: 'allocated',
          transaction_id: canonicalTransactionId,
          disposition: 'keep',
          space: allocationData.space || '',
          last_updated: new Date().toISOString()
        })
        continue
      }

      // Fallback: other transaction types — add to purchase and update item
      console.log('📋 Batch Fallback: Item in other transaction — adding to purchase', itemId, currentTransactionId)
      await this.addItemToTransaction(itemId, canonicalTransactionId, finalAmount, 'Purchase', 'Inventory allocation', allocationData.notes)
      await this.updateItem(itemId, {
        project_id: projectId,
        inventory_status: 'allocated',
        transaction_id: canonicalTransactionId,
        disposition: 'keep',
        space: allocationData.space || '',
        last_updated: new Date().toISOString()
      })
    }

    return canonicalTransactionId
  },

  // Return item from project (follows ALLOCATION_TRANSACTION_LOGIC.md deterministic flows)
  async returnItemFromProject(
    itemId: string,
    projectId: string,
    amount?: string,
    notes?: string
  ): Promise<string> {
    await ensureAuthenticatedForStorage()

    // Get the item to determine current state
    const item = await this.getItemById(itemId)
    if (!item) {
      throw new Error('Item not found')
    }

    const finalAmount = amount || item.project_price || item.market_value || '0.00'
    const currentTransactionId: string | null = item.transaction_id || null

    console.log('🔄 Starting return process:', {
      itemId,
      projectId,
      currentTransactionId,
      itemProjectId: item.project_id,
      finalAmount
    })

    // Log return start (catch errors to prevent cascading failures)
    try {
      await (auditService.logAllocationEvent as any)('return', itemId, item.project_id, currentTransactionId, {
        action: 'return_started',
        target_project_id: projectId,
        current_transaction_id: currentTransactionId,
        amount: finalAmount
      })
    } catch (auditError) {
      console.warn('⚠️ Failed to log return start:', auditError)
    }

    // DETERMINISTIC FLOW LOGIC for returns (reverse of allocation)

    // If item is in a Purchase transaction, this is a return (Scenario B reverse)
    if (currentTransactionId?.startsWith('INV_PURCHASE_')) {
      const currentProjectId = currentTransactionId.replace('INV_PURCHASE_', '')

      if (currentProjectId === projectId) {
        // Returning from same project - remove from Purchase, move to inventory
        console.log('📋 Return Scenario: Item in Purchase, returning from same project')
        return await this.handleReturnFromPurchase(itemId, currentTransactionId, projectId, finalAmount, notes)
      }
    }

    // If item is not in any transaction or is in inventory, this is a new return
    console.log('📋 Return Scenario: Item not in transaction or new return')
    return await this.handleNewReturn(itemId, projectId, finalAmount, notes)
  },

  // Helper: Handle return from Purchase transaction (same project)
  async handleReturnFromPurchase(
    itemId: string,
    currentTransactionId: string,
    _projectId: string,
    finalAmount: string,
    notes?: string
  ): Promise<string> {
    // Remove item from existing Purchase transaction and return it to inventory.
    // Per allocation rules, do NOT create an INV_SALE when the item was part of
    // an INV_PURCHASE for the same project. Simply remove the item from the
    // purchase (the helper will delete the purchase if empty), then update the
    // item to reflect that it's back in business inventory.
    await this.removeItemFromTransaction(itemId, currentTransactionId, finalAmount)

    // Update item status to inventory and clear transaction linkage for canonical state
    await this.updateItem(itemId, {
      project_id: null,
      inventory_status: 'available',
      transaction_id: null,
      disposition: 'inventory',
      notes: notes
    })

    console.log('✅ Return completed: Purchase → Inventory (same project)')

    // Log successful return (catch errors to prevent cascading failures)
    try {
      await auditService.logAllocationEvent('return', itemId, null, currentTransactionId, {
        action: 'return_completed',
        scenario: 'return_from_purchase',
        from_transaction: currentTransactionId,
        to_status: 'inventory',
        amount: finalAmount
      })
    } catch (auditError) {
      console.warn('⚠️ Failed to log return completion:', auditError)
    }

    // Return the original purchase transaction id (may have been deleted)
    return currentTransactionId
  },

  // Helper: Handle new return (item was already in inventory or no transaction)
  async handleNewReturn(
    itemId: string,
    projectId: string,
    finalAmount: string,
    notes?: string
  ): Promise<string> {
    // Get project name for source field
    let projectName = 'Other'
    try {
      const project = await projectService.getProject(projectId)
      projectName = project?.name || 'Other'
    } catch (error) {
      console.warn('Could not fetch project name for transaction source:', error)
    }

    // Create Sale transaction (project selling TO us)
    const saleTransactionId = `INV_SALE_${projectId}`

    const transactionData = {
      project_id: projectId,
      project_name: null,
      transaction_date: toDateOnlyString(new Date()),
      source: projectName,
      transaction_type: 'To Inventory',  // Project is moving item TO inventory
      payment_method: 'Pending',
      amount: finalAmount,
      budget_category: 'Furnishings',
      notes: notes || 'Transaction for items purchased from project and moved to business inventory',
      status: 'pending' as const,
      reimbursement_type: 'We Owe' as const,  // We owe the client for this purchase
      trigger_event: 'Inventory sale' as const,
      item_ids: [itemId],
      created_by: 'system',
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString()
    }

    const transactionRef = doc(db, 'transactions', saleTransactionId)
    await setDoc(transactionRef, transactionData, { merge: true })

    // Update item status to inventory
    await this.updateItem(itemId, {
      project_id: null,
      inventory_status: 'available',
      transaction_id: saleTransactionId,
      disposition: 'inventory'
    })

    console.log('✅ New return completed: Inventory → Sale')

    // Log successful return (catch errors to prevent cascading failures)
    try {
      await auditService.logAllocationEvent('return', itemId, null, saleTransactionId, {
        action: 'return_completed',
        scenario: 'new_return',
        from_status: 'inventory',
        to_transaction: saleTransactionId,
        amount: finalAmount
      })
    } catch (auditError) {
      console.warn('⚠️ Failed to log return completion:', auditError)
    }

    return saleTransactionId
  },

  // Complete pending transaction (marks as completed and clears transaction_id)
  async completePendingTransaction(
    transactionType: 'sale' | 'buy',
    projectId: string,
    paymentMethod: string
  ): Promise<void> {
    await ensureAuthenticatedForStorage()

    // Determine canonical transaction ID
    const canonicalTransactionId = transactionType === 'sale'
      ? `INV_SALE_${projectId}`
      : `INV_PURCHASE_${projectId}`

    // Get the transaction
    const transactionRef = doc(db, 'transactions', canonicalTransactionId)
    const transactionSnap = await getDoc(transactionRef)

    if (!transactionSnap.exists()) {
      throw new Error('Transaction not found')
    }

    const transactionData = transactionSnap.data()
    const itemIds = transactionData.item_ids || []

    // Complete the transaction
    await updateDoc(transactionRef, {
      status: 'completed',
      payment_method: paymentMethod,
      transaction_date: toDateOnlyString(new Date()),
      last_updated: new Date().toISOString()
    })

    // Clear transaction_id from all linked items
    const batch = writeBatch(db)
    for (const itemId of itemIds) {
      const itemRef = doc(db, 'items', itemId)
      if (transactionType === 'sale') {
        // For sales, keep project_id but clear transaction_id and set status to sold
        batch.update(itemRef, {
          transaction_id: null,
          inventory_status: 'sold',
          last_updated: new Date().toISOString()
        })
      } else {
        // For buys, clear project_id and transaction_id and set status to available
        batch.update(itemRef, {
          project_id: null,
          transaction_id: null,
          inventory_status: 'available',
          last_updated: new Date().toISOString()
        })
      }
    }

    await batch.commit()
  },

  // Helper function to get item by ID
  async getItemById(itemId: string): Promise<Item | null> {
    await ensureAuthenticatedForStorage()

    const itemRef = doc(db, 'items', itemId)
    const itemSnap = await getDoc(itemRef)

    if (itemSnap.exists()) {
      return {
        item_id: itemSnap.id,
        ...itemSnap.data()
      } as Item
    }
    return null
  },

  // Duplicate an existing item (unified collection version)
  async duplicateItem(projectId: string, originalItemId: string): Promise<string> {
    // Get the original item first
    const originalItem = await this.getItemById(originalItemId)
    if (!originalItem) {
      throw new Error('Original item not found')
    }

    const now = new Date()
    const newItemId = `I-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
    const newQrKey = `QR-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`

    // Create duplicate item with new IDs and timestamps
    // Filter out undefined values to avoid Firebase errors
    const duplicatedItem: any = {
      item_id: newItemId,
      description: originalItem.description,
      source: originalItem.source,
      sku: originalItem.sku || '',
      purchase_price: originalItem.purchase_price || '',
      project_price: originalItem.project_price || '',
      market_value: originalItem.market_value || '',
      payment_method: originalItem.payment_method,
      disposition: 'keep', // Default disposition for duplicates
      notes: originalItem.notes,
      space: originalItem.space || '',
      qr_key: newQrKey,
      bookmark: false, // Default bookmark to false for duplicates
      transaction_id: originalItem.transaction_id,
      project_id: projectId,
      date_created: now.toISOString(),
      last_updated: now.toISOString(),
      images: originalItem.images || [] // Copy images from original item
    }

    // Remove any undefined values that might still exist
    Object.keys(duplicatedItem).forEach(key => {
      if (duplicatedItem[key] === undefined) {
        delete duplicatedItem[key]
      }
    })

    // Create the duplicated item
    const itemRef = doc(db, 'items', newItemId)
    await setDoc(itemRef, duplicatedItem)

    return newItemId
  },

  // Create multiple items linked to a transaction (unified collection version)
  async createTransactionItems(
    projectId: string,
    transactionId: string,
    transaction_date: string,
    transactionSource: string,
    items: TransactionItemFormData[],
    taxRatePct?: number
  ): Promise<string[]> {
    const batch = writeBatch(db)
    const createdItemIds: string[] = []
    const now = new Date()

    // Attempt to read the transaction's tax rate once (avoid per-item reads)
    let inheritedTax: number | undefined = undefined
    try {
      if ((taxRatePct === undefined || taxRatePct === null) && transactionId) {
        const txRef = doc(db, 'transactions', transactionId)
        const txSnap = await getDoc(txRef)
        if (txSnap.exists()) {
          const txData: any = txSnap.data()
          if (txData.tax_rate_pct !== undefined && txData.tax_rate_pct !== null) {
            inheritedTax = txData.tax_rate_pct
          }
        }
      }
    } catch (e) {
      // non-fatal - continue without inherited tax
    }

    for (const itemData of items) {
      const itemId = `I-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
      createdItemIds.push(itemId)

      const itemRef = doc(db, 'items', itemId)
      const qrKey = `QR-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`

      const item: any = {
        item_id: itemId,
        description: itemData.description,
        source: transactionSource, // Use transaction source for all items
        sku: itemData.sku || '',
        purchase_price: itemData.purchase_price,
        project_price: itemData.project_price,
        market_value: itemData.market_value || '',
        payment_method: 'Client Card', // Default payment method
        disposition: 'keep',
        notes: itemData.notes,
        qr_key: qrKey,
        bookmark: false,
        transaction_id: transactionId,
        project_id: projectId,
        date_created: transaction_date,
        last_updated: now.toISOString(),
        images: [] // Start with empty images array, will be populated after upload
      }

      // Attach tax rate from explicit arg, otherwise inherited transaction value
      if (taxRatePct !== undefined && taxRatePct !== null) {
        item.tax_rate_pct = taxRatePct
      } else if (inheritedTax !== undefined) {
        item.tax_rate_pct = inheritedTax
      }

      // Cast to Item for downstream callers
      const itemTyped = item as Item

      batch.set(itemRef, itemTyped)
    }

    await batch.commit()
    return createdItemIds
  }
}

// Business Inventory Services (DEPRECATED - use unifiedItemsService instead)
export const businessInventoryService = {
  // Get all business inventory items
  async getBusinessInventoryItems(
    filters?: { status?: string; searchQuery?: string },
    pagination?: PaginationOptions
  ): Promise<Item[]> {
    const itemsRef = collection(db, 'business_inventory')
    let q = query(itemsRef)

    // Apply filters
    if (filters?.status) {
      q = query(q, where('inventory_status', '==', filters.status))
    }

    // Apply sorting and pagination
    q = query(q, orderBy('last_updated', 'desc'))

    if (pagination) {
      q = query(q, limit(pagination.limit))
      if (pagination.page > 0) {
        q = query(q, limit(pagination.page * pagination.limit))
      }
    }

    const querySnapshot = await getDocs(q)

    let items = querySnapshot.docs.map(doc => ({
      item_id: doc.id,
      ...doc.data()
    } as Item))

    // Apply client-side search if needed
    if (filters?.searchQuery) {
      const searchTerm = filters.searchQuery.toLowerCase()
      items = items.filter(item =>
        item.description.toLowerCase().includes(searchTerm) ||
        item.source.toLowerCase().includes(searchTerm) ||
        item.sku.toLowerCase().includes(searchTerm) ||
        item.business_inventory_location?.toLowerCase().includes(searchTerm)
      )
    }

    return items
  },

  // Get single business inventory item
  async getBusinessInventoryItem(itemId: string): Promise<Item | null> {
    const itemRef = doc(db, 'business_inventory', itemId)
    const itemSnap = await getDoc(itemRef)

    if (itemSnap.exists()) {
      return {
        item_id: itemSnap.id,
        ...itemSnap.data()
      } as Item
    }
    return null
  },

  // Duplicate a business inventory item
  async duplicateBusinessInventoryItem(originalItemId: string): Promise<string> {
    // Get the original item first
    const originalItem = await this.getBusinessInventoryItem(originalItemId)
    if (!originalItem) {
      throw new Error('Original business inventory item not found')
    }

    const now = new Date()
    const newItemId = `BI-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
    const newQrKey = `QR-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`

    // Create duplicate item with new IDs and timestamps
    // Filter out undefined values to avoid Firebase errors
    const duplicatedItem: any = {
      item_id: newItemId,
      description: originalItem.description,
      source: originalItem.source,
      sku: originalItem.sku || '',
      purchase_price: originalItem.purchase_price || '',
      project_price: originalItem.project_price || '',
      market_value: originalItem.market_value || '',
      payment_method: originalItem.payment_method,
      disposition: 'keep', // Default disposition for duplicates
      notes: originalItem.notes,
      space: originalItem.space || '',
      qr_key: newQrKey,
      bookmark: false, // Default bookmark to false for duplicates
      inventory_status: 'available', // Default status for duplicates
      business_inventory_location: originalItem.business_inventory_location || '',
      transaction_id: originalItem.transaction_id,
      date_created: now.toISOString(),
      last_updated: now.toISOString(),
      images: originalItem.images || [] // Copy images from original item
    }

    // Remove any undefined values that might still exist
    Object.keys(duplicatedItem).forEach(key => {
      if (duplicatedItem[key] === undefined) {
        delete duplicatedItem[key]
      }
    })

    // Create the duplicated item
    const itemRef = doc(db, 'business_inventory', newItemId)
    await setDoc(itemRef, duplicatedItem)

    return newItemId
  },

  // Create new business inventory item
  async createBusinessInventoryItem(itemData: Omit<Item, 'item_id' | 'date_created' | 'last_updated'>): Promise<string> {
    const itemsRef = collection(db, 'business_inventory')
    const now = new Date()

    const newItem = {
      ...itemData,
      inventory_status: itemData.inventory_status || 'available',
      date_created: now.toISOString(),
      last_updated: now.toISOString()
    }

    const docRef = await addDoc(itemsRef, newItem)
    return docRef.id
  },

  // Update business inventory item
  async updateBusinessInventoryItem(itemId: string, updates: Partial<Item>): Promise<void> {
    const itemRef = doc(db, 'business_inventory', itemId)

    const firebaseUpdates: any = {
      last_updated: new Date().toISOString()
    }

    if (updates.inventory_status !== undefined) firebaseUpdates.inventory_status = updates.inventory_status
    if (updates.business_inventory_location !== undefined) firebaseUpdates.business_inventory_location = updates.business_inventory_location
    if (updates.purchase_price !== undefined) firebaseUpdates.purchase_price = updates.purchase_price
    if (updates.project_price !== undefined) firebaseUpdates.project_price = updates.project_price
    if (updates.description !== undefined) firebaseUpdates.description = updates.description
    if (updates.source !== undefined) firebaseUpdates.source = updates.source
    if (updates.sku !== undefined) firebaseUpdates.sku = updates.sku
    if (updates.market_value !== undefined) firebaseUpdates.market_value = updates.market_value
    if (updates.payment_method !== undefined) firebaseUpdates.payment_method = updates.payment_method
    if (updates.disposition !== undefined) firebaseUpdates.disposition = updates.disposition
    if (updates.notes !== undefined) firebaseUpdates.notes = updates.notes
    if (updates.space !== undefined) firebaseUpdates.space = updates.space
    if (updates.bookmark !== undefined) firebaseUpdates.bookmark = updates.bookmark
    if (updates.images !== undefined) firebaseUpdates.images = updates.images

    await updateDoc(itemRef, firebaseUpdates)
  },

  // Delete business inventory item
  async deleteBusinessInventoryItem(itemId: string): Promise<void> {
    const itemRef = doc(db, 'business_inventory', itemId)
    await deleteDoc(itemRef)
  },

  // Get business inventory statistics
  async getBusinessInventoryStats(): Promise<BusinessInventoryStats> {
    const itemsRef = collection(db, 'business_inventory')
    const snapshot = await getCountFromServer(itemsRef)

    const allItemsQuery = query(itemsRef)
    const allItemsSnap = await getDocs(allItemsQuery)

    let availableItems = 0
    let allocatedItems = 0
    let soldItems = 0

    allItemsSnap.docs.forEach(doc => {
      const data = doc.data()
      switch (data.inventory_status) {
        case 'available':
          availableItems++
          break
        case 'allocated':
          allocatedItems++
          break
        case 'sold':
          soldItems++
          break
      }
    })

    return {
      totalItems: snapshot.data().count,
      availableItems,
      allocatedItems,
      soldItems
    }
  },

  // Subscribe to business inventory items
  subscribeToBusinessInventory(
    callback: (items: Item[]) => void,
    filters?: { status?: string; searchQuery?: string }
  ) {
    const itemsRef = collection(db, 'business_inventory')
    let q = query(itemsRef, orderBy('last_updated', 'desc'))

    if (filters?.status) {
      q = query(q, where('inventory_status', '==', filters.status))
    }

    return onSnapshot(q, (snapshot) => {
      let items = snapshot.docs.map(doc => ({
        item_id: doc.id,
        ...doc.data()
      } as Item))

      // Apply client-side search if needed
      if (filters?.searchQuery) {
        const searchTerm = filters.searchQuery.toLowerCase()
        items = items.filter(item =>
          item.description.toLowerCase().includes(searchTerm) ||
          item.source.toLowerCase().includes(searchTerm) ||
          item.sku.toLowerCase().includes(searchTerm) ||
          item.business_inventory_location?.toLowerCase().includes(searchTerm)
        )
      }

      callback(items)
    })
  },

  // Allocate item to project (creates pending transaction)
  async allocateItemToProject(
    itemId: string,
    projectId: string,
    amount?: string,
    notes?: string
  ): Promise<string> {
    // Get the item to determine the amount if not provided
    const item = await this.getBusinessInventoryItem(itemId)
    if (!item) {
      throw new Error('Business inventory item not found')
    }
    const finalAmount = amount || item.project_price || item.market_value || '0.00'

    // Get project name for the notes
    let projectName = 'Project'
    try {
      const project = await projectService.getProject(projectId)
      projectName = project?.name || 'Project'
    } catch (error) {
      console.warn('Could not fetch project name for transaction notes:', error)
    }

    // Create pending transaction first
    const transactionData = {
      project_id: projectId,
      transaction_date: toDateOnlyString(new Date()),
      source: 'Inventory',  // Project purchasing inventory from 1584
      transaction_type: 'Purchase',  // Project purchasing inventory from 1584
      payment_method: 'Pending',
      amount: finalAmount,
      budget_category: 'Furnishings',
      notes: notes || `${projectName} inventory purchase`,  // Include project name in notes
      created_by: 'system',
      status: 'pending' as const,
      reimbursement_type: 'Client Owes' as const,
      trigger_event: 'Inventory allocation' as const
    }

    const transactionsRef = collection(db, 'projects', projectId, 'transactions')
    const transactionRef = await addDoc(transactionsRef, transactionData)

    // Update item status to allocated and link to transaction
    await this.updateBusinessInventoryItem(itemId, {
      inventory_status: 'allocated',
      transaction_id: transactionRef.id
    })

    return transactionRef.id
  },

  // Batch allocate multiple items to a project
  async batchAllocateItemsToProject(
    itemIds: string[],
    projectId: string,
    allocationData: {
      amount?: string;
      notes?: string;
      space?: string;
    } = {}
  ): Promise<string[]> {
    const batch = writeBatch(db)
    const transactionIds: string[] = []
    const now = new Date()

    // Get the business inventory items first
    const businessItemsRef = collection(db, 'business_inventory')
    const businessItemsQuery = query(businessItemsRef, where('__name__', 'in', itemIds))
    const businessItemsSnapshot = await getDocs(businessItemsQuery)

    if (businessItemsSnapshot.empty) {
      throw new Error('No business inventory items found')
    }

    // Get project name for the notes
    let projectName = 'Project'
    try {
      const project = await projectService.getProject(projectId)
      projectName = project?.name || 'Project'
    } catch (error) {
      console.warn('Could not fetch project name for transaction notes:', error)
    }

    // Create a single transaction for the batch allocation
    const transactionData = {
      project_id: projectId,
      transaction_date: toDateOnlyString(now),
      source: 'Inventory',  // Project purchasing inventory from 1584
      transaction_type: 'Purchase',  // Project purchasing inventory from 1584
      payment_method: 'Pending',
      amount: allocationData.amount || '0.00',
      budget_category: 'Furnishings',
      notes: allocationData.notes || `${projectName} inventory purchase`,  // Include project name in notes
      created_by: 'system',
      status: 'pending' as const,
      reimbursement_type: 'Client Owes' as const,
      trigger_event: 'Inventory allocation' as const
    }

    const transactionsRef = collection(db, 'projects', projectId, 'transactions')
    const transactionRef = doc(transactionsRef)
    batch.set(transactionRef, transactionData)
    transactionIds.push(transactionRef.id)

    // Create project items from business inventory items
    businessItemsSnapshot.docs.forEach((businessItemDoc) => {
      const businessItemData = businessItemDoc.data()

      // Create the item in project collection with specified defaults
      const projectItemId = `I-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
      const projectItemRef = doc(db, 'projects', projectId, 'items', projectItemId)

      const projectItemData = {
        item_id: projectItemId,
        description: businessItemData.description,
        source: businessItemData.source,
        sku: businessItemData.sku,
        project_price: businessItemData.project_price, // 1584 design project price from business inventory
        market_value: businessItemData.market_value || '',
        payment_method: '1584', // Default payment method for allocated items
        disposition: 'keep', // Default disposition for allocated items
        notes: businessItemData.notes,
        space: allocationData.space || '', // Optional space field
        qr_key: `QR-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, // Generate new QR key
        bookmark: false, // Default bookmark to false
        transaction_id: transactionRef.id, // Link to allocation transaction
        project_id: projectId,
        date_created: businessItemData.date_created, // Preserve original date
        last_updated: now.toISOString(),
        images: businessItemData.images || [] // Preserve images
      }

      batch.set(projectItemRef, projectItemData)
    })

    // Mark business inventory items as sold (since they've been moved to project)
    itemIds.forEach(itemId => {
      const itemRef = doc(db, 'business_inventory', itemId)
      batch.update(itemRef, {
        inventory_status: 'sold',
        transaction_id: transactionRef.id,
        last_updated: now.toISOString()
      })
    })

    await batch.commit()

    // Update project metadata
    const currentItems = await unifiedItemsService.getItemsByProject(projectId)
    const currentItemCount = currentItems.length
    await projectService.updateProject(projectId, {
      metadata: {
        totalItems: currentItemCount,
        lastActivity: now
      }
    } as Partial<Project>)

    return transactionIds
  },

  // Return item from project (cancels pending transaction)
    async returnItemFromProject(itemId: string, transactionId: string, projectId: string): Promise<void> {
    // Cancel the pending transaction
    const transactionRef = doc(db, 'projects', projectId, 'transactions', transactionId)
    await updateDoc(transactionRef, {
      status: 'canceled',
      last_updated: new Date().toISOString()
    })

    // Update item status back to available and clear project links
    await this.updateBusinessInventoryItem(itemId, {
      inventory_status: 'available',
      transaction_id: undefined
    })
  },

  // Mark item as sold (completes pending transaction)
  async markItemAsSold(
    itemId: string,
    transactionId: string,
    projectId: string,
    paymentMethod: string
  ): Promise<void> {
    // Complete the pending transaction
    const transactionRef = doc(db, 'projects', projectId, 'transactions', transactionId)
    await updateDoc(transactionRef, {
      status: 'completed',
      transaction_date: toDateOnlyString(new Date()),
      payment_method: paymentMethod,
      last_updated: new Date().toISOString()
    })

    // Update item status to sold and clear project links
    await this.updateBusinessInventoryItem(itemId, {
      inventory_status: 'sold',
      transaction_id: undefined
    })
  },

  // Move item from project back to business inventory (creates "We owe client" transaction)
  async moveItemToBusinessInventory(
    itemId: string,
    projectId: string,
    amount: string,
    notes?: string
  ): Promise<string> {
    // Get the item from project first
    const projectItemsRef = collection(db, 'projects', projectId, 'items')
    const itemQuery = query(projectItemsRef, where('item_id', '==', itemId))
    const itemSnap = await getDocs(itemQuery)

    if (itemSnap.empty) {
      throw new Error('Item not found in project')
    }

    const itemData = itemSnap.docs[0].data()

    // Create "We owe client" transaction
    const transactionData = {
      project_id: projectId,
      transaction_date: toDateOnlyString(new Date()),
      source: 'Client Purchase',
      transaction_type: 'Purchase',
      payment_method: 'Pending',
      amount: amount,
      budget_category: 'Furnishings',
      notes: notes || 'Client-purchased item moved to business inventory',
      created_by: 'system',
      status: 'pending' as const,
      reimbursement_type: 'We Owe' as const,
      trigger_event: 'Purchase from client' as const
    }

    const transactionsRef = collection(db, 'projects', projectId, 'transactions')
    const transactionRef = await addDoc(transactionsRef, transactionData)

    // Create item in business inventory
    const newBusinessItem = {
      description: itemData.description,
      source: itemData.source,
      sku: itemData.sku,
      price: itemData.price,
      market_value: itemData.market_value,
      payment_method: itemData.payment_method,
      disposition: itemData.disposition || 'keep',
      notes: itemData.notes,
      space: itemData.space,
      qr_key: itemData.qr_key,
      bookmark: itemData.bookmark || false,
      inventory_status: 'available' as const,
      business_inventory_location: 'Warehouse - Client Purchase',
      transaction_id: transactionRef.id,
      images: itemData.images || []
    }

    await this.createBusinessInventoryItem(newBusinessItem)

    // Remove item from project
    await deleteDoc(itemSnap.docs[0].ref)

    return transactionRef.id
  }
}

// Deallocation Service - Handles inventory designation automation
export const deallocationService = {
  // Main entry point for handling inventory designation - simplified unified approach
  async handleInventoryDesignation(
    itemId: string,
    projectId: string,
    disposition: string
  ): Promise<void> {
    console.log('🔄 handleInventoryDesignation called:', { itemId, projectId, disposition })

    if (disposition !== 'inventory') {
      console.log('⏭️ Skipping - disposition is not inventory:', disposition)
      return // Only handle 'inventory' disposition
    }

    try {
      console.log('🔍 Getting item details for:', itemId)
      // Get the item details
      const item = await unifiedItemsService.getItemById(itemId)
      if (!item) {
        throw new Error('Item not found')
      }
      console.log('✅ Item found:', item.item_id, 'disposition:', item.disposition, 'project_id:', item.project_id)

      // If the item is currently linked to an INV_PURCHASE for the same project,
      // this is a purchase-reversion: remove it from the purchase and return it
      // to inventory instead of creating an INV_SALE. This prevents creating
      // both INV_PURCHASE and INV_SALE canonical transactions for the same
      // item/project.
      if (item.transaction_id && item.transaction_id.startsWith('INV_PURCHASE_')) {
        const purchaseProjectId = item.transaction_id.replace('INV_PURCHASE_', '')
        if (purchaseProjectId === projectId) {
          console.log('🔁 Detected purchase-reversion: removing from INV_PURCHASE and returning to inventory')

          // Remove item from the existing purchase (will delete if empty)
          await unifiedItemsService.removeItemFromTransaction(item.item_id, item.transaction_id, item.project_price || item.market_value || '0.00')

          // Update the item to reflect it's back in business inventory
          await unifiedItemsService.updateItem(item.item_id, {
            project_id: null,
            inventory_status: 'available',
            transaction_id: null,
            last_updated: new Date().toISOString()
          })

          try {
            await auditService.logAllocationEvent('deallocation', itemId, null, item.transaction_id, {
              action: 'deallocation_completed',
              scenario: 'purchase_reversion',
              from_transaction: item.transaction_id,
              to_status: 'inventory',
              amount: item.project_price || item.market_value || '0.00'
            })
          } catch (auditError) {
            console.warn('⚠️ Failed to log deallocation completion for purchase-reversion:', auditError)
          }

          console.log('✅ Purchase-reversion handled: item returned to inventory without creating INV_SALE')
          return
        }
      }

      // Unified approach: Always create/update a "Sale" transaction for inventory designation (project selling TO us)
      console.log('🏦 Creating/updating Sale transaction for inventory designation')

      // Log deallocation start (catch errors to prevent cascading failures)
      try {
        await (auditService.logAllocationEvent as any)('deallocation', itemId, item.project_id, item.transaction_id, {
          action: 'deallocation_started',
          target_status: 'inventory',
          current_transaction_id: item.transaction_id
        })
      } catch (auditError) {
        console.warn('⚠️ Failed to log deallocation start:', auditError)
      }

      const transactionId = await this.ensureSaleTransaction(
        item,
        projectId,
        'Transaction for items purchased from project and moved to business inventory'
      )

      console.log('📦 Moving item to business inventory...')
      // Update item to move to business inventory and link to transaction
      await unifiedItemsService.updateItem(item.item_id, {
        project_id: null,
        inventory_status: 'available',
        transaction_id: transactionId,
        space: '', // Clear space field when moving to business inventory
        last_updated: new Date().toISOString()
      })

      // Log successful deallocation (catch errors to prevent cascading failures)
      try {
        await auditService.logAllocationEvent('deallocation', itemId, null, transactionId, {
          action: 'deallocation_completed',
          from_project_id: item.project_id,
          to_transaction: transactionId,
          amount: item.project_price || item.market_value || '0.00'
        })
      } catch (auditError) {
        console.warn('⚠️ Failed to log deallocation completion:', auditError)
      }

      console.log('✅ Item moved to business inventory successfully')

      console.log('✅ Deallocation completed successfully')
    } catch (error) {
      console.error('❌ Error handling inventory designation:', error)
      throw error
    }
  },

  // Unified function to ensure a sale transaction exists for inventory designation (follows ALLOCATION_TRANSACTION_LOGIC.md)
  async ensureSaleTransaction(
    item: Item,
    projectId: string,
    additionalNotes?: string
  ): Promise<string | null> {
    console.log('🏦 Creating/updating sale transaction for item:', item.item_id)

    // Get project name for source field
    let projectName = 'Other'
    try {
      const project = await projectService.getProject(projectId)
      projectName = project?.name || 'Other'
    } catch (error) {
      console.warn('Could not fetch project name for transaction source:', error)
    }

    // Defensive check: if the item is still linked to a purchase for this
    // project, treat as purchase-reversion and do not create an INV_SALE.
    if (item.transaction_id && item.transaction_id.startsWith('INV_PURCHASE_')) {
      const purchaseProjectId = item.transaction_id.replace('INV_PURCHASE_', '')
      if (purchaseProjectId === projectId) {
        console.log('ℹ️ ensureSaleTransaction detected existing INV_PURCHASE for same project; performing purchase-reversion instead of creating INV_SALE')

        // Remove the item from the purchase and return to inventory
        await unifiedItemsService.removeItemFromTransaction(item.item_id, item.transaction_id, item.project_price || item.market_value || '0.00')
        await unifiedItemsService.updateItem(item.item_id, {
          project_id: null,
          inventory_status: 'available',
          transaction_id: null,
          last_updated: new Date().toISOString()
        })

        // Return null to indicate no INV_SALE was created
        return null
      }
    }

    const canonicalTransactionId = `INV_SALE_${projectId}`
    console.log('🔑 Canonical transaction ID:', canonicalTransactionId)

    // Check if the canonical transaction already exists (top-level collection)
    const transactionRef = doc(db, 'transactions', canonicalTransactionId)
    const transactionSnap = await getDoc(transactionRef)

    if (transactionSnap.exists()) {
      // Transaction exists - merge the new item and recalculate amount
      console.log('📋 Existing INV_SALE transaction found, updating with new item')
      const existingData = transactionSnap.data()
      const existingItemIds = existingData.item_ids || []
      const updatedItemIds = [...new Set([...existingItemIds, item.item_id])] // Avoid duplicates

      // Get all items to recalculate amount
      const itemsRef = collection(db, 'items')
      const itemsQuery = query(itemsRef, where('__name__', 'in', updatedItemIds))
      const itemsSnapshot = await getDocs(itemsQuery)

      const totalAmount = itemsSnapshot.docs
        .map(doc => doc.data().project_price || doc.data().market_value || '0.00')
        .reduce((sum: number, price: string) => sum + parseFloat(price || '0'), 0)
        .toFixed(2)

      const updatedTransactionData = {
        ...existingData,
        item_ids: updatedItemIds,
        amount: totalAmount,
        notes: additionalNotes || 'Transaction for items purchased from project and moved to business inventory',
        last_updated: new Date().toISOString()
      }

      await setDoc(transactionRef, updatedTransactionData, { merge: true })

      console.log('🔄 Updated INV_SALE transaction with', updatedItemIds.length, 'items, amount:', totalAmount)
    } else {
        // Calculate amount from item for new transaction
      const calculatedAmount = item.project_price || item.market_value || '0.00'

      // New transaction - create Sale transaction (project moving item TO inventory)
      const transactionData = {
        project_id: projectId,
        project_name: null,
        transaction_date: toDateOnlyString(new Date()),
        source: projectName,  // Project name as source (project moving to inventory)
        transaction_type: 'To Inventory',  // Project is moving item TO inventory
        payment_method: 'Pending',
        amount: parseFloat(calculatedAmount || '0').toFixed(2),
        budget_category: 'Furnishings',
        notes: additionalNotes || 'Transaction for items purchased from project and moved to business inventory',
        status: 'pending' as const,
        reimbursement_type: 'We Owe' as const,  // We owe the client for this purchase
        trigger_event: 'Inventory sale' as const,
        item_ids: [item.item_id],
        created_by: 'system',
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString()
      }

      console.log('🆕 Creating new INV_SALE transaction with amount:', transactionData.amount)

      await setDoc(transactionRef, transactionData, { merge: true })
    }

    console.log('✅ Sale transaction created/updated successfully')
    return canonicalTransactionId
  }
}

// Integration Service for Business Inventory and Transactions
export const integrationService = {
  // Allocate business inventory item to project (unified collection)
  async allocateBusinessInventoryToProject(
    itemId: string,
    projectId: string,
    amount?: string,
    notes?: string
  ): Promise<string> {
    return await unifiedItemsService.allocateItemToProject(itemId, projectId, amount, notes)
  },

  // Return item from project to business inventory (unified collection)
  async returnItemToBusinessInventory(
    itemId: string,
    _transactionId: string,
    projectId: string
  ): Promise<void> {
    // Use the canonical return method which creates/updates INV_BUY_<projectId> transaction
    await unifiedItemsService.returnItemFromProject(itemId, projectId)
  },

  // Complete pending transaction and mark item as sold (unified collection)
  async completePendingTransaction(
    _itemId: string,
    _transactionId: string,
    projectId: string,
    paymentMethod: string
  ): Promise<void> {
    // For sales, we need to complete the INV_SALE transaction
    return await unifiedItemsService.completePendingTransaction('sale', projectId, paymentMethod)
  },

  // Handle item deallocation (new method)
  async handleItemDeallocation(
    itemId: string,
    projectId: string,
    disposition: string
  ): Promise<void> {
    return await deallocationService.handleInventoryDesignation(itemId, projectId, disposition)
  }
}
