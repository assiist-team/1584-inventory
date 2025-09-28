import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
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
import type { Item, Project, FilterOptions, PaginationOptions, Transaction, TransactionItemFormData, ItemImage } from '@/types'

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
        resale_price: data.resale_price || data["1584_resale_price"] || '', // Map Firebase field to form field
        market_value: data.market_value, // Direct mapping
        payment_method: data.payment_method,
        disposition: data.disposition,
        notes: data.notes,
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
      "1584_resale_price": itemData.resale_price, // Map form field to Firebase field
      market_value: itemData.market_value, // Direct mapping
      payment_method: itemData.payment_method,
      disposition: itemData.disposition,
      notes: itemData.notes,
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

    if (updates.resale_price !== undefined) {
      firebaseUpdates["1584_resale_price"] = updates.resale_price // Map form field to Firebase field
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
          resale_price: data.resale_price || data["1584_resale_price"] || '', // Map Firebase field to form field
          market_value: data.market_value, // Direct mapping
          payment_method: data.payment_method,
          disposition: data.disposition,
          notes: data.notes,
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
        resale_price: data.resale_price || data["1584_resale_price"] || '', // Map Firebase field to form field
        market_value: data.market_value, // Direct mapping
        payment_method: data.payment_method,
        disposition: data.disposition,
        notes: data.notes,
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

      if (updates.resale_price !== undefined) {
        firebaseUpdates["1584_resale_price"] = updates.resale_price // Map form field to Firebase field
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
        disposition: 'active',
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
        transaction_images: Array.isArray(data.transaction_images) ? data.transaction_images : []
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
        transaction_images: Array.isArray(data.transaction_images) ? data.transaction_images : []
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
        created_at: now.toISOString()
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
          transaction_images: Array.isArray(data.transaction_images) ? data.transaction_images : []
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
          transaction_images: Array.isArray(data.transaction_images) ? data.transaction_images : []
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
  }
}
