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
  getCountFromServer
} from 'firebase/firestore'
import { db, convertTimestamps, ensureAuthenticatedForStorage } from './firebase'
import type { Item, Project, FilterOptions, PaginationOptions, Transaction, TransactionItemFormData, ItemImage, BusinessInventoryItem, BusinessInventoryStats } from '@/types'

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

// Item Services
export const itemService = {
  // Get items for a project with filtering and pagination
  async getItems(
    projectId: string,
    filters?: FilterOptions,
    pagination?: PaginationOptions
  ): Promise<Item[]> {
    const itemsRef = collection(db, 'projects', projectId, 'items')
    let q = query(itemsRef)

    // Apply filters
    if (filters?.status) {
      q = query(q, where('status', '==', filters.status))
    }

    if (filters?.category) {
      q = query(q, where('category', '==', filters.category))
    }

    if (filters?.tags && filters.tags.length > 0) {
      q = query(q, where('tags', 'array-contains-any', filters.tags))
    }

    if (filters?.priceRange) {
      q = query(
        q,
        where('price', '>=', filters.priceRange.min),
        where('price', '<=', filters.priceRange.max)
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
        // This is a simplified pagination - in production you'd use cursor-based pagination
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

  // Get single item
  async getItem(projectId: string, itemId: string): Promise<Item | null> {
    console.log('getItem called with:', { projectId, itemId })

    // Ensure authentication before Firestore operations
    await ensureAuthenticatedForStorage()

    const itemRef = doc(db, 'projects', projectId, 'items', itemId)
    console.log('Document path:', itemRef.path)
    const itemSnap = await getDoc(itemRef)

    if (itemSnap.exists()) {
      const data = itemSnap.data()
      console.log('Raw Firebase data:', data)
      console.log('Images in Firebase:', data.images?.length || 0, 'images')

      const mappedItem = {
        item_id: itemSnap.id,
        description: data.description,
        source: data.source,
        sku: data.sku,
        price: data.price,
        market_value: data.market_value, // Direct mapping
        payment_method: data.payment_method,
        disposition: data.disposition,
        notes: data.notes,
        space: data.space, // Add space field
        qr_key: data.qr_key,
        bookmark: data.bookmark,
        transaction_id: data.transaction_id,
        project_id: data.project_id,
        date_created: data.date_created,
        last_updated: data.last_updated,
        images: data.images || [] // Include images from Firebase
      } as Item

      console.log('Mapped item data:', mappedItem)
      console.log('Mapped images:', mappedItem.images?.length || 0, 'images')
      return mappedItem
    }
    console.log('Document does not exist at path:', itemRef.path)
    console.log('itemSnap.exists():', itemSnap.exists())
    console.log('Item not found')
    return null
  },

  // Create new item
  async createItem(projectId: string, itemData: Omit<Item, 'item_id' | 'date_created' | 'last_updated'>): Promise<string> {
    const itemsRef = collection(db, 'projects', projectId, 'items')
    const now = new Date()

    // Map form fields to Firebase fields
    const newItem = {
      description: itemData.description,
      source: itemData.source,
      sku: itemData.sku,
      price: itemData.price,
      market_value: itemData.market_value, // Direct mapping
      payment_method: itemData.payment_method,
      disposition: itemData.disposition || 'keep', // Default to 'keep' if not provided
      notes: itemData.notes,
      space: itemData.space, // Add space field
      qr_key: itemData.qr_key || `QR-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      bookmark: itemData.bookmark,
      transaction_id: itemData.transaction_id,
      project_id: itemData.project_id,
      date_created: now.toISOString(),
      last_updated: now.toISOString()
    }

    const docRef = await addDoc(itemsRef, newItem)

    // Update project metadata
    await projectService.updateProject(projectId, {
      metadata: {
        totalItems: await itemService.getItemCount(projectId) + 1,
        lastActivity: now
      }
    } as Partial<Project>)

    return docRef.id
  },

  // Update item
  async updateItem(projectId: string, itemId: string, updates: Partial<Item>): Promise<void> {
    const itemRef = doc(db, 'projects', projectId, 'items', itemId)

    // Map form fields to Firebase fields for updates
    const firebaseUpdates: any = {
      last_updated: new Date().toISOString()
    }

    if (updates.market_value !== undefined) {
      firebaseUpdates.market_value = updates.market_value // Direct mapping
    }
    if (updates.description !== undefined) firebaseUpdates.description = updates.description
    if (updates.source !== undefined) firebaseUpdates.source = updates.source
    if (updates.sku !== undefined) firebaseUpdates.sku = updates.sku
    if (updates.price !== undefined) firebaseUpdates.price = updates.price
    if (updates.payment_method !== undefined) firebaseUpdates.payment_method = updates.payment_method
    if (updates.disposition !== undefined) firebaseUpdates.disposition = updates.disposition
    if (updates.notes !== undefined) firebaseUpdates.notes = updates.notes
    if (updates.space !== undefined) firebaseUpdates.space = updates.space // Add space field
    if (updates.bookmark !== undefined) firebaseUpdates.bookmark = updates.bookmark
    if (updates.images !== undefined) {
      console.log('Updating item images:', updates.images?.length, 'images')
      firebaseUpdates.images = updates.images
    }

    console.log('Updating item in database:', itemId, 'with updates:', Object.keys(firebaseUpdates))
    await updateDoc(itemRef, firebaseUpdates)
    console.log('Item updated successfully in database')
  },

  // Add image to item
  async addItemImage(projectId: string, itemId: string, image: ItemImage): Promise<void> {
    const itemRef = doc(db, 'projects', projectId, 'items', itemId)
    const itemSnap = await getDoc(itemRef)

    if (!itemSnap.exists()) {
      throw new Error('Item not found')
    }

    const itemData = itemSnap.data()
    const currentImages = itemData.images || []
    const updatedImages = [...currentImages, image]

    await updateDoc(itemRef, {
      images: updatedImages,
      last_updated: new Date().toISOString()
    })
  },

  // Update item images
  async updateItemImages(projectId: string, itemId: string, images: ItemImage[]): Promise<void> {
    const itemRef = doc(db, 'projects', projectId, 'items', itemId)
    await updateDoc(itemRef, {
      images: images,
      last_updated: new Date().toISOString()
    })
  },

  // Remove image from item
  async removeItemImage(projectId: string, itemId: string, imageUrl: string): Promise<void> {
    const itemRef = doc(db, 'projects', projectId, 'items', itemId)
    const itemSnap = await getDoc(itemRef)

    if (!itemSnap.exists()) {
      throw new Error('Item not found')
    }

    const itemData = itemSnap.data()
    const currentImages = itemData.images || []
    const updatedImages = currentImages.filter((img: ItemImage) => img.url !== imageUrl)

    await updateDoc(itemRef, {
      images: updatedImages,
      last_updated: new Date().toISOString()
    })
  },

  // Set primary image
  async setPrimaryImage(projectId: string, itemId: string, imageUrl: string): Promise<void> {
    const itemRef = doc(db, 'projects', projectId, 'items', itemId)
    const itemSnap = await getDoc(itemRef)

    if (!itemSnap.exists()) {
      throw new Error('Item not found')
    }

    const itemData = itemSnap.data()
    const currentImages = itemData.images || []

    const updatedImages = currentImages.map((img: ItemImage) => ({
      ...img,
      isPrimary: img.url === imageUrl
    }))

    await updateDoc(itemRef, {
      images: updatedImages,
      last_updated: new Date().toISOString()
    })
  },

  // Delete item
  async deleteItem(projectId: string, itemId: string): Promise<void> {
    const itemRef = doc(db, 'projects', projectId, 'items', itemId)
    await deleteDoc(itemRef)

    // Update project metadata
    const now = new Date()
    await projectService.updateProject(projectId, {
      metadata: {
        totalItems: Math.max(0, await itemService.getItemCount(projectId) - 1),
        lastActivity: now
      }
    } as Partial<Project>)
  },

  // Get item count for a project
  async getItemCount(projectId: string): Promise<number> {
    const itemsRef = collection(db, 'projects', projectId, 'items')
    const snapshot = await getCountFromServer(itemsRef)
    return snapshot.data().count
  },

  // Subscribe to items
  subscribeToItems(
    projectId: string,
    callback: (items: Item[]) => void,
    filters?: FilterOptions
  ) {
    const itemsRef = collection(db, 'projects', projectId, 'items')
    let q = query(itemsRef, orderBy('last_updated', 'desc'))

    // Apply server-side filters
    if (filters?.status) {
      q = query(q, where('disposition', '==', filters.status))
    }

    if (filters?.category) {
      q = query(q, where('source', '==', filters.category))
    }

    return onSnapshot(q, (snapshot) => {
      console.log('Real-time items snapshot received:', snapshot.docs.length, 'documents')
      let items = snapshot.docs.map(doc => {
        const data = doc.data()
        const item = {
          item_id: doc.id,
          description: data.description,
          source: data.source,
          sku: data.sku,
          price: data.price,
          market_value: data.market_value, // Direct mapping
          payment_method: data.payment_method,
          disposition: data.disposition,
          notes: data.notes,
          space: data.space, // Add space field
          qr_key: data.qr_key,
          bookmark: data.bookmark,
          transaction_id: data.transaction_id,
          project_id: data.project_id,
          date_created: data.date_created,
          last_updated: data.last_updated,
          images: data.images || [] // Include images from Firebase
        } as Item
        return item
      })

      // Apply client-side filters
      if (filters?.searchQuery) {
        const searchTerm = filters.searchQuery.toLowerCase()
        items = items.filter(item =>
          item.description.toLowerCase().includes(searchTerm) ||
          item.source.toLowerCase().includes(searchTerm) ||
          item.sku.toLowerCase().includes(searchTerm) ||
          item.payment_method.toLowerCase().includes(searchTerm)
        )
      }

      console.log('Real-time items callback with', items.length, 'items')
      callback(items)
    })
  },

  // Search items
  async searchItems(projectId: string, searchQuery: string): Promise<Item[]> {
    if (searchQuery.length < 2) return []

    const itemsRef = collection(db, 'projects', projectId, 'items')
    const q = query(
      itemsRef,
      where('description', '>=', searchQuery.toLowerCase()),
      where('description', '<=', searchQuery.toLowerCase() + '\uf8ff'),
      orderBy('description'),
      limit(20)
    )

    const querySnapshot = await getDocs(q)

    return querySnapshot.docs.map(doc => {
      const data = doc.data()
      return {
        item_id: doc.id,
        description: data.description,
        source: data.source,
        sku: data.sku,
        price: data.price,
        market_value: data.market_value, // Direct mapping
        payment_method: data.payment_method,
        disposition: data.disposition,
        notes: data.notes,
        space: data.space, // Add space field
        qr_key: data.qr_key,
        bookmark: data.bookmark,
        transaction_id: data.transaction_id,
        project_id: data.project_id,
        date_created: data.date_created,
        last_updated: data.last_updated
      } as Item
    })
  },

  // Batch operations
  async batchUpdateItems(projectId: string, itemUpdates: Array<{ id: string; updates: Partial<Item> }>): Promise<void> {
    const batch = writeBatch(db)

    itemUpdates.forEach(({ id, updates }) => {
      const itemRef = doc(db, 'projects', projectId, 'items', id)

      // Map form fields to Firebase fields for batch updates
      const firebaseUpdates: any = {
        last_updated: new Date().toISOString()
      }

      if (updates.market_value !== undefined) {
        firebaseUpdates.market_value = updates.market_value // Direct mapping
      }
      if (updates.description !== undefined) firebaseUpdates.description = updates.description
      if (updates.source !== undefined) firebaseUpdates.source = updates.source
      if (updates.sku !== undefined) firebaseUpdates.sku = updates.sku
      if (updates.price !== undefined) firebaseUpdates.price = updates.price
      if (updates.payment_method !== undefined) firebaseUpdates.payment_method = updates.payment_method
      if (updates.disposition !== undefined) firebaseUpdates.disposition = updates.disposition
      if (updates.notes !== undefined) firebaseUpdates.notes = updates.notes
      if (updates.space !== undefined) firebaseUpdates.space = updates.space // Add space field
      if (updates.bookmark !== undefined) firebaseUpdates.bookmark = updates.bookmark

      batch.update(itemRef, firebaseUpdates)
    })

    await batch.commit()
  },

  // Create multiple items linked to a transaction
  async createTransactionItems(
    projectId: string,
    transactionId: string,
    transactionDate: string,
    transactionSource: string,
    items: TransactionItemFormData[]
  ): Promise<string[]> {
    const batch = writeBatch(db)
    const createdItemIds: string[] = []
    const now = new Date()

    items.forEach((itemData) => {
      const itemId = `I-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
      createdItemIds.push(itemId)

      const itemRef = doc(db, 'projects', projectId, 'items', itemId)
      const qrKey = `QR-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`

      const item = {
        item_id: itemId,
        description: itemData.description,
        source: transactionSource, // Use transaction source for all items
        sku: itemData.sku || '',
        price: itemData.price,
        market_value: itemData.market_value || '',
        payment_method: 'Client Card', // Default payment method
        disposition: 'keep',
        notes: itemData.notes || '',
        qr_key: qrKey,
        bookmark: false,
        transaction_id: transactionId,
        project_id: projectId,
        date_created: transactionDate,
        last_updated: now.toISOString(),
        images: [] // Start with empty images array, will be populated after upload
      } as Item

      batch.set(itemRef, item)
    })

    await batch.commit()

    // Update project metadata
    const itemCount = await itemService.getItemCount(projectId)
    await projectService.updateProject(projectId, {
      metadata: {
        totalItems: itemCount,
        lastActivity: now
      }
    } as Partial<Project>)

    return createdItemIds
  },

  // Get items for a transaction
  async getTransactionItems(projectId: string, transactionId: string): Promise<string[]> {
    const itemsRef = collection(db, 'projects', projectId, 'items')
    const q = query(
      itemsRef,
      where('transaction_id', '==', transactionId),
      orderBy('date_created', 'asc')
    )

    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => doc.id)
  },

  // Add single item to existing transaction
  async addItemToTransaction(
    projectId: string,
    transactionId: string,
    transactionDate: string,
    transactionSource: string,
    itemData: TransactionItemFormData
  ): Promise<string> {
    const now = new Date()

    const itemId = `I-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
    const qrKey = `QR-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`

    const item = {
      item_id: itemId,
      description: itemData.description,
      source: transactionSource,
      sku: itemData.sku || '',
      price: itemData.price,
      market_value: itemData.market_value || '',
      payment_method: 'Client Card', // Default payment method
      disposition: 'keep',
      notes: itemData.notes || '',
      space: '', // Add space field
      qr_key: qrKey,
      bookmark: false,
      transaction_id: transactionId,
      project_id: projectId,
      date_created: transactionDate,
      last_updated: now.toISOString(),
      images: [] // Start with empty images array, will be populated after upload
    } as Item

    // Create the document with the itemId as the document ID
    const itemRef = doc(db, 'projects', projectId, 'items', itemId)
    await setDoc(itemRef, item)

    // Update project metadata
    await projectService.updateProject(projectId, {
      metadata: {
        totalItems: await itemService.getItemCount(projectId) + 1,
        lastActivity: now
      }
    } as Partial<Project>)

    return itemId
  }
}

// Transaction Services
export const transactionService = {
  // Get transactions for a project
  async getTransactions(projectId: string): Promise<Transaction[]> {
    const transactionsRef = collection(db, 'projects', projectId, 'transactions')
    const q = query(transactionsRef, orderBy('created_at', 'desc'))

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

  // Get single transaction
  async getTransaction(projectId: string, transactionId: string): Promise<Transaction | null> {
    const transactionRef = doc(db, 'projects', projectId, 'transactions', transactionId)
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

  // Create new transaction
  async createTransaction(
    projectId: string,
    transactionData: Omit<Transaction, 'transaction_id' | 'created_at'>,
    items?: TransactionItemFormData[]
  ): Promise<string> {
    try {
      const transactionsRef = collection(db, 'projects', projectId, 'transactions')
      const now = new Date()

      const newTransaction = {
        ...transactionData,
        created_at: now.toISOString(),
        // Set default values for new fields if not provided
        status: transactionData.status || 'completed',
        reimbursement_type: transactionData.reimbursement_type || null,
        trigger_event: transactionData.trigger_event || null
      }

      console.log('Creating transaction:', newTransaction)
      console.log('Transaction items:', items)

      const docRef = await addDoc(transactionsRef, newTransaction)
      const transactionId = docRef.id
      console.log('Transaction created successfully:', transactionId)

      // Create items linked to this transaction if provided
      if (items && items.length > 0) {
        console.log('Creating items for transaction:', transactionId)
        const createdItemIds = await itemService.createTransactionItems(
          projectId,
          transactionId,
          transactionData.transaction_date,
          transactionData.source, // Pass transaction source to items
          items
        )
        console.log('Created items:', createdItemIds)
      }

      return transactionId
    } catch (error) {
      console.error('Error creating transaction:', error)
      throw error // Re-throw to preserve original error for debugging
    }
  },

  // Update transaction
  async updateTransaction(projectId: string, transactionId: string, updates: Partial<Transaction>): Promise<void> {
    const transactionRef = doc(db, 'projects', projectId, 'transactions', transactionId)
    await updateDoc(transactionRef, updates)
  },

  // Delete transaction
  async deleteTransaction(projectId: string, transactionId: string): Promise<void> {
    const transactionRef = doc(db, 'projects', projectId, 'transactions', transactionId)
    await deleteDoc(transactionRef)
  },

  // Subscribe to transactions
  subscribeToTransactions(projectId: string, callback: (transactions: Transaction[]) => void) {
    const transactionsRef = collection(db, 'projects', projectId, 'transactions')
    const q = query(transactionsRef, orderBy('created_at', 'desc'))

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

  // Subscribe to single transaction for real-time updates
  subscribeToTransaction(
    projectId: string,
    transactionId: string,
    callback: (transaction: Transaction | null) => void
  ) {
    const transactionRef = doc(db, 'projects', projectId, 'transactions', transactionId)

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
    status: 'pending' | 'completed' | 'cancelled',
    updates?: Partial<Transaction>
  ): Promise<void> {
    const transactionRef = doc(db, 'projects', projectId, 'transactions', transactionId)

    const updateData: any = {
      status: status,
      ...updates
    }

    // Set transaction_date to current time if completing
    if (status === 'completed' && !updates?.transaction_date) {
      updateData.transaction_date = new Date().toISOString()
    }

    await updateDoc(transactionRef, updateData)
  }
}

// Business Inventory Services
export const businessInventoryService = {
  // Get all business inventory items
  async getBusinessInventoryItems(
    filters?: { status?: string; searchQuery?: string },
    pagination?: PaginationOptions
  ): Promise<BusinessInventoryItem[]> {
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
    } as BusinessInventoryItem))

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
  async getBusinessInventoryItem(itemId: string): Promise<BusinessInventoryItem | null> {
    const itemRef = doc(db, 'business_inventory', itemId)
    const itemSnap = await getDoc(itemRef)

    if (itemSnap.exists()) {
      return {
        item_id: itemSnap.id,
        ...itemSnap.data()
      } as BusinessInventoryItem
    }
    return null
  },

  // Create new business inventory item
  async createBusinessInventoryItem(itemData: Omit<BusinessInventoryItem, 'item_id' | 'date_created' | 'last_updated'>): Promise<string> {
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
  async updateBusinessInventoryItem(itemId: string, updates: Partial<BusinessInventoryItem>): Promise<void> {
    const itemRef = doc(db, 'business_inventory', itemId)

    const firebaseUpdates: any = {
      last_updated: new Date().toISOString()
    }

    if (updates.inventory_status !== undefined) firebaseUpdates.inventory_status = updates.inventory_status
    if (updates.current_project_id !== undefined) firebaseUpdates.current_project_id = updates.current_project_id
    if (updates.business_inventory_location !== undefined) firebaseUpdates.business_inventory_location = updates.business_inventory_location
    if (updates.pending_transaction_id !== undefined) firebaseUpdates.pending_transaction_id = updates.pending_transaction_id
    if (updates.description !== undefined) firebaseUpdates.description = updates.description
    if (updates.source !== undefined) firebaseUpdates.source = updates.source
    if (updates.sku !== undefined) firebaseUpdates.sku = updates.sku
    if (updates.price !== undefined) firebaseUpdates.price = updates.price
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
    let pendingItems = 0
    let soldItems = 0

    allItemsSnap.docs.forEach(doc => {
      const data = doc.data()
      switch (data.inventory_status) {
        case 'available':
          availableItems++
          break
        case 'pending':
          pendingItems++
          break
        case 'sold':
          soldItems++
          break
      }
    })

    return {
      totalItems: snapshot.data().count,
      availableItems,
      pendingItems,
      soldItems
    }
  },

  // Subscribe to business inventory items
  subscribeToBusinessInventory(
    callback: (items: BusinessInventoryItem[]) => void,
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
      } as BusinessInventoryItem))

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
    amount: string,
    notes?: string
  ): Promise<string> {
    // Create pending transaction first
    const transactionData = {
      project_id: projectId,
      transaction_date: new Date().toISOString(),
      source: 'Inventory Allocation',
      transaction_type: 'Reimbursement',
      payment_method: 'Pending',
      amount: amount,
      budget_category: 'Furnishings',
      notes: notes || 'Item allocated from business inventory',
      created_by: 'system',
      status: 'pending' as const,
      reimbursement_type: 'Client owes us' as const,
      trigger_event: 'Inventory allocation' as const
    }

    const transactionsRef = collection(db, 'projects', projectId, 'transactions')
    const transactionRef = await addDoc(transactionsRef, transactionData)

    // Update item status to pending and link to transaction
    await this.updateBusinessInventoryItem(itemId, {
      inventory_status: 'pending',
      current_project_id: projectId,
      pending_transaction_id: transactionRef.id
    })

    return transactionRef.id
  },

  // Return item from project (cancels pending transaction)
  async returnItemFromProject(itemId: string, transactionId: string, projectId: string): Promise<void> {
    // Cancel the pending transaction
    const transactionRef = doc(db, 'projects', projectId, 'transactions', transactionId)
    await updateDoc(transactionRef, {
      status: 'cancelled'
    })

    // Update item status back to available and clear project links
    await this.updateBusinessInventoryItem(itemId, {
      inventory_status: 'available',
      current_project_id: undefined,
      pending_transaction_id: undefined
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
      transaction_date: new Date().toISOString(),
      payment_method: paymentMethod
    })

    // Update item status to sold and clear project links
    await this.updateBusinessInventoryItem(itemId, {
      inventory_status: 'sold',
      current_project_id: undefined,
      pending_transaction_id: undefined
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
      transaction_date: new Date().toISOString(),
      source: 'Client Purchase',
      transaction_type: 'Reimbursement',
      payment_method: 'Pending',
      amount: amount,
      budget_category: 'Furnishings',
      notes: notes || 'Client-purchased item moved to business inventory',
      created_by: 'system',
      status: 'pending' as const,
      reimbursement_type: 'We owe client' as const,
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

// Integration Service for Business Inventory and Transactions
export const integrationService = {
  // Allocate business inventory item to project
  async allocateBusinessInventoryToProject(
    itemId: string,
    projectId: string,
    amount: string,
    notes?: string
  ): Promise<string> {
    return await businessInventoryService.allocateItemToProject(itemId, projectId, amount, notes)
  },

  // Return item from project to business inventory
  async returnItemToBusinessInventory(
    itemId: string,
    transactionId: string,
    projectId: string
  ): Promise<void> {
    return await businessInventoryService.returnItemFromProject(itemId, transactionId, projectId)
  },

  // Complete pending transaction and mark item as sold
  async completePendingTransaction(
    itemId: string,
    transactionId: string,
    projectId: string,
    paymentMethod: string
  ): Promise<void> {
    return await businessInventoryService.markItemAsSold(itemId, transactionId, projectId, paymentMethod)
  }
}
