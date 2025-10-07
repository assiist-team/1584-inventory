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
  deleteField
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
        purchase_price: data.purchase_price,
        project_price: data.project_price,
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
      purchase_price: itemData.purchase_price,
      project_price: itemData.project_price,
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

    if (updates.purchase_price !== undefined) firebaseUpdates.purchase_price = updates.purchase_price
    if (updates.project_price !== undefined) firebaseUpdates.project_price = updates.project_price
    if (updates.market_value !== undefined) {
      firebaseUpdates.market_value = updates.market_value // Direct mapping
    }
    if (updates.description !== undefined) firebaseUpdates.description = updates.description
    if (updates.source !== undefined) firebaseUpdates.source = updates.source
    if (updates.sku !== undefined) firebaseUpdates.sku = updates.sku
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
          purchase_price: data.purchase_price,
          project_price: data.project_price,
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
        purchase_price: data.purchase_price,
        project_price: data.project_price,
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

      if (updates.purchase_price !== undefined) firebaseUpdates.purchase_price = updates.purchase_price
      if (updates.project_price !== undefined) firebaseUpdates.project_price = updates.project_price
      if (updates.market_value !== undefined) {
        firebaseUpdates.market_value = updates.market_value // Direct mapping
      }
      if (updates.description !== undefined) firebaseUpdates.description = updates.description
      if (updates.source !== undefined) firebaseUpdates.source = updates.source
      if (updates.sku !== undefined) firebaseUpdates.sku = updates.sku
      if (updates.payment_method !== undefined) firebaseUpdates.payment_method = updates.payment_method
      if (updates.disposition !== undefined) firebaseUpdates.disposition = updates.disposition
      if (updates.notes !== undefined) firebaseUpdates.notes = updates.notes
      if (updates.space !== undefined) firebaseUpdates.space = updates.space // Add space field
      if (updates.bookmark !== undefined) firebaseUpdates.bookmark = updates.bookmark

      batch.update(itemRef, firebaseUpdates)
    })

    await batch.commit()
  },

  // Duplicate an existing item
  async duplicateItem(projectId: string, originalItemId: string): Promise<string> {
    // Get the original item first
    const originalItem = await this.getItem(projectId, originalItemId)
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
      notes: originalItem.notes || '',
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
    const itemRef = doc(db, 'projects', projectId, 'items', newItemId)
    await setDoc(itemRef, duplicatedItem)

    // Update project metadata
    const itemCount = await this.getItemCount(projectId)
    await projectService.updateProject(projectId, {
      metadata: {
        totalItems: itemCount,
        lastActivity: now
      }
    } as Partial<Project>)

    return newItemId
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
        purchase_price: itemData.purchase_price,
        project_price: itemData.project_price,
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
    const itemCount = await this.getItemCount(projectId)
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
      purchase_price: itemData.purchase_price,
      project_price: itemData.project_price,
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

  // Get transaction by ID across all projects (for business inventory)
  async getTransactionById(transactionId: string): Promise<{ transaction: Transaction | null; projectId: string | null }> {
    // Get all projects first
    const projects = await projectService.getProjects()

    // Search through each project's transactions
    for (const project of projects) {
      try {
        const transaction = await this.getTransaction(project.id, transactionId)
        if (transaction) {
          return { transaction, projectId: project.id }
        }
      } catch (error) {
        console.error(`Error searching for transaction ${transactionId} in project ${project.id}:`, error)
      }
    }

    return { transaction: null, projectId: null }
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

    await updateDoc(transactionRef, finalUpdates)
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
      notes: originalItem.notes || '',
      space: originalItem.space || '',
      qr_key: newQrKey,
      bookmark: false, // Default bookmark to false for duplicates
      inventory_status: 'available', // Default status for duplicates
      current_project_id: undefined, // Clear project allocation for duplicates
      business_inventory_location: originalItem.business_inventory_location || '',
      pending_transaction_id: undefined, // Clear pending transaction for duplicates
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
    amount?: string,
    notes?: string
  ): Promise<string> {
    // Get the item to determine the amount if not provided
    const item = await this.getBusinessInventoryItem(itemId)
    if (!item) {
      throw new Error('Business inventory item not found')
    }
    const finalAmount = amount || item.project_price || item.market_value || '0.00'

    // Create pending transaction first
    const transactionData = {
      project_id: projectId,
      transaction_date: new Date().toISOString(),
      source: 'Inventory Allocation',
      transaction_type: 'Reimbursement',
      payment_method: 'Pending',
      amount: finalAmount,
      budget_category: 'Furnishings',
      notes: notes || 'Item allocated from business inventory',
      created_by: 'system',
      status: 'pending' as const,
      reimbursement_type: 'Client Owes' as const,
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

    // Create a single transaction for the batch allocation
    const transactionData = {
      project_id: projectId,
      transaction_date: now.toISOString(),
      source: 'Batch Inventory Allocation',
      transaction_type: 'Reimbursement',
      payment_method: 'Pending',
      amount: allocationData.amount || '0.00',
      budget_category: 'Furnishings',
      notes: allocationData.notes || `Batch allocation of ${itemIds.length} items from business inventory`,
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
        notes: businessItemData.notes || '',
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
        current_project_id: projectId,
        pending_transaction_id: transactionRef.id,
        last_updated: now.toISOString()
      })
    })

    await batch.commit()

    // Update project metadata
    const currentItemCount = await itemService.getItemCount(projectId)
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
  // Main entry point for handling inventory designation
  async handleInventoryDesignation(
    itemId: string,
    projectId: string,
    disposition: string
  ): Promise<void> {
    if (disposition !== 'inventory') {
      return // Only handle 'inventory' disposition
    }

    try {
      // Get the item details
      const item = await itemService.getItem(projectId, itemId)
      if (!item) {
        throw new Error('Item not found')
      }

      // If item has a transaction_id, check if it's an existing allocation scenario
      if (item.transaction_id) {
        await this.handleExistingTransactionCase(item, projectId)
      } else {
        // Handle direct inventory designation scenario
        await this.handleDirectInventoryDesignation(item, projectId)
      }
    } catch (error) {
      console.error('Error handling inventory designation:', error)
      throw error
    }
  },

  // Scenario 1: Existing Transaction Case
  async handleExistingTransactionCase(item: Item, projectId: string): Promise<void> {
    const transactionId = item.transaction_id

    // Get all items sharing the same transaction_id
    const transactionItemIds = await itemService.getTransactionItems(projectId, transactionId)
    const allTransactionItems = await Promise.all(
      transactionItemIds.map(id => itemService.getItem(projectId, id))
    )

    // Check if there's a business inventory item linked to this transaction
    const businessInventoryItem = await this.findBusinessInventoryItemByTransaction(transactionId)

    if (businessInventoryItem) {
      // This is a return of an allocated business item
      await this.handleBusinessInventoryReturn(item, transactionId, projectId, allTransactionItems)
    } else {
      // This is a direct movement to business inventory
      await this.handleDirectInventoryMovement(item, projectId, allTransactionItems)
    }
  },

  // Scenario 2: Direct Inventory Designation
  async handleDirectInventoryDesignation(item: Item, projectId: string): Promise<void> {
    // Check if this is a client-purchased item (payment_method = 'Client Card')
    if (item.payment_method === 'Client Card') {
      // Create a purchase transaction (business buying from client)
      await this.createPurchaseTransaction(item, projectId)
    } else {
      // For business-purchased items, just move to inventory without transaction
      await this.moveToBusinessInventoryDirectly(item, projectId)
    }
  },

  // Find business inventory item linked to a transaction
  async findBusinessInventoryItemByTransaction(transactionId: string): Promise<BusinessInventoryItem | null> {
    const businessItems = await businessInventoryService.getBusinessInventoryItems({})

    return businessItems.find(item =>
      item.pending_transaction_id === transactionId ||
      item.transaction_id === transactionId
    ) || null
  },

  // Handle return of allocated business inventory item
  async handleBusinessInventoryReturn(
    item: Item,
    transactionId: string,
    projectId: string,
    allTransactionItems: Item[]
  ): Promise<void> {
    const itemsBeingReturned = allTransactionItems.filter(i => i.disposition === 'inventory')
    const itemsNotBeingReturned = allTransactionItems.filter(i => i.disposition !== 'inventory')

    if (this.areAllTransactionItemsBeingDeallocated(allTransactionItems)) {
      // Complete deallocation - cancel the entire transaction
      await this.executeAtomicOperation(
        async () => {
          await this.cancelTransactionCompletely(transactionId, projectId)

          // Return all items to business inventory
          for (const returnItem of itemsBeingReturned) {
            const businessItem = await this.findBusinessInventoryItemByTransaction(transactionId)
            if (businessItem) {
              await businessInventoryService.returnItemFromProject(businessItem.item_id, transactionId, projectId)
            }
            // Remove from project
            await itemService.deleteItem(projectId, returnItem.item_id)
          }
        },
        [
          // Rollback: Restore transaction status and amount
          async () => {
            const originalAmount = this.calculateTotalAmount(allTransactionItems)
            await transactionService.updateTransaction(projectId, transactionId, {
              status: 'pending',
              amount: originalAmount
            })
          }
        ]
      )
    } else {
      // Partial deallocation - update transaction amount and return specific items
      await this.executeAtomicOperation(
        async () => {
          const newAmount = this.calculateRemainingAmount(itemsNotBeingReturned)
          await transactionService.updateTransaction(projectId, transactionId, {
            amount: newAmount,
            status: 'pending' // Keep as pending since some items remain
          })

          // Return only the specified items
          for (const returnItem of itemsBeingReturned) {
            const businessItem = await this.findBusinessInventoryItemByTransaction(transactionId)
            if (businessItem) {
              await businessInventoryService.returnItemFromProject(businessItem.item_id, transactionId, projectId)
            }
            // Remove from project
            await itemService.deleteItem(projectId, returnItem.item_id)
          }
        },
        [
          // Rollback: Restore original transaction amount
          async () => {
            const originalAmount = this.calculateTotalAmount(allTransactionItems)
            await transactionService.updateTransaction(projectId, transactionId, {
              amount: originalAmount
            })
          }
        ]
      )
    }
  },

  // Handle direct movement to business inventory (no prior allocation transaction)
  async handleDirectInventoryMovement(
    item: Item,
    projectId: string,
    allTransactionItems: Item[]
  ): Promise<void> {
    const itemsBeingReturned = allTransactionItems.filter(i => i.disposition === 'inventory')

    if (itemsBeingReturned.length === 1) {
      // Single item - create We Owe transaction
      await this.createWeOweTransaction(item, projectId)
      await itemService.deleteItem(projectId, item.item_id)
    } else {
      // Multiple items - bundle into single transaction
      const totalAmount = this.calculateTotalAmount(itemsBeingReturned)
      await this.createBundledWeOweTransaction(itemsBeingReturned, projectId, totalAmount)

      // Remove all returned items from project
      for (const returnItem of itemsBeingReturned) {
        await itemService.deleteItem(projectId, returnItem.item_id)
      }
    }
  },

  // Create purchase transaction for client-purchased items
  async createPurchaseTransaction(item: Item, projectId: string): Promise<void> {
    // Use the existing moveItemToBusinessInventory method for client-purchased items
    await businessInventoryService.moveItemToBusinessInventory(
      item.item_id,
      projectId,
      item.project_price || '0.00',
      'Business purchase from client - item moved to inventory'
    )
  },

  // Move item directly to business inventory (no transaction needed)
  async moveToBusinessInventoryDirectly(item: Item, projectId: string): Promise<void> {
    const businessItemData = {
      description: item.description,
      source: item.source,
      sku: item.sku,
      purchase_price: item.purchase_price,
      project_price: item.project_price,
      market_value: item.market_value,
      payment_method: item.payment_method,
      disposition: 'keep',
      notes: item.notes,
      space: item.space,
      qr_key: item.qr_key,
      bookmark: item.bookmark,
      inventory_status: 'available' as const,
      business_inventory_location: 'Warehouse - Business Purchase',
      date_created: item.date_created,
      last_updated: new Date().toISOString(),
      images: item.images || []
    }

    await businessInventoryService.createBusinessInventoryItem(businessItemData)
    await itemService.deleteItem(projectId, item.item_id)
  },

  // Create We Owe transaction for single item
  async createWeOweTransaction(item: Item, projectId: string): Promise<void> {
    const transactionData = {
      project_id: projectId,
      transaction_date: new Date().toISOString(),
      source: 'Inventory Return',
      transaction_type: 'Reimbursement',
      payment_method: 'Pending',
      amount: item.project_price || '0.00',
      budget_category: 'Furnishings',
      notes: 'Item returned to business inventory',
      created_by: 'system',
      status: 'pending' as const,
      reimbursement_type: 'We Owe' as const,
      trigger_event: 'Inventory return' as const
    }

    await transactionService.createTransaction(projectId, transactionData)
  },

  // Create bundled We Owe transaction for multiple items
  async createBundledWeOweTransaction(items: Item[], projectId: string, totalAmount: string): Promise<void> {
    const transactionData = {
      project_id: projectId,
      transaction_date: new Date().toISOString(),
      source: 'Bulk Inventory Return',
      transaction_type: 'Reimbursement',
      payment_method: 'Pending',
      amount: totalAmount,
      budget_category: 'Furnishings',
      notes: `Bulk return of ${items.length} items to business inventory`,
      created_by: 'system',
      status: 'pending' as const,
      reimbursement_type: 'We Owe' as const,
      trigger_event: 'Inventory return' as const
    }

    await transactionService.createTransaction(projectId, transactionData)
  },

  // Cancel transaction completely
  async cancelTransactionCompletely(transactionId: string, projectId: string): Promise<void> {
    await transactionService.updateTransaction(projectId, transactionId, {
      status: 'cancelled',
      amount: '0.00'
    })
  },

  // Calculate remaining amount for partial deallocation
  calculateRemainingAmount(remainingItems: Item[]): string {
    const total = remainingItems.reduce((sum, item) => {
      const price = this.safeParseCurrency(item.project_price)
      return sum + price
    }, 0)
    return this.formatCurrency(total)
  },

  // Calculate total amount for multiple items
  calculateTotalAmount(items: Item[]): string {
    const total = items.reduce((sum, item) => {
      const price = this.safeParseCurrency(item.project_price)
      return sum + price
    }, 0)
    return this.formatCurrency(total)
  },

  // Helper method for atomic operations with rollback capability
  async executeAtomicOperation<T>(
    operation: () => Promise<T>,
    rollbackOperations: Array<() => Promise<void>> = []
  ): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      // Execute rollback operations in reverse order
      for (const rollback of rollbackOperations.reverse()) {
        try {
          await rollback()
        } catch (rollbackError) {
          console.error('Rollback operation failed:', rollbackError)
        }
      }
      throw error
    }
  },

  // Helper method to safely parse and format currency amounts
  safeParseCurrency(amount: string | undefined | null): number {
    if (!amount) return 0
    const parsed = parseFloat(amount.toString())
    return isNaN(parsed) ? 0 : parsed
  },

  // Helper method to format currency for storage
  formatCurrency(amount: number): string {
    return amount.toFixed(2)
  },

  // Helper method to check if all items in a transaction are being deallocated
  areAllTransactionItemsBeingDeallocated(items: Item[]): boolean {
    return items.every(item => item.disposition === 'inventory')
  },

  // Helper method to check if any items in a transaction are being deallocated
  areAnyTransactionItemsBeingDeallocated(items: Item[]): boolean {
    return items.some(item => item.disposition === 'inventory')
  }
}

// Integration Service for Business Inventory and Transactions
export const integrationService = {
  // Allocate business inventory item to project
  async allocateBusinessInventoryToProject(
    itemId: string,
    projectId: string,
    amount?: string,
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
