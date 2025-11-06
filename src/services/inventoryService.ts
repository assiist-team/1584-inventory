import { supabase, getCurrentUser } from './supabase'
import { convertTimestamps, ensureAuthenticatedForDatabase } from './databaseService'
import { toDateOnlyString } from '@/utils/dateUtils'
import { getTaxPresetById } from './taxPresetsService'
import { CLIENT_OWES_COMPANY, COMPANY_OWES_CLIENT } from '@/constants/company'
import type { Item, Project, FilterOptions, PaginationOptions, Transaction, TransactionItemFormData } from '@/types'

// Audit Logging Service for allocation/de-allocation events
export const auditService = {
  // Log allocation/de-allocation events
  async logAllocationEvent(
    accountId: string,
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

      const { error } = await supabase
        .from('audit_logs')
        .insert({
          account_id: accountId,
          event_type: eventType,
          item_id: itemId,
          project_id: projectId,
          transaction_id: transactionId,
          details: details,
          timestamp: new Date().toISOString(),
          created_at: new Date().toISOString()
        })

      if (error) {
        console.warn('⚠️ Failed to log audit event (non-critical):', error)
      } else {
        console.log(`📋 Audit logged: ${eventType} for item ${itemId}`)
      }
    } catch (error) {
      console.warn('⚠️ Failed to log audit event (non-critical):', error)
      // Don't throw - audit logging failures shouldn't break the main flow
    }
  },

  // Log transaction state changes
  async logTransactionStateChange(
    accountId: string,
    transactionId: string,
    changeType: 'created' | 'updated' | 'deleted',
    oldState?: any,
    newState?: any
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('transaction_audit_logs')
        .insert({
          account_id: accountId,
          transaction_id: transactionId,
          change_type: changeType,
          old_state: oldState || null,
          new_state: newState || null,
          timestamp: new Date().toISOString(),
          created_at: new Date().toISOString()
        })

      if (error) {
        console.warn('⚠️ Failed to log transaction audit (non-critical):', error)
      } else {
        console.log(`📋 Transaction audit logged: ${changeType} for ${transactionId}`)
      }
    } catch (error) {
      console.warn('⚠️ Failed to log transaction audit (non-critical):', error)
      // Don't throw - audit logging failures shouldn't break the main flow
    }
  }
}

// Project Services
export const projectService = {
  // Get all projects for current account
  async getProjects(accountId: string): Promise<Project[]> {
    await ensureAuthenticatedForDatabase()

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('account_id', accountId)
      .order('updated_at', { ascending: false })

    if (error) throw error

    return (data || []).map(project => {
      const converted = convertTimestamps(project)
      return {
        id: converted.id,
        accountId: converted.account_id,
        name: converted.name,
        description: converted.description || '',
        clientName: converted.client_name || '',
        budget: converted.budget ? parseFloat(converted.budget) : undefined,
        designFee: converted.design_fee ? parseFloat(converted.design_fee) : undefined,
        budgetCategories: converted.budget_categories || undefined,
        createdAt: converted.created_at,
        updatedAt: converted.updated_at,
        createdBy: converted.created_by,
        settings: converted.settings || undefined,
        metadata: converted.metadata || undefined,
        itemCount: converted.item_count || 0,
        transactionCount: converted.transaction_count || 0,
        totalValue: converted.total_value ? parseFloat(converted.total_value) : 0
      } as Project
    })
  },

  // Get single project
  async getProject(accountId: string, projectId: string): Promise<Project | null> {
    await ensureAuthenticatedForDatabase()

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('account_id', accountId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw error
    }

    if (!data) return null

    const converted = convertTimestamps(data)
    return {
      id: converted.id,
      accountId: converted.account_id,
      name: converted.name,
      description: converted.description || '',
      clientName: converted.client_name || '',
      budget: converted.budget ? parseFloat(converted.budget) : undefined,
      designFee: converted.design_fee ? parseFloat(converted.design_fee) : undefined,
      budgetCategories: converted.budget_categories || undefined,
      createdAt: converted.created_at,
      updatedAt: converted.updated_at,
      createdBy: converted.created_by,
      settings: converted.settings || undefined,
      metadata: converted.metadata || undefined,
      itemCount: converted.item_count || 0,
      transactionCount: converted.transaction_count || 0,
      totalValue: converted.total_value ? parseFloat(converted.total_value) : 0
    } as Project
  },

  // Create new project
  async createProject(accountId: string, projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    await ensureAuthenticatedForDatabase()

    const { data, error } = await supabase
      .from('projects')
      .insert({
        account_id: accountId,
        name: projectData.name,
        description: projectData.description || null,
        client_name: projectData.clientName || null,
        budget: projectData.budget || null,
        design_fee: projectData.designFee || null,
        budget_categories: projectData.budgetCategories || {},
        settings: projectData.settings || {},
        metadata: projectData.metadata || {},
        created_by: projectData.createdBy,
        item_count: 0,
        transaction_count: 0,
        total_value: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single()

    if (error) throw error
    return data.id
  },

  // Update project
  async updateProject(accountId: string, projectId: string, updates: Partial<Project>): Promise<void> {
    await ensureAuthenticatedForDatabase()

    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.clientName !== undefined) updateData.client_name = updates.clientName
    if (updates.budget !== undefined) updateData.budget = updates.budget
    if (updates.designFee !== undefined) updateData.design_fee = updates.designFee
    if (updates.budgetCategories !== undefined) updateData.budget_categories = updates.budgetCategories
    if (updates.settings !== undefined) updateData.settings = updates.settings
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata

    const { error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', projectId)
      .eq('account_id', accountId)

    if (error) throw error
  },

  // Delete project
  async deleteProject(accountId: string, projectId: string): Promise<void> {
    await ensureAuthenticatedForDatabase()

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('account_id', accountId)

    if (error) throw error
  },

  // Subscribe to projects with real-time updates
  subscribeToProjects(accountId: string, callback: (projects: Project[]) => void) {
    const channel = supabase
      .channel(`projects:${accountId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `account_id=eq.${accountId}`
        },
        async () => {
          // Refetch projects on any change
          try {
            const { data, error } = await supabase
              .from('projects')
              .select('*')
              .eq('account_id', accountId)
              .order('updated_at', { ascending: false })
            
            if (error) {
              console.error('Error fetching projects in subscription:', error)
              return
            }
            
            if (data) {
              const projects = (data || []).map(project => {
                const converted = convertTimestamps(project)
                return {
                  id: converted.id,
                  accountId: converted.account_id,
                  name: converted.name,
                  description: converted.description || '',
                  clientName: converted.client_name || '',
                  budget: converted.budget ? parseFloat(converted.budget) : undefined,
                  designFee: converted.design_fee ? parseFloat(converted.design_fee) : undefined,
                  budgetCategories: converted.budget_categories || undefined,
                  createdAt: converted.created_at,
                  updatedAt: converted.updated_at,
                  createdBy: converted.created_by,
                  settings: converted.settings || undefined,
                  metadata: converted.metadata || undefined,
                  itemCount: converted.item_count || 0,
                  transactionCount: converted.transaction_count || 0,
                  totalValue: converted.total_value ? parseFloat(converted.total_value) : 0
                } as Project
              })
              callback(projects)
            }
          } catch (error) {
            console.error('Error in projects subscription callback:', error)
          }
        }
      )
      .subscribe()

    // Initial fetch
    const fetchProjects = async () => {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('account_id', accountId)
          .order('updated_at', { ascending: false })
        
        if (error) {
          console.error('Error fetching initial projects:', error)
          return
        }
        
        if (data) {
          const projects = (data || []).map(project => {
            const converted = convertTimestamps(project)
            return {
              id: converted.id,
              accountId: converted.account_id,
              name: converted.name,
              description: converted.description || '',
              clientName: converted.client_name || '',
              budget: converted.budget ? parseFloat(converted.budget) : undefined,
              designFee: converted.design_fee ? parseFloat(converted.design_fee) : undefined,
              budgetCategories: converted.budget_categories || undefined,
              createdAt: converted.created_at,
              updatedAt: converted.updated_at,
              createdBy: converted.created_by,
              settings: converted.settings || undefined,
              metadata: converted.metadata || undefined,
              itemCount: converted.item_count || 0,
              transactionCount: converted.transaction_count || 0,
              totalValue: converted.total_value ? parseFloat(converted.total_value) : 0
            } as Project
          })
          callback(projects)
        }
      } catch (error) {
        console.error('Error in initial projects fetch:', error)
      }
    }
    
    fetchProjects()

    return () => {
      channel.unsubscribe()
    }
  }
}

// Item Services (REMOVED - migrated to unifiedItemsService)
// This service was completely removed after successful migration to unified collection

// Transaction Services
export const transactionService = {
  // Get transactions for a project (account-scoped)
  async getTransactions(accountId: string, projectId: string): Promise<Transaction[]> {
    await ensureAuthenticatedForDatabase()

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('account_id', accountId)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map(tx => {
      const converted = convertTimestamps(tx)
      return {
        transaction_id: converted.transaction_id,
        project_id: converted.project_id || undefined,
        project_name: converted.project_name || undefined,
        transaction_date: converted.transaction_date,
        source: converted.source || '',
        transaction_type: converted.transaction_type || '',
        payment_method: converted.payment_method || '',
        amount: converted.amount || '0.00',
        budget_category: converted.budget_category || undefined,
        notes: converted.notes || undefined,
        transaction_images: Array.isArray(converted.transaction_images) ? converted.transaction_images : [],
        receipt_images: Array.isArray(converted.receipt_images) ? converted.receipt_images : [],
        other_images: Array.isArray(converted.other_images) ? converted.other_images : [],
        receipt_emailed: converted.receipt_emailed || false,
        created_at: converted.created_at,
        created_by: converted.created_by || '',
        status: converted.status || 'completed',
        reimbursement_type: converted.reimbursement_type || undefined,
        trigger_event: converted.trigger_event || undefined,
        item_ids: Array.isArray(converted.item_ids) ? converted.item_ids : [],
        tax_rate_preset: converted.tax_rate_preset || undefined,
        tax_rate_pct: converted.tax_rate_pct ? parseFloat(converted.tax_rate_pct) : undefined,
        subtotal: converted.subtotal || undefined
      } as Transaction
    })
  },

  // Get single transaction (account-scoped)
  async getTransaction(accountId: string, _projectId: string, transactionId: string): Promise<Transaction | null> {
    await ensureAuthenticatedForDatabase()

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('account_id', accountId)
      .eq('transaction_id', transactionId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw error
    }

    if (!data) return null

    const converted = convertTimestamps(data)
    return {
      transaction_id: converted.transaction_id,
      project_id: converted.project_id || undefined,
      project_name: converted.project_name || undefined,
      transaction_date: converted.transaction_date,
      source: converted.source || '',
      transaction_type: converted.transaction_type || '',
      payment_method: converted.payment_method || '',
      amount: converted.amount || '0.00',
      budget_category: converted.budget_category || undefined,
      notes: converted.notes || undefined,
      transaction_images: Array.isArray(converted.transaction_images) ? converted.transaction_images : [],
      receipt_images: Array.isArray(converted.receipt_images) ? converted.receipt_images : [],
      other_images: Array.isArray(converted.other_images) ? converted.other_images : [],
      receipt_emailed: converted.receipt_emailed || false,
      created_at: converted.created_at,
      created_by: converted.created_by || '',
      status: converted.status || 'completed',
      reimbursement_type: converted.reimbursement_type || undefined,
      trigger_event: converted.trigger_event || undefined,
      item_ids: Array.isArray(converted.item_ids) ? converted.item_ids : [],
      tax_rate_preset: converted.tax_rate_preset || undefined,
      tax_rate_pct: converted.tax_rate_pct ? parseFloat(converted.tax_rate_pct) : undefined,
      subtotal: converted.subtotal || undefined
    } as Transaction
  },

  // Get transaction by ID across all projects (for business inventory) - account-scoped
  async getTransactionById(accountId: string, transactionId: string): Promise<{ transaction: Transaction | null; projectId: string | null }> {
    await ensureAuthenticatedForDatabase()

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('account_id', accountId)
      .eq('transaction_id', transactionId)
      .single()

    if (error || !data) {
      return { transaction: null, projectId: null }
    }

    const converted = convertTimestamps(data)
    const transaction: Transaction = {
      transaction_id: converted.transaction_id,
      project_id: converted.project_id || undefined,
      project_name: converted.project_name || undefined,
      transaction_date: converted.transaction_date,
      source: converted.source || '',
      transaction_type: converted.transaction_type || '',
      payment_method: converted.payment_method || '',
      amount: converted.amount || '0.00',
      budget_category: converted.budget_category || undefined,
      notes: converted.notes || undefined,
      transaction_images: Array.isArray(converted.transaction_images) ? converted.transaction_images : [],
      receipt_images: Array.isArray(converted.receipt_images) ? converted.receipt_images : [],
      other_images: Array.isArray(converted.other_images) ? converted.other_images : [],
      receipt_emailed: converted.receipt_emailed || false,
      created_at: converted.created_at,
      created_by: converted.created_by || '',
      status: converted.status || 'completed',
      reimbursement_type: converted.reimbursement_type || undefined,
      trigger_event: converted.trigger_event || undefined,
      item_ids: Array.isArray(converted.item_ids) ? converted.item_ids : [],
      tax_rate_preset: converted.tax_rate_preset || undefined,
      tax_rate_pct: converted.tax_rate_pct ? parseFloat(converted.tax_rate_pct) : undefined,
      subtotal: converted.subtotal || undefined
    }

    return {
      transaction,
      projectId: converted.project_id || null
    }
  },

  // Create new transaction (account-scoped)
  async createTransaction(
    accountId: string,
    projectId: string | null | undefined,
    transactionData: Omit<Transaction, 'transaction_id' | 'created_at'>,
    items?: TransactionItemFormData[]
  ): Promise<string> {
    try {
      await ensureAuthenticatedForDatabase()

      // Get current user ID for created_by field
      const currentUser = await getCurrentUser()
      const userId = transactionData.created_by || currentUser?.id || null
      
      if (!userId) {
        throw new Error('User must be authenticated to create transactions')
      }

      const now = new Date()
      // Generate a unique transaction_id (UUID format)
      const transactionId = crypto.randomUUID()

      const newTransaction: any = {
        account_id: accountId,
        transaction_id: transactionId,
        project_id: projectId || null,
        transaction_date: transactionData.transaction_date,
        source: transactionData.source || null,
        transaction_type: transactionData.transaction_type || null,
        payment_method: transactionData.payment_method || null,
        amount: transactionData.amount || '0.00',
        budget_category: transactionData.budget_category || null,
        notes: transactionData.notes || null,
        transaction_images: transactionData.transaction_images || [],
        receipt_images: transactionData.receipt_images || [],
        other_images: transactionData.other_images || [],
        receipt_emailed: transactionData.receipt_emailed || false,
        status: transactionData.status || 'completed',
        reimbursement_type: transactionData.reimbursement_type || null,
        trigger_event: transactionData.trigger_event || null,
        item_ids: transactionData.item_ids || [],
        tax_rate_preset: transactionData.tax_rate_preset || null,
        tax_rate_pct: null,
        subtotal: transactionData.subtotal || null,
        created_by: userId,
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      }

      console.log('Creating transaction:', newTransaction)
      console.log('Transaction items:', items)

      // Apply tax calculation from presets or compute from subtotal when Other
      if (newTransaction.tax_rate_preset) {
        if (newTransaction.tax_rate_preset === 'Other') {
          // Validate subtotal presence and calculate rate
          const amountNum = parseFloat(newTransaction.amount || '0')
          const subtotalNum = parseFloat(newTransaction.subtotal || '0')
          if (isNaN(subtotalNum) || subtotalNum <= 0) {
            throw new Error('Subtotal must be greater than 0 when Tax Rate Preset is Other.')
          }
          if (isNaN(amountNum) || amountNum < subtotalNum) {
            throw new Error('Subtotal cannot exceed the total amount.')
          }
          const rate = ((amountNum - subtotalNum) / subtotalNum) * 100
          newTransaction.tax_rate_pct = Math.round(rate * 10000) / 10000 // 4 decimal places
        } else {
          // Look up preset by ID
          const preset = await getTaxPresetById(accountId, newTransaction.tax_rate_preset)
          if (!preset) {
            throw new Error(`Tax preset with ID '${newTransaction.tax_rate_preset}' not found.`)
          }
          newTransaction.tax_rate_pct = preset.rate
          // Remove subtotal for preset selections
          newTransaction.subtotal = null
        }
      }

      const { error } = await supabase
        .from('transactions')
        .insert(newTransaction)

      if (error) throw error

      console.log('Transaction created successfully:', transactionId)

      // Create items linked to this transaction if provided
      if (items && items.length > 0) {
        console.log('Creating items for transaction:', transactionId)
        // Propagate tax_rate_pct to created items if present on transaction
        const itemsToCreate = items.map(i => ({ ...i }))
        const createdItemIds = await unifiedItemsService.createTransactionItems(
          accountId,
          projectId || '',
          transactionId,
          transactionData.transaction_date,
          transactionData.source, // Pass transaction source to items
          itemsToCreate,
          newTransaction.tax_rate_pct
        )
        console.log('Created items:', createdItemIds)
      }

      return transactionId
    } catch (error) {
      console.error('Error creating transaction:', error)
      throw error // Re-throw to preserve original error for debugging
    }
  },

  // Update transaction (account-scoped)
  async updateTransaction(accountId: string, _projectId: string, transactionId: string, updates: Partial<Transaction>): Promise<void> {
    await ensureAuthenticatedForDatabase()

    // Apply business rules for reimbursement type and status
    const finalUpdates: any = { ...updates }

    // If status is being set to 'completed', clear reimbursement_type
    if (finalUpdates.status === 'completed' && finalUpdates.reimbursement_type !== undefined) {
      finalUpdates.reimbursement_type = null
    }

    // If reimbursement_type is being set to empty string, also clear it
    if (finalUpdates.reimbursement_type === '') {
      finalUpdates.reimbursement_type = null
    }

    // If reimbursement_type is being set to a non-empty value, ensure status is not 'completed'
    if (finalUpdates.reimbursement_type && finalUpdates.status === 'completed') {
      // Set status to 'pending' if reimbursement_type is being set to a non-empty value and status is 'completed'
      finalUpdates.status = 'pending'
    }

    // Filter out undefined values
    const cleanUpdates: any = {}
    Object.keys(finalUpdates).forEach(key => {
      if (finalUpdates[key] !== undefined) {
        cleanUpdates[key] = finalUpdates[key]
      }
    })

    // Apply tax mapping / computation before save
    const processedUpdates: any = { ...cleanUpdates }
    
    if (processedUpdates.tax_rate_preset !== undefined) {
      if (processedUpdates.tax_rate_preset === 'Other') {
        // Compute from provided subtotal and amount if present in updates or existing doc
        const { data: existing } = await supabase
          .from('transactions')
          .select('amount, subtotal')
          .eq('account_id', accountId)
          .eq('transaction_id', transactionId)
          .single()

        const existingData = existing || {}
        const amountVal = processedUpdates.amount !== undefined ? parseFloat(processedUpdates.amount) : parseFloat(existingData.amount || '0')
        const subtotalVal = processedUpdates.subtotal !== undefined ? parseFloat(processedUpdates.subtotal) : parseFloat(existingData.subtotal || '0')
        if (!isNaN(amountVal) && !isNaN(subtotalVal) && subtotalVal > 0 && amountVal >= subtotalVal) {
          const rate = ((amountVal - subtotalVal) / subtotalVal) * 100
          processedUpdates.tax_rate_pct = Math.round(rate * 10000) / 10000
        }
      } else {
        // Look up preset by ID
        try {
          const preset = await getTaxPresetById(accountId, processedUpdates.tax_rate_preset)
          if (preset) {
            processedUpdates.tax_rate_pct = preset.rate
            // Remove subtotal when using presets
            processedUpdates.subtotal = null
          } else {
            console.warn(`Tax preset with ID '${processedUpdates.tax_rate_preset}' not found during update`)
          }
        } catch (e) {
          console.warn('Tax preset lookup failed during update:', e)
        }
      }
    }

    // Convert camelCase to snake_case for database fields
    const dbUpdates: any = {
      updated_at: new Date().toISOString()
    }

    if (processedUpdates.project_id !== undefined) dbUpdates.project_id = processedUpdates.project_id
    if (processedUpdates.project_name !== undefined) dbUpdates.project_name = processedUpdates.project_name
    if (processedUpdates.transaction_date !== undefined) dbUpdates.transaction_date = processedUpdates.transaction_date
    if (processedUpdates.source !== undefined) dbUpdates.source = processedUpdates.source
    if (processedUpdates.transaction_type !== undefined) dbUpdates.transaction_type = processedUpdates.transaction_type
    if (processedUpdates.payment_method !== undefined) dbUpdates.payment_method = processedUpdates.payment_method
    if (processedUpdates.amount !== undefined) dbUpdates.amount = processedUpdates.amount
    if (processedUpdates.budget_category !== undefined) dbUpdates.budget_category = processedUpdates.budget_category
    if (processedUpdates.notes !== undefined) dbUpdates.notes = processedUpdates.notes
    if (processedUpdates.transaction_images !== undefined) dbUpdates.transaction_images = processedUpdates.transaction_images
    if (processedUpdates.receipt_images !== undefined) dbUpdates.receipt_images = processedUpdates.receipt_images
    if (processedUpdates.other_images !== undefined) dbUpdates.other_images = processedUpdates.other_images
    if (processedUpdates.receipt_emailed !== undefined) dbUpdates.receipt_emailed = processedUpdates.receipt_emailed
    if (processedUpdates.status !== undefined) dbUpdates.status = processedUpdates.status
    if (processedUpdates.reimbursement_type !== undefined) dbUpdates.reimbursement_type = processedUpdates.reimbursement_type
    if (processedUpdates.trigger_event !== undefined) dbUpdates.trigger_event = processedUpdates.trigger_event
    if (processedUpdates.item_ids !== undefined) dbUpdates.item_ids = processedUpdates.item_ids
    if (processedUpdates.tax_rate_preset !== undefined) dbUpdates.tax_rate_preset = processedUpdates.tax_rate_preset
    if (processedUpdates.tax_rate_pct !== undefined) dbUpdates.tax_rate_pct = processedUpdates.tax_rate_pct
    if (processedUpdates.subtotal !== undefined) dbUpdates.subtotal = processedUpdates.subtotal

    const { error } = await supabase
      .from('transactions')
      .update(dbUpdates)
      .eq('account_id', accountId)
      .eq('transaction_id', transactionId)

    if (error) throw error

    // If tax_rate_pct is set in updates, propagate to items
    if (processedUpdates.tax_rate_pct !== undefined) {
      try {
        const items = await unifiedItemsService.getItemsForTransaction(accountId, _projectId, transactionId)
        if (items && items.length > 0) {
          // Update each item individually (Supabase batch operations)
          for (const item of items) {
            await unifiedItemsService.updateItem(accountId, item.item_id, {
              tax_rate_pct: processedUpdates.tax_rate_pct
            })
          }
        }
      } catch (e) {
        console.warn('Failed to propagate tax_rate_pct to items:', e)
      }
    }
  },

  // Delete transaction (account-scoped)
  async deleteTransaction(accountId: string, _projectId: string, transactionId: string): Promise<void> {
    await ensureAuthenticatedForDatabase()

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('account_id', accountId)
      .eq('transaction_id', transactionId)

    if (error) throw error
  },

  // Subscribe to transactions with real-time updates
  subscribeToTransactions(accountId: string, projectId: string, callback: (transactions: Transaction[]) => void) {
    const channel = supabase
      .channel(`transactions:${accountId}:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `account_id=eq.${accountId} AND project_id=eq.${projectId}`
        },
        async () => {
          // Refetch transactions on any change
          try {
            const { data, error } = await supabase
              .from('transactions')
              .select('*')
              .eq('account_id', accountId)
              .eq('project_id', projectId)
              .order('created_at', { ascending: false })
            
            if (error) {
              console.error('Error fetching transactions in subscription:', error)
              return
            }
            
            if (data) {
              const transactions = (data || []).map(tx => {
                const converted = convertTimestamps(tx)
                return {
                  transaction_id: converted.transaction_id,
                  project_id: converted.project_id || undefined,
                  project_name: converted.project_name || undefined,
                  transaction_date: converted.transaction_date,
                  source: converted.source || '',
                  transaction_type: converted.transaction_type || '',
                  payment_method: converted.payment_method || '',
                  amount: converted.amount || '0.00',
                  budget_category: converted.budget_category || undefined,
                  notes: converted.notes || undefined,
                  transaction_images: Array.isArray(converted.transaction_images) ? converted.transaction_images : [],
                  receipt_images: Array.isArray(converted.receipt_images) ? converted.receipt_images : [],
                  other_images: Array.isArray(converted.other_images) ? converted.other_images : [],
                  receipt_emailed: converted.receipt_emailed || false,
                  created_at: converted.created_at,
                  created_by: converted.created_by || '',
                  status: converted.status || 'completed',
                  reimbursement_type: converted.reimbursement_type || undefined,
                  trigger_event: converted.trigger_event || undefined,
                  item_ids: Array.isArray(converted.item_ids) ? converted.item_ids : [],
                  tax_rate_preset: converted.tax_rate_preset || undefined,
                  tax_rate_pct: converted.tax_rate_pct ? parseFloat(converted.tax_rate_pct) : undefined,
                  subtotal: converted.subtotal || undefined
                } as Transaction
              })
              callback(transactions)
            }
          } catch (error) {
            console.error('Error in transactions subscription callback:', error)
          }
        }
      )
      .subscribe()

    // Initial fetch
    const fetchTransactions = async () => {
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('account_id', accountId)
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
        
        if (error) {
          console.error('Error fetching initial transactions:', error)
          return
        }
        
        if (data) {
          const transactions = (data || []).map(tx => {
            const converted = convertTimestamps(tx)
            return {
              transaction_id: converted.transaction_id,
              project_id: converted.project_id || undefined,
              project_name: converted.project_name || undefined,
              transaction_date: converted.transaction_date,
              source: converted.source || '',
              transaction_type: converted.transaction_type || '',
              payment_method: converted.payment_method || '',
              amount: converted.amount || '0.00',
              budget_category: converted.budget_category || undefined,
              notes: converted.notes || undefined,
              transaction_images: Array.isArray(converted.transaction_images) ? converted.transaction_images : [],
              receipt_images: Array.isArray(converted.receipt_images) ? converted.receipt_images : [],
              other_images: Array.isArray(converted.other_images) ? converted.other_images : [],
              receipt_emailed: converted.receipt_emailed || false,
              created_at: converted.created_at,
              created_by: converted.created_by || '',
              status: converted.status || 'completed',
              reimbursement_type: converted.reimbursement_type || undefined,
              trigger_event: converted.trigger_event || undefined,
              item_ids: Array.isArray(converted.item_ids) ? converted.item_ids : [],
              tax_rate_preset: converted.tax_rate_preset || undefined,
              tax_rate_pct: converted.tax_rate_pct ? parseFloat(converted.tax_rate_pct) : undefined,
              subtotal: converted.subtotal || undefined
            } as Transaction
          })
          callback(transactions)
        }
      } catch (error) {
        console.error('Error in initial transactions fetch:', error)
      }
    }
    
    fetchTransactions()

    return () => {
      channel.unsubscribe()
    }
  },

  // Subscribe to single transaction for real-time updates
  subscribeToTransaction(
    accountId: string,
    _projectId: string,
    transactionId: string,
    callback: (transaction: Transaction | null) => void
  ) {
    const channel = supabase
      .channel(`transaction:${accountId}:${transactionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `account_id=eq.${accountId} AND transaction_id=eq.${transactionId}`
        },
        async () => {
          // Refetch transaction on any change
          try {
            const { data, error } = await supabase
              .from('transactions')
              .select('*')
              .eq('account_id', accountId)
              .eq('transaction_id', transactionId)
              .single()
            
            if (error) {
              if (error.code === 'PGRST116') {
                // Not found - transaction was deleted
                callback(null)
                return
              }
              console.error('Error fetching transaction in subscription:', error)
              return
            }
            
            if (data) {
              const converted = convertTimestamps(data)
              const transaction: Transaction = {
                transaction_id: converted.transaction_id,
                project_id: converted.project_id || undefined,
                project_name: converted.project_name || undefined,
                transaction_date: converted.transaction_date,
                source: converted.source || '',
                transaction_type: converted.transaction_type || '',
                payment_method: converted.payment_method || '',
                amount: converted.amount || '0.00',
                budget_category: converted.budget_category || undefined,
                notes: converted.notes || undefined,
                transaction_images: Array.isArray(converted.transaction_images) ? converted.transaction_images : [],
                receipt_images: Array.isArray(converted.receipt_images) ? converted.receipt_images : [],
                other_images: Array.isArray(converted.other_images) ? converted.other_images : [],
                receipt_emailed: converted.receipt_emailed || false,
                created_at: converted.created_at,
                created_by: converted.created_by || '',
                status: converted.status || 'completed',
                reimbursement_type: converted.reimbursement_type || undefined,
                trigger_event: converted.trigger_event || undefined,
                item_ids: Array.isArray(converted.item_ids) ? converted.item_ids : [],
                tax_rate_preset: converted.tax_rate_preset || undefined,
                tax_rate_pct: converted.tax_rate_pct ? parseFloat(converted.tax_rate_pct) : undefined,
                subtotal: converted.subtotal || undefined
              }
              callback(transaction)
            } else {
              callback(null)
            }
          } catch (error) {
            console.error('Error in transaction subscription callback:', error)
          }
        }
      )
      .subscribe()

    // Initial fetch
    const fetchTransaction = async () => {
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('account_id', accountId)
          .eq('transaction_id', transactionId)
          .single()
        
        if (error) {
          if (error.code === 'PGRST116') {
            callback(null)
            return
          }
          console.error('Error fetching initial transaction:', error)
          return
        }
        
        if (data) {
          const converted = convertTimestamps(data)
          const transaction: Transaction = {
            transaction_id: converted.transaction_id,
            project_id: converted.project_id || undefined,
            project_name: converted.project_name || undefined,
            transaction_date: converted.transaction_date,
            source: converted.source || '',
            transaction_type: converted.transaction_type || '',
            payment_method: converted.payment_method || '',
            amount: converted.amount || '0.00',
            budget_category: converted.budget_category || undefined,
            notes: converted.notes || undefined,
            transaction_images: Array.isArray(converted.transaction_images) ? converted.transaction_images : [],
            receipt_images: Array.isArray(converted.receipt_images) ? converted.receipt_images : [],
            other_images: Array.isArray(converted.other_images) ? converted.other_images : [],
            receipt_emailed: converted.receipt_emailed || false,
            created_at: converted.created_at,
            created_by: converted.created_by || '',
            status: converted.status || 'completed',
            reimbursement_type: converted.reimbursement_type || undefined,
            trigger_event: converted.trigger_event || undefined,
            item_ids: Array.isArray(converted.item_ids) ? converted.item_ids : [],
            tax_rate_preset: converted.tax_rate_preset || undefined,
            tax_rate_pct: converted.tax_rate_pct ? parseFloat(converted.tax_rate_pct) : undefined,
            subtotal: converted.subtotal || undefined
          }
          callback(transaction)
        } else {
          callback(null)
        }
      } catch (error) {
        console.error('Error in initial transaction fetch:', error)
      }
    }
    
    fetchTransaction()

    return () => {
      channel.unsubscribe()
    }
  },

  // Get pending transactions for a project (account-scoped)
  async getPendingTransactions(accountId: string, projectId: string): Promise<Transaction[]> {
    await ensureAuthenticatedForDatabase()

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('account_id', accountId)
      .eq('project_id', projectId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map(tx => {
      const converted = convertTimestamps(tx)
      return {
        transaction_id: converted.transaction_id,
        project_id: converted.project_id || undefined,
        project_name: converted.project_name || undefined,
        transaction_date: converted.transaction_date,
        source: converted.source || '',
        transaction_type: converted.transaction_type || '',
        payment_method: converted.payment_method || '',
        amount: converted.amount || '0.00',
        budget_category: converted.budget_category || undefined,
        notes: converted.notes || undefined,
        transaction_images: Array.isArray(converted.transaction_images) ? converted.transaction_images : [],
        receipt_images: Array.isArray(converted.receipt_images) ? converted.receipt_images : [],
        other_images: Array.isArray(converted.other_images) ? converted.other_images : [],
        receipt_emailed: converted.receipt_emailed || false,
        created_at: converted.created_at,
        created_by: converted.created_by || '',
        status: converted.status || 'completed',
        reimbursement_type: converted.reimbursement_type || undefined,
        trigger_event: converted.trigger_event || undefined,
        item_ids: Array.isArray(converted.item_ids) ? converted.item_ids : [],
        tax_rate_preset: converted.tax_rate_preset || undefined,
        tax_rate_pct: converted.tax_rate_pct ? parseFloat(converted.tax_rate_pct) : undefined,
        subtotal: converted.subtotal || undefined
      } as Transaction
    })
  },

  // Update transaction status (for completing/cancelling pending transactions) (account-scoped)
  async updateTransactionStatus(
    accountId: string,
    _projectId: string,
    transactionId: string,
    status: 'pending' | 'completed' | 'canceled',
    updates?: Partial<Transaction>
  ): Promise<void> {
    await ensureAuthenticatedForDatabase()

    const updateData: any = {
      status: status,
      updated_at: new Date().toISOString()
    }

    if (updates) {
      if (updates.transaction_date !== undefined) updateData.transaction_date = updates.transaction_date
      if (updates.payment_method !== undefined) updateData.payment_method = updates.payment_method
      if (updates.amount !== undefined) updateData.amount = updates.amount
      if (updates.notes !== undefined) updateData.notes = updates.notes
      // Add other fields as needed
    }

    // Set transaction_date to current time if completing
    if (status === 'completed' && !updates?.transaction_date) {
      updateData.transaction_date = toDateOnlyString(new Date())
    }

    const { error } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('account_id', accountId)
      .eq('transaction_id', transactionId)

    if (error) throw error
  },

  // Utility queries for Business Inventory and reporting (account-scoped)
  async getInventoryRelatedTransactions(accountId: string): Promise<Transaction[]> {
    await ensureAuthenticatedForDatabase()

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('account_id', accountId)
      .in('reimbursement_type', [CLIENT_OWES_COMPANY, COMPANY_OWES_CLIENT])
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map(tx => {
      const converted = convertTimestamps(tx)
      return {
        transaction_id: converted.transaction_id,
        project_id: converted.project_id || undefined,
        project_name: converted.project_name || undefined,
        transaction_date: converted.transaction_date,
        source: converted.source || '',
        transaction_type: converted.transaction_type || '',
        payment_method: converted.payment_method || '',
        amount: converted.amount || '0.00',
        budget_category: converted.budget_category || undefined,
        notes: converted.notes || undefined,
        transaction_images: Array.isArray(converted.transaction_images) ? converted.transaction_images : [],
        receipt_images: Array.isArray(converted.receipt_images) ? converted.receipt_images : [],
        other_images: Array.isArray(converted.other_images) ? converted.other_images : [],
        receipt_emailed: converted.receipt_emailed || false,
        created_at: converted.created_at,
        created_by: converted.created_by || '',
        status: converted.status || 'completed',
        reimbursement_type: converted.reimbursement_type || undefined,
        trigger_event: converted.trigger_event || undefined,
        item_ids: Array.isArray(converted.item_ids) ? converted.item_ids : [],
        tax_rate_preset: converted.tax_rate_preset || undefined,
        tax_rate_pct: converted.tax_rate_pct ? parseFloat(converted.tax_rate_pct) : undefined,
        subtotal: converted.subtotal || undefined
      } as Transaction
    })
  },

  // Get business inventory transactions (project_id == null) (account-scoped)
  async getBusinessInventoryTransactions(accountId: string): Promise<Transaction[]> {
    await ensureAuthenticatedForDatabase()

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('account_id', accountId)
      .is('project_id', null)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map(tx => {
      const converted = convertTimestamps(tx)
      return {
        transaction_id: converted.transaction_id,
        project_id: converted.project_id || undefined,
        project_name: converted.project_name || undefined,
        transaction_date: converted.transaction_date,
        source: converted.source || '',
        transaction_type: converted.transaction_type || '',
        payment_method: converted.payment_method || '',
        amount: converted.amount || '0.00',
        budget_category: converted.budget_category || undefined,
        notes: converted.notes || undefined,
        transaction_images: Array.isArray(converted.transaction_images) ? converted.transaction_images : [],
        receipt_images: Array.isArray(converted.receipt_images) ? converted.receipt_images : [],
        other_images: Array.isArray(converted.other_images) ? converted.other_images : [],
        receipt_emailed: converted.receipt_emailed || false,
        created_at: converted.created_at,
        created_by: converted.created_by || '',
        status: converted.status || 'completed',
        reimbursement_type: converted.reimbursement_type || undefined,
        trigger_event: converted.trigger_event || undefined,
        item_ids: Array.isArray(converted.item_ids) ? converted.item_ids : [],
        tax_rate_preset: converted.tax_rate_preset || undefined,
        tax_rate_pct: converted.tax_rate_pct ? parseFloat(converted.tax_rate_pct) : undefined,
        subtotal: converted.subtotal || undefined
      } as Transaction
    })
  }
}

// Unified Items Collection Services (NEW)
export const unifiedItemsService = {
  // Helper function to convert database item to app format
  _convertItemFromDb(dbItem: any): Item {
    const converted = convertTimestamps(dbItem)
    return {
      item_id: converted.item_id,
      accountId: converted.account_id,
      projectId: converted.project_id || undefined,
      transaction_id: converted.transaction_id || undefined,
      name: converted.name || undefined,
      description: converted.description || '',
      sku: converted.sku || '',
      source: converted.source || '',
      purchase_price: converted.purchase_price || undefined,
      project_price: converted.project_price || undefined,
      market_value: converted.market_value || undefined,
      payment_method: converted.payment_method || '',
      disposition: converted.disposition || undefined,
      notes: converted.notes || undefined,
      space: converted.space || undefined,
      qr_key: converted.qr_key || '',
      bookmark: converted.bookmark || false,
      date_created: converted.date_created || '',
      last_updated: converted.last_updated ? (typeof converted.last_updated === 'string' ? converted.last_updated : converted.last_updated.toISOString()) : '',
      images: Array.isArray(converted.images) ? converted.images : [],
      inventory_status: converted.inventory_status || undefined,
      business_inventory_location: converted.business_inventory_location || undefined,
      tax_rate_pct: converted.tax_rate_pct ? parseFloat(converted.tax_rate_pct) : undefined,
      tax_amount: converted.tax_amount || undefined,
      createdBy: converted.created_by || undefined,
      createdAt: converted.created_at
    } as Item
  },

  // Get items for a project (project_id == projectId) (account-scoped)
  async getItemsByProject(
    accountId: string,
    projectId: string,
    filters?: FilterOptions,
    pagination?: PaginationOptions
  ): Promise<Item[]> {
    await ensureAuthenticatedForDatabase()

    let query = supabase
      .from('items')
      .select('*')
      .eq('account_id', accountId)
      .eq('project_id', projectId)

    // Apply filters
    if (filters?.status) {
      query = query.eq('disposition', filters.status)
    }

    if (filters?.category) {
      query = query.eq('source', filters.category)
    }

    if (filters?.priceRange) {
      query = query.gte('project_price', filters.priceRange.min.toString())
      query = query.lte('project_price', filters.priceRange.max.toString())
    }

    // Apply search (using ilike for case-insensitive search)
    if (filters?.searchQuery) {
      query = query.or(`description.ilike.%${filters.searchQuery}%,source.ilike.%${filters.searchQuery}%,sku.ilike.%${filters.searchQuery}%,payment_method.ilike.%${filters.searchQuery}%`)
    }

    // Apply sorting
    query = query.order('last_updated', { ascending: false })

    // Apply pagination
    if (pagination) {
      const offset = pagination.page > 0 ? (pagination.page - 1) * pagination.limit : 0
      query = query.range(offset, offset + pagination.limit - 1)
    }

    const { data, error } = await query

    if (error) throw error

    return (data || []).map(item => this._convertItemFromDb(item))
  },

  // Subscribe to items for a project with real-time updates
  subscribeToItemsByProject(
    accountId: string,
    projectId: string,
    callback: (items: Item[]) => void,
    filters?: FilterOptions
  ) {
    const channel = supabase
      .channel(`items:${accountId}:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
          filter: `account_id=eq.${accountId} AND project_id=eq.${projectId}`
        },
        async () => {
          // Refetch items on any change
          try {
            let query = supabase
              .from('items')
              .select('*')
              .eq('account_id', accountId)
              .eq('project_id', projectId)

            // Apply filters
            if (filters?.status) {
              query = query.eq('disposition', filters.status)
            }

            if (filters?.category) {
              query = query.eq('source', filters.category)
            }

            if (filters?.priceRange) {
              query = query.gte('project_price', filters.priceRange.min.toString())
              query = query.lte('project_price', filters.priceRange.max.toString())
            }

            // Apply search (using ilike for case-insensitive search)
            if (filters?.searchQuery) {
              query = query.or(`description.ilike.%${filters.searchQuery}%,source.ilike.%${filters.searchQuery}%,sku.ilike.%${filters.searchQuery}%,payment_method.ilike.%${filters.searchQuery}%`)
            }

            // Apply sorting
            query = query.order('last_updated', { ascending: false })

            const { data, error } = await query

            if (error) {
              console.error('Error fetching items in subscription:', error)
              return
            }

            if (data) {
              const items = (data || []).map(item => this._convertItemFromDb(item))
              callback(items)
            }
          } catch (error) {
            console.error('Error in items subscription callback:', error)
          }
        }
      )
      .subscribe()

    // Initial fetch
    const fetchItems = async () => {
      try {
        let query = supabase
          .from('items')
          .select('*')
          .eq('account_id', accountId)
          .eq('project_id', projectId)

        // Apply filters
        if (filters?.status) {
          query = query.eq('disposition', filters.status)
        }

        if (filters?.category) {
          query = query.eq('source', filters.category)
        }

        if (filters?.priceRange) {
          query = query.gte('project_price', filters.priceRange.min.toString())
          query = query.lte('project_price', filters.priceRange.max.toString())
        }

        // Apply search (using ilike for case-insensitive search)
        if (filters?.searchQuery) {
          query = query.or(`description.ilike.%${filters.searchQuery}%,source.ilike.%${filters.searchQuery}%,sku.ilike.%${filters.searchQuery}%,payment_method.ilike.%${filters.searchQuery}%`)
        }

        // Apply sorting
        query = query.order('last_updated', { ascending: false })

        const { data, error } = await query

        if (error) {
          console.error('Error fetching initial items:', error)
          return
        }

        if (data) {
          const items = (data || []).map(item => this._convertItemFromDb(item))
          callback(items)
        }
      } catch (error) {
        console.error('Error in initial items fetch:', error)
      }
    }

    fetchItems()

    return () => {
      channel.unsubscribe()
    }
  },

  // Get business inventory items (project_id == null) (account-scoped)
  async getBusinessInventoryItems(
    accountId: string,
    filters?: { status?: string; searchQuery?: string },
    pagination?: PaginationOptions
  ): Promise<Item[]> {
    await ensureAuthenticatedForDatabase()

    let query = supabase
      .from('items')
      .select('*')
      .eq('account_id', accountId)
      .is('project_id', null)

    // Apply filters
    if (filters?.status) {
      query = query.eq('inventory_status', filters.status)
    }

    // Apply search
    if (filters?.searchQuery) {
      query = query.or(`description.ilike.%${filters.searchQuery}%,source.ilike.%${filters.searchQuery}%,sku.ilike.%${filters.searchQuery}%,business_inventory_location.ilike.%${filters.searchQuery}%`)
    }

    // Apply sorting
    query = query.order('last_updated', { ascending: false })

    // Apply pagination
    if (pagination) {
      const offset = pagination.page > 0 ? (pagination.page - 1) * pagination.limit : 0
      query = query.range(offset, offset + pagination.limit - 1)
    }

    const { data, error } = await query

    if (error) throw error

    return (data || []).map(item => this._convertItemFromDb(item))
  },

  // Subscribe to business inventory items with real-time updates
  subscribeToBusinessInventory(
    accountId: string,
    callback: (items: Item[]) => void,
    filters?: { status?: string; searchQuery?: string }
  ) {
    const channel = supabase
      .channel(`business-inventory:${accountId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
          filter: `account_id=eq.${accountId}`
        },
        async () => {
          // Refetch business inventory items on any change
          try {
            let query = supabase
              .from('items')
              .select('*')
              .eq('account_id', accountId)
              .is('project_id', null)

            // Apply filters
            if (filters?.status) {
              query = query.eq('inventory_status', filters.status)
            }

            // Apply search
            if (filters?.searchQuery) {
              query = query.or(`description.ilike.%${filters.searchQuery}%,source.ilike.%${filters.searchQuery}%,sku.ilike.%${filters.searchQuery}%,business_inventory_location.ilike.%${filters.searchQuery}%`)
            }

            // Apply sorting
            query = query.order('last_updated', { ascending: false })

            const { data, error } = await query

            if (error) {
              console.error('Error fetching business inventory in subscription:', error)
              return
            }

            if (data) {
              const items = (data || []).map(item => this._convertItemFromDb(item))
              callback(items)
            }
          } catch (error) {
            console.error('Error in business inventory subscription callback:', error)
          }
        }
      )
      .subscribe()

    // Initial fetch
    const fetchBusinessInventory = async () => {
      try {
        let query = supabase
          .from('items')
          .select('*')
          .eq('account_id', accountId)
          .is('project_id', null)

        // Apply filters
        if (filters?.status) {
          query = query.eq('inventory_status', filters.status)
        }

        // Apply search
        if (filters?.searchQuery) {
          query = query.or(`description.ilike.%${filters.searchQuery}%,source.ilike.%${filters.searchQuery}%,sku.ilike.%${filters.searchQuery}%,business_inventory_location.ilike.%${filters.searchQuery}%`)
        }

        // Apply sorting
        query = query.order('last_updated', { ascending: false })

        const { data, error } = await query

        if (error) {
          console.error('Error fetching initial business inventory:', error)
          return
        }

        if (data) {
          const items = (data || []).map(item => this._convertItemFromDb(item))
          callback(items)
        }
      } catch (error) {
        console.error('Error in initial business inventory fetch:', error)
      }
    }

    fetchBusinessInventory()

    return () => {
      channel.unsubscribe()
    }
  },

  // Create new item (account-scoped)
  async createItem(accountId: string, itemData: Omit<Item, 'item_id' | 'date_created' | 'last_updated'>): Promise<string> {
    await ensureAuthenticatedForDatabase()

    const now = new Date()
    // Generate a unique item_id (using timestamp + random string format like the original)
    const itemId = `I-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
    const qrKey = `QR-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`

    const newItem: any = {
      account_id: accountId,
      item_id: itemId,
      project_id: itemData.projectId || null,
      transaction_id: itemData.transactionId || null,
      name: itemData.name || null,
      description: itemData.description || '',
      sku: itemData.sku || '',
      source: itemData.source || '',
      purchase_price: itemData.purchase_price || null,
      project_price: itemData.project_price || null,
      market_value: itemData.market_value || null,
      payment_method: itemData.payment_method || '',
      disposition: itemData.disposition || null,
      notes: itemData.notes || null,
      space: itemData.space || null,
      qr_key: itemData.qr_key || qrKey,
      bookmark: itemData.bookmark || false,
      inventory_status: itemData.inventory_status || 'available',
      business_inventory_location: itemData.business_inventory_location || null,
      images: itemData.images || [],
      tax_rate_pct: itemData.tax_rate_pct || null,
      tax_amount: itemData.tax_amount || null,
      date_created: itemData.date_created || toDateOnlyString(now),
      last_updated: now.toISOString(),
      created_by: itemData.createdBy || null,
      created_at: now.toISOString()
    }

    // If item is being created with a transaction_id but missing tax_rate_pct,
    // attempt to read the transaction and inherit its tax_rate_pct.
    try {
      if (newItem.transaction_id && newItem.tax_rate_pct === null) {
        const { data: txData } = await supabase
          .from('transactions')
          .select('tax_rate_pct')
          .eq('account_id', accountId)
          .eq('transaction_id', newItem.transaction_id)
          .single()

        if (txData && txData.tax_rate_pct !== undefined && txData.tax_rate_pct !== null) {
          newItem.tax_rate_pct = txData.tax_rate_pct
        }
      }
    } catch (e) {
      console.warn('Failed to inherit tax_rate_pct when creating item:', e)
    }

    const { error } = await supabase
      .from('items')
      .insert(newItem)

    if (error) throw error

    return itemId
  },

  // Update item (account-scoped)
  async updateItem(accountId: string, itemId: string, updates: Partial<Item>): Promise<void> {
    await ensureAuthenticatedForDatabase()

    const dbUpdates: any = {
      last_updated: new Date().toISOString()
    }

    // Convert camelCase to snake_case for database fields
    if (updates.inventory_status !== undefined) dbUpdates.inventory_status = updates.inventory_status
    if (updates.projectId !== undefined) dbUpdates.project_id = updates.projectId
    if (updates.business_inventory_location !== undefined) dbUpdates.business_inventory_location = updates.business_inventory_location
    if (updates.transactionId !== undefined) dbUpdates.transaction_id = updates.transactionId
    if (updates.purchase_price !== undefined) dbUpdates.purchase_price = updates.purchase_price
    if (updates.project_price !== undefined) dbUpdates.project_price = updates.project_price
    if (updates.description !== undefined) dbUpdates.description = updates.description
    if (updates.source !== undefined) dbUpdates.source = updates.source
    if (updates.sku !== undefined) dbUpdates.sku = updates.sku
    if (updates.market_value !== undefined) dbUpdates.market_value = updates.market_value
    if (updates.payment_method !== undefined) dbUpdates.payment_method = updates.payment_method
    if (updates.disposition !== undefined) dbUpdates.disposition = updates.disposition
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes
    if (updates.space !== undefined) dbUpdates.space = updates.space
    if (updates.bookmark !== undefined) dbUpdates.bookmark = updates.bookmark
    if (updates.images !== undefined) dbUpdates.images = updates.images
    if (updates.tax_rate_pct !== undefined) dbUpdates.tax_rate_pct = updates.tax_rate_pct
    if (updates.tax_amount !== undefined) dbUpdates.tax_amount = updates.tax_amount

    // If transaction_id is being set/changed and caller did not provide tax_rate_pct,
    // attempt to inherit the transaction's tax_rate_pct and include it in the update.
    try {
      const willSetTransaction = updates.transactionId !== undefined && updates.transactionId !== null
      const missingTax = updates.tax_rate_pct === undefined || updates.tax_rate_pct === null
      if (willSetTransaction && missingTax) {
        const txId = updates.transactionId as string
        if (txId) {
          const { data: txData } = await supabase
            .from('transactions')
            .select('tax_rate_pct')
            .eq('account_id', accountId)
            .eq('transaction_id', txId)
            .single()

          if (txData && txData.tax_rate_pct !== undefined && txData.tax_rate_pct !== null) {
            dbUpdates.tax_rate_pct = txData.tax_rate_pct
          }
        }
      }
    } catch (e) {
      console.warn('Failed to inherit tax_rate_pct when updating item:', e)
    }

    const { error } = await supabase
      .from('items')
      .update(dbUpdates)
      .eq('account_id', accountId)
      .eq('item_id', itemId)

    if (error) throw error
  },

  // Delete item (account-scoped)
  async deleteItem(accountId: string, itemId: string): Promise<void> {
    await ensureAuthenticatedForDatabase()

    const { error } = await supabase
      .from('items')
      .delete()
      .eq('account_id', accountId)
      .eq('item_id', itemId)

    if (error) throw error
  },

  // Get items for a transaction (by transaction_id) (account-scoped)
  async getItemsForTransaction(accountId: string, _projectId: string, transactionId: string): Promise<Item[]> {
    await ensureAuthenticatedForDatabase()

    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('account_id', accountId)
      .eq('transaction_id', transactionId)
      .order('date_created', { ascending: true })

    if (error) throw error

    return (data || []).map(item => this._convertItemFromDb(item))
  },

  // Allocate single item to project (follows ALLOCATION_TRANSACTION_LOGIC.md deterministic flows) (account-scoped)
  async allocateItemToProject(
    accountId: string,
    itemId: string,
    projectId: string,
    amount?: string,
    notes?: string,
    space?: string
  ): Promise<string> {
    await ensureAuthenticatedForDatabase()

    // Get the item to determine current state and calculate amount
    const item = await this.getItemById(accountId, itemId)
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
      await auditService.logAllocationEvent(accountId, 'allocation', itemId, item.project_id ?? null, currentTransactionId ?? null, {
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
        return await this.handleSaleToInventoryMove(accountId, itemId, currentTransactionId, projectId, finalAmount, notes, space)
      } else {
        // A.2: Allocate to different project - remove from Sale, add to Purchase (Project Y)
        console.log('📋 Scenario A.2: Item in Sale, allocating to different project')
        return await this.handleSaleToDifferentProjectMove(accountId, itemId, currentTransactionId, projectId, finalAmount, notes, space)
      }
    }

    // Scenario B: Item currently in a Purchase (Project X)
    if (currentTransactionId?.startsWith('INV_PURCHASE_')) {
      const currentProjectId = currentTransactionId.replace('INV_PURCHASE_', '')

      if (currentProjectId === projectId) {
        // B.1: Allocate to same project - remove from Purchase, update amount, delete if empty
        console.log('📋 Scenario B.1: Item in Purchase, allocating to same project')
        return await this.handlePurchaseToInventoryMove(accountId, itemId, currentTransactionId, projectId, finalAmount, notes, space)
      } else {
        // B.2: Allocate to different project - remove from Purchase, add to Sale (Project Y)
        console.log('📋 Scenario B.2: Item in Purchase, allocating to different project')
        return await this.handlePurchaseToDifferentProjectMove(accountId, itemId, currentTransactionId, projectId, finalAmount, notes, space)
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
      return await this.handleInventoryToPurchaseMove(accountId, itemId, projectId, finalAmount, notes, space)
    }

    // Fallback: Unknown scenario, treat as new allocation
    console.log('📋 Fallback: Unknown scenario, treating as new allocation')
    return await this.handleInventoryToPurchaseMove(accountId, itemId, projectId, finalAmount, notes, space)
  },

  // Helper: Handle A.1 - Remove item from Sale (same project)
  async handleSaleToPurchaseMove(
    accountId: string,
    itemId: string,
    currentTransactionId: string,
    projectId: string,
    finalAmount: string,
    notes?: string,
    space?: string
  ): Promise<string> {
    const purchaseTransactionId = `INV_PURCHASE_${projectId}`

    // Remove item from existing Sale transaction
    await this.removeItemFromTransaction(accountId, itemId, currentTransactionId, finalAmount)

    // Add item to Purchase transaction (create if none)
    await this.addItemToTransaction(accountId, itemId, purchaseTransactionId, finalAmount, 'Purchase', 'Inventory allocation', notes)

    // Update item status
    await this.updateItem(accountId, itemId, {
      project_id: projectId,
      inventory_status: 'allocated',
      transaction_id: purchaseTransactionId,
      disposition: 'keep',
      space: space
    })

    console.log('✅ A.1 completed: Sale → Purchase (same project)')

    // Log successful allocation (catch errors to prevent cascading failures)
    try {
      await auditService.logAllocationEvent(accountId, 'allocation', itemId, projectId, purchaseTransactionId, {
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
    accountId: string,
    itemId: string,
    currentTransactionId: string,
    _projectId: string,
    finalAmount: string,
    _notes?: string,
    space?: string
  ): Promise<string> {
    // Remove item from existing Sale transaction
    await this.removeItemFromTransaction(accountId, itemId, currentTransactionId, finalAmount)

    // Update item status to inventory
    // Per A.1: allocate back to the same project without creating an INV_PURCHASE
    // i.e. set the item's project and mark as allocated, but do not attach a
    // purchase transaction.
    await this.updateItem(accountId, itemId, {
      project_id: _projectId,
      inventory_status: 'allocated',
      transaction_id: null,
      disposition: 'keep',
      space: space ?? ''
    })

    console.log('✅ A.1 completed: Sale → Inventory (same project)')

    // Log successful move (catch errors to prevent cascading failures)
    try {
      await auditService.logAllocationEvent(accountId, 'allocation', itemId, _projectId, null, {
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
    accountId: string,
    itemId: string,
    currentTransactionId: string,
    newProjectId: string,
    finalAmount: string,
    notes?: string,
    space?: string
  ): Promise<string> {
    const purchaseTransactionId = `INV_PURCHASE_${newProjectId}`

    // Remove item from existing Sale transaction
    await this.removeItemFromTransaction(accountId, itemId, currentTransactionId, finalAmount)

    // Add item to Purchase transaction for new project (create if none)
    await this.addItemToTransaction(accountId, itemId, purchaseTransactionId, finalAmount, 'Purchase', 'Inventory allocation', notes)

    // Update item status
    await this.updateItem(accountId, itemId, {
      project_id: newProjectId,
      inventory_status: 'allocated',
      transaction_id: purchaseTransactionId,
      disposition: 'keep',
      space: space
    })

    console.log('✅ A.2 completed: Sale → Purchase (different project)')

    // Log successful allocation (catch errors to prevent cascading failures)
    try {
      await auditService.logAllocationEvent(accountId, 'allocation', itemId, newProjectId, purchaseTransactionId, {
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
    accountId: string,
    itemId: string,
    currentTransactionId: string,
    _projectId: string,
    finalAmount: string,
    _notes?: string,
    space?: string
  ): Promise<string> {
    // Remove item from existing Purchase transaction
    await this.removeItemFromTransaction(accountId, itemId, currentTransactionId, finalAmount)

    // Update item status to inventory
    await this.updateItem(accountId, itemId, {
      project_id: null,
      inventory_status: 'available',
      disposition: 'inventory',
      notes: _notes,
      space: space ?? ''
    })

    console.log('✅ B.1 completed: Purchase → Inventory (same project)')

    // Log successful deallocation (catch errors to prevent cascading failures)
    try {
      await auditService.logAllocationEvent(accountId, 'deallocation', itemId, null, 'inventory', {
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
    accountId: string,
    itemId: string,
    currentTransactionId: string,
    newProjectId: string,
    finalAmount: string,
    notes?: string,
    space?: string
  ): Promise<string> {
    const saleTransactionId = `INV_SALE_${newProjectId}`

    // Remove item from existing Purchase transaction
    await this.removeItemFromTransaction(accountId, itemId, currentTransactionId, finalAmount)

    // Add item to Sale transaction for new project (create if none)
    await this.addItemToTransaction(accountId, itemId, saleTransactionId, finalAmount, 'To Inventory', 'Inventory sale', notes)

    // Update item status
    await this.updateItem(accountId, itemId, {
      project_id: null,
      inventory_status: 'available',
      transaction_id: saleTransactionId,
      disposition: 'inventory',
      space: space ?? ''
    })

    console.log('✅ B.2 completed: Purchase → Sale (different project)')

    // Log successful allocation (catch errors to prevent cascading failures)
    try {
      await auditService.logAllocationEvent(accountId, 'allocation', itemId, null, saleTransactionId, {
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
    accountId: string,
    itemId: string,
    projectId: string,
    finalAmount: string,
    notes?: string,
    space?: string
  ): Promise<string> {
    const purchaseTransactionId = `INV_PURCHASE_${projectId}`

    // Add item to Purchase transaction (create if none)
    await this.addItemToTransaction(accountId, itemId, purchaseTransactionId, finalAmount, 'Purchase', 'Inventory allocation', notes)

    // Update item status
    await this.updateItem(accountId, itemId, {
      project_id: projectId,
      inventory_status: 'allocated',
      transaction_id: purchaseTransactionId,
      disposition: 'keep',
      space: space
    })

    console.log('✅ C completed: Inventory → Purchase (new allocation)')

    // Log successful allocation (catch errors to prevent cascading failures)
    try {
      await auditService.logAllocationEvent(accountId, 'allocation', itemId, projectId, purchaseTransactionId, {
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
  async removeItemFromTransaction(accountId: string, itemId: string, transactionId: string, _itemAmount: string): Promise<void> {
    await ensureAuthenticatedForDatabase()

    // Get the transaction
    const { data: transactionData, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('account_id', accountId)
      .eq('transaction_id', transactionId)
      .single()

    if (fetchError || !transactionData) {
      console.warn('⚠️ Transaction not found for removal:', transactionId)
      return
    }

    const existingItemIds = transactionData.item_ids || []
    const updatedItemIds = existingItemIds.filter((id: string) => id !== itemId)

    if (updatedItemIds.length === 0) {
      // No items left - delete transaction
      try {
        const { error: deleteError } = await supabase
          .from('transactions')
          .delete()
          .eq('account_id', accountId)
          .eq('transaction_id', transactionId)

        if (deleteError) throw deleteError

        console.log('🗑️ Deleted empty transaction:', transactionId)

        // Log transaction deletion (catch errors to prevent cascading failures)
        try {
          await auditService.logTransactionStateChange(accountId, transactionId, 'deleted', transactionData, null)
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
        // Get all items to recalculate amount
        const { data: itemsData, error: itemsError } = await supabase
          .from('items')
          .select('project_price, market_value')
          .eq('account_id', accountId)
          .in('item_id', updatedItemIds)

        if (itemsError) throw itemsError

        const totalAmount = (itemsData || [])
          .map(item => item.project_price || item.market_value || '0.00')
          .reduce((sum: number, price: string) => sum + parseFloat(price || '0'), 0)
          .toFixed(2)
        // Prevent negative totals
        const safeAmount = parseFloat(totalAmount) < 0 ? '0.00' : totalAmount

        const updateData = {
          item_ids: updatedItemIds,
          amount: safeAmount,
          updated_at: new Date().toISOString()
        }

        const { error: updateError } = await supabase
          .from('transactions')
          .update(updateData)
          .eq('account_id', accountId)
          .eq('transaction_id', transactionId)

        if (updateError) throw updateError

        console.log('🔄 Updated transaction after removal:', transactionId, 'new amount:', safeAmount)

        // Log transaction update (catch errors to prevent cascading failures)
        try {
          await auditService.logTransactionStateChange(accountId, transactionId, 'updated', transactionData, updateData)
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
    accountId: string,
    itemId: string,
    transactionId: string,
    amount: string,
    transactionType: 'Purchase' | 'Sale' | 'To Inventory',
    triggerEvent: string,
    notes?: string
  ): Promise<void> {
    await ensureAuthenticatedForDatabase()

    // Check if transaction exists
    const { data: existingTransaction, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('account_id', accountId)
      .eq('transaction_id', transactionId)
      .single()

    if (existingTransaction && !fetchError) {
      // Transaction exists - add item and recalculate amount
      try {
        const existingItemIds = existingTransaction.item_ids || []
        const updatedItemIds = [...new Set([...existingItemIds, itemId])] // Avoid duplicates

        // Get all items to recalculate amount
        const { data: itemsData, error: itemsError } = await supabase
          .from('items')
          .select('project_price, market_value')
          .eq('account_id', accountId)
          .in('item_id', updatedItemIds)

        if (itemsError) throw itemsError

        const totalAmount = (itemsData || [])
          .map(item => item.project_price || item.market_value || '0.00')
          .reduce((sum: number, price: string) => sum + parseFloat(price || '0'), 0)
          .toFixed(2)
        // Prevent negative totals
        const safeAmount = parseFloat(totalAmount) < 0 ? '0.00' : totalAmount

        const updateData = {
          item_ids: updatedItemIds,
          amount: safeAmount,
          updated_at: new Date().toISOString()
        }

        const { error: updateError } = await supabase
          .from('transactions')
          .update(updateData)
          .eq('account_id', accountId)
          .eq('transaction_id', transactionId)

        if (updateError) throw updateError

        console.log('🔄 Added item to existing transaction:', transactionId, 'new amount:', safeAmount)

        // Log transaction update (catch errors to prevent cascading failures)
        try {
          await auditService.logTransactionStateChange(accountId, transactionId, 'updated', existingTransaction, updateData)
        } catch (auditError) {
          console.warn('⚠️ Failed to log transaction update:', auditError)
        }

        // If the transaction has a tax rate, propagate it to the added item
        try {
          const txTax = existingTransaction.tax_rate_pct
          if (txTax !== undefined && txTax !== null) {
            await this.updateItem(accountId, itemId, {
              tax_rate_pct: txTax
            })
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
        // Get current user ID for created_by field
        const currentUser = await getCurrentUser()
        if (!currentUser?.id) {
          throw new Error('User must be authenticated to create transactions')
        }

        const projectId = transactionId.replace(transactionType === 'Purchase' ? 'INV_PURCHASE_' : 'INV_SALE_', '')
        const project = await projectService.getProject(accountId, projectId)
        const projectName = project?.name || 'Other'

        const now = new Date()
        const transactionData = {
          account_id: accountId,
          transaction_id: transactionId,
          project_id: projectId,
          project_name: null,
          transaction_date: toDateOnlyString(now),
          source: transactionType === 'Purchase' ? 'Inventory' : projectName,
          transaction_type: transactionType,
          payment_method: 'Pending',
          amount: amount,
          budget_category: 'Furnishings',
          notes: notes || `Transaction for items ${transactionType === 'Purchase' ? 'purchased from' : 'sold to'} ${transactionType === 'Purchase' ? 'inventory' : 'project'}`,
          status: 'pending' as const,
          reimbursement_type: transactionType === 'Purchase' ? CLIENT_OWES_COMPANY : COMPANY_OWES_CLIENT,
          trigger_event: triggerEvent,
          item_ids: [itemId],
          created_by: currentUser.id,
          created_at: now.toISOString(),
          updated_at: now.toISOString()
        }

        const { error: insertError } = await supabase
          .from('transactions')
          .insert(transactionData)

        if (insertError) throw insertError

        console.log('🆕 Created new transaction:', transactionId, 'amount:', amount)

        // Log transaction creation (catch errors to prevent cascading failures)
        try {
          await auditService.logTransactionStateChange(accountId, transactionId, 'created', null, transactionData)
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
    accountId: string,
    itemIds: string[],
    projectId: string,
    allocationData: {
      amount?: string;
      notes?: string;
      space?: string;
    } = {}
  ): Promise<string> {
    await ensureAuthenticatedForDatabase()

    // Fetch the requested items by id (inspect transaction_id per-item to
    // implement A.1 vs A.2 decisions). Do NOT rely solely on project_id.
    const { data: itemsData, error: itemsError } = await supabase
      .from('items')
      .select('*')
      .eq('account_id', accountId)
      .in('item_id', itemIds)

    if (itemsError || !itemsData || itemsData.length === 0) {
      throw new Error('No items found for allocation')
    }

    const canonicalTransactionId = `INV_PURCHASE_${projectId}`

    // Process each item individually so we can apply A.1/A.2 rules per item.
    for (const itemData of itemsData) {
      const itemId = itemData.item_id
      const finalAmount = allocationData.amount || itemData.project_price || itemData.market_value || '0.00'
      const currentTransactionId: string | null = itemData.transaction_id || null

      // Scenario A: Item currently in a Sale (Project X)
      if (currentTransactionId?.startsWith('INV_SALE_')) {
        const saleProjectId = currentTransactionId.replace('INV_SALE_', '')

        if (saleProjectId === projectId) {
          // A.1: Remove item from Sale and DO NOT add to Purchase. Assign back to
          // the same project (mark allocated) but do not create an INV_PURCHASE.
          console.log('📋 Batch A.1: Item in sale for target project — removing from sale and assigning to project', itemId)
          await this.removeItemFromTransaction(accountId, itemId, currentTransactionId, finalAmount)
          await this.updateItem(accountId, itemId, {
            project_id: projectId,
            inventory_status: 'allocated',
            transaction_id: null,
            disposition: 'keep',
            notes: allocationData.notes,
            space: allocationData.space || ''
          })
          continue
        } else {
          // A.2: Remove from Sale then add to Purchase for target project
          console.log('📋 Batch A.2: Item in sale for different project — moving to purchase for target project', itemId)
          await this.removeItemFromTransaction(accountId, itemId, currentTransactionId, finalAmount)
          await this.addItemToTransaction(accountId, itemId, canonicalTransactionId, finalAmount, 'Purchase', 'Inventory allocation', allocationData.notes)
          await this.updateItem(accountId, itemId, {
            project_id: projectId,
            inventory_status: 'allocated',
            transaction_id: canonicalTransactionId,
            disposition: 'keep',
            space: allocationData.space || ''
          })
          continue
        }
      }

      // Scenario C: Item in Inventory (no transaction_id) — add to Purchase
      if (!currentTransactionId) {
        console.log('📋 Batch C: Item in inventory — adding to purchase', itemId)
        await this.addItemToTransaction(accountId, itemId, canonicalTransactionId, finalAmount, 'Purchase', 'Inventory allocation', allocationData.notes)
        await this.updateItem(accountId, itemId, {
          project_id: projectId,
          inventory_status: 'allocated',
          transaction_id: canonicalTransactionId,
          disposition: 'keep',
          space: allocationData.space || ''
        })
        continue
      }

      // Fallback: other transaction types — add to purchase and update item
      console.log('📋 Batch Fallback: Item in other transaction — adding to purchase', itemId, currentTransactionId)
      await this.addItemToTransaction(accountId, itemId, canonicalTransactionId, finalAmount, 'Purchase', 'Inventory allocation', allocationData.notes)
      await this.updateItem(accountId, itemId, {
        project_id: projectId,
        inventory_status: 'allocated',
        transaction_id: canonicalTransactionId,
        disposition: 'keep',
        space: allocationData.space || ''
      })
    }

    return canonicalTransactionId
  },

  // Return item from project (follows ALLOCATION_TRANSACTION_LOGIC.md deterministic flows)
  async returnItemFromProject(
    accountId: string,
    itemId: string,
    projectId: string,
    amount?: string,
    notes?: string
  ): Promise<string> {
    await ensureAuthenticatedForDatabase()

    // Get the item to determine current state
    const item = await this.getItemById(accountId, itemId)
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
      await auditService.logAllocationEvent(accountId, 'return', itemId, item.project_id ?? null, currentTransactionId ?? null, {
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
        return await this.handleReturnFromPurchase(accountId, itemId, currentTransactionId, projectId, finalAmount, notes)
      }
    }

    // If item is not in any transaction or is in inventory, this is a new return
    console.log('📋 Return Scenario: Item not in transaction or new return')
    return await this.handleNewReturn(accountId, itemId, projectId, finalAmount, notes)
  },

  // Helper: Handle return from Purchase transaction (same project)
  async handleReturnFromPurchase(
    accountId: string,
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
    await this.removeItemFromTransaction(accountId, itemId, currentTransactionId, finalAmount)

    // Update item status to inventory and clear transaction linkage for canonical state
    await this.updateItem(accountId, itemId, {
      project_id: null,
      inventory_status: 'available',
      transaction_id: null,
      disposition: 'inventory',
      notes: notes
    })

    console.log('✅ Return completed: Purchase → Inventory (same project)')

    // Log successful return (catch errors to prevent cascading failures)
    try {
      await auditService.logAllocationEvent(accountId, 'return', itemId, null, currentTransactionId, {
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
    accountId: string,
    itemId: string,
    projectId: string,
    finalAmount: string,
    notes?: string
  ): Promise<string> {
    await ensureAuthenticatedForDatabase()

    // Get current user ID for created_by field
    const currentUser = await getCurrentUser()
    if (!currentUser?.id) {
      throw new Error('User must be authenticated to create transactions')
    }

    // Get project name for source field
    let projectName = 'Other'
    try {
      const project = await projectService.getProject(accountId, projectId)
      projectName = project?.name || 'Other'
    } catch (error) {
      console.warn('Could not fetch project name for transaction source:', error)
    }

    // Create Sale transaction (project selling TO us)
    const saleTransactionId = `INV_SALE_${projectId}`

    const now = new Date()
    const transactionData = {
      account_id: accountId,
      transaction_id: saleTransactionId,
      project_id: projectId,
      project_name: null,
      transaction_date: toDateOnlyString(now),
      source: projectName,
      transaction_type: 'To Inventory',  // Project is moving item TO inventory
      payment_method: 'Pending',
      amount: finalAmount,
      budget_category: 'Furnishings',
      notes: notes || 'Transaction for items purchased from project and moved to business inventory',
      status: 'pending' as const,
      reimbursement_type: COMPANY_OWES_CLIENT,  // We owe the client for this purchase
      trigger_event: 'Inventory sale' as const,
      item_ids: [itemId],
      created_by: currentUser.id,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    }

    // Use upsert to create or update the transaction
    const { error: upsertError } = await supabase
      .from('transactions')
      .upsert(transactionData, { onConflict: 'transaction_id' })

    if (upsertError) throw upsertError

    // Update item status to inventory
    await this.updateItem(accountId, itemId, {
      project_id: null,
      inventory_status: 'available',
      transaction_id: saleTransactionId,
      disposition: 'inventory'
    })

    console.log('✅ New return completed: Inventory → Sale')

    // Log successful return (catch errors to prevent cascading failures)
    try {
      await auditService.logAllocationEvent(accountId, 'return', itemId, null, saleTransactionId, {
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
    accountId: string,
    transactionType: 'sale' | 'buy',
    projectId: string,
    paymentMethod: string
  ): Promise<void> {
    await ensureAuthenticatedForDatabase()

    // Determine canonical transaction ID
    const canonicalTransactionId = transactionType === 'sale'
      ? `INV_SALE_${projectId}`
      : `INV_PURCHASE_${projectId}`

    // Get the transaction
    const { data: transactionData, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('account_id', accountId)
      .eq('transaction_id', canonicalTransactionId)
      .single()

    if (fetchError || !transactionData) {
      throw new Error('Transaction not found')
    }

    const itemIds = transactionData.item_ids || []

    // Complete the transaction
    const now = new Date()
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status: 'completed',
        payment_method: paymentMethod,
        transaction_date: toDateOnlyString(now),
        updated_at: now.toISOString()
      })
      .eq('account_id', accountId)
      .eq('transaction_id', canonicalTransactionId)

    if (updateError) throw updateError

    // Clear transaction_id from all linked items (update sequentially since Supabase doesn't have batch updates)
    for (const itemId of itemIds) {
      if (transactionType === 'sale') {
        // For sales, keep project_id but clear transaction_id and set status to sold
        await this.updateItem(accountId, itemId, {
          transaction_id: null,
          inventory_status: 'sold'
        })
      } else {
        // For buys, clear project_id and transaction_id and set status to available
        await this.updateItem(accountId, itemId, {
          project_id: null,
          transaction_id: null,
          inventory_status: 'available'
        })
      }
    }
  },

  // Helper function to get item by ID (account-scoped)
  async getItemById(accountId: string, itemId: string): Promise<Item | null> {
    await ensureAuthenticatedForDatabase()

    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('account_id', accountId)
      .eq('item_id', itemId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw error
    }

    if (!data) return null

    return this._convertItemFromDb(data)
  },

  // Duplicate an existing item (unified collection version) (account-scoped)
  async duplicateItem(accountId: string, projectId: string, originalItemId: string): Promise<string> {
    await ensureAuthenticatedForDatabase()

    // Get the original item first
    const originalItem = await this.getItemById(accountId, originalItemId)
    if (!originalItem) {
      throw new Error('Original item not found')
    }

    const now = new Date()
    const newItemId = `I-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
    const newQrKey = `QR-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`

    // Create duplicate item with new IDs and timestamps
    const duplicatedItem: any = {
      account_id: accountId,
      item_id: newItemId,
      description: originalItem.description || '',
      source: originalItem.source || '',
      sku: originalItem.sku || '',
      purchase_price: originalItem.purchase_price || null,
      project_price: originalItem.project_price || null,
      market_value: originalItem.market_value || null,
      payment_method: originalItem.payment_method || '',
      disposition: 'keep', // Default disposition for duplicates
      notes: originalItem.notes || null,
      space: originalItem.space || null,
      qr_key: newQrKey,
      bookmark: false, // Default bookmark to false for duplicates
      transaction_id: originalItem.transaction_id || null,
      project_id: projectId,
      inventory_status: originalItem.inventory_status || 'available',
      business_inventory_location: originalItem.business_inventory_location || null,
      date_created: originalItem.date_created || toDateOnlyString(now),
      last_updated: now.toISOString(),
      images: originalItem.images || [], // Copy images from original item
      tax_rate_pct: originalItem.tax_rate_pct || null,
      tax_amount: originalItem.tax_amount || null,
      created_by: originalItem.createdBy || null,
      created_at: now.toISOString()
    }

    // Remove any undefined values that might still exist
    Object.keys(duplicatedItem).forEach(key => {
      if (duplicatedItem[key] === undefined) {
        delete duplicatedItem[key]
      }
    })

    // Create the duplicated item
    const { error } = await supabase
      .from('items')
      .insert(duplicatedItem)

    if (error) throw error

    return newItemId
  },

  // Create multiple items linked to a transaction (unified collection version) (account-scoped)
  async createTransactionItems(
    accountId: string,
    projectId: string,
    transactionId: string,
    transaction_date: string,
    transactionSource: string,
    items: TransactionItemFormData[],
    taxRatePct?: number
  ): Promise<string[]> {
    await ensureAuthenticatedForDatabase()

    const createdItemIds: string[] = []
    const now = new Date()

    // Attempt to read the transaction's tax rate once (avoid per-item reads)
    let inheritedTax: number | undefined = undefined
    try {
      if ((taxRatePct === undefined || taxRatePct === null) && transactionId) {
        const { data: txData, error: txError } = await supabase
          .from('transactions')
          .select('tax_rate_pct')
          .eq('account_id', accountId)
          .eq('transaction_id', transactionId)
          .single()

        if (!txError && txData && txData.tax_rate_pct !== undefined && txData.tax_rate_pct !== null) {
          inheritedTax = txData.tax_rate_pct
        }
      }
    } catch (e) {
      // non-fatal - continue without inherited tax
    }

    // Prepare all items for batch insert
    const itemsToInsert: any[] = []

    for (const itemData of items) {
      const itemId = `I-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
      createdItemIds.push(itemId)

      const qrKey = `QR-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`

      const item: any = {
        account_id: accountId,
        item_id: itemId,
        description: itemData.description || '',
        source: transactionSource, // Use transaction source for all items
        sku: itemData.sku || '',
        purchase_price: itemData.purchase_price || null,
        project_price: itemData.project_price || null,
        market_value: itemData.market_value || null,
        payment_method: 'Client Card', // Default payment method
        disposition: 'keep',
        notes: itemData.notes || null,
        qr_key: qrKey,
        bookmark: false,
        transaction_id: transactionId,
        project_id: projectId,
        inventory_status: 'allocated',
        date_created: transaction_date,
        last_updated: now.toISOString(),
        images: [], // Start with empty images array, will be populated after upload
        created_at: now.toISOString()
      }

      // Attach tax rate from explicit arg, otherwise inherited transaction value
      if (taxRatePct !== undefined && taxRatePct !== null) {
        item.tax_rate_pct = taxRatePct
      } else if (inheritedTax !== undefined) {
        item.tax_rate_pct = inheritedTax
      }

      itemsToInsert.push(item)
    }

    // Insert all items in a single batch operation
    if (itemsToInsert.length > 0) {
      const { error } = await supabase
        .from('items')
        .insert(itemsToInsert)

      if (error) throw error
    }

    return createdItemIds
  }
}

// Deallocation Service - Handles inventory designation automation
export const deallocationService = {
  // Main entry point for handling inventory designation - simplified unified approach
  async handleInventoryDesignation(
    accountId: string,
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
      const item = await unifiedItemsService.getItemById(accountId, itemId)
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
          await unifiedItemsService.removeItemFromTransaction(accountId, item.item_id, item.transaction_id, item.project_price || item.market_value || '0.00')

          // Update the item to reflect it's back in business inventory
          await unifiedItemsService.updateItem(accountId, item.item_id, {
            project_id: null,
            inventory_status: 'available',
            transaction_id: null,
            last_updated: new Date().toISOString()
          })

          try {
            await auditService.logAllocationEvent(accountId, 'deallocation', itemId, null, item.transaction_id, {
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
        await auditService.logAllocationEvent(accountId, 'deallocation', itemId, item.project_id ?? null, item.transaction_id ?? null, {
          action: 'deallocation_started',
          target_status: 'inventory',
          current_transaction_id: item.transaction_id
        })
      } catch (auditError) {
        console.warn('⚠️ Failed to log deallocation start:', auditError)
      }

      const transactionId = await this.ensureSaleTransaction(
        accountId,
        item,
        projectId,
        'Transaction for items purchased from project and moved to business inventory'
      )

      console.log('📦 Moving item to business inventory...')
      // Update item to move to business inventory and link to transaction
      await unifiedItemsService.updateItem(accountId, item.item_id, {
        project_id: null,
        inventory_status: 'available',
        transaction_id: transactionId,
        space: '', // Clear space field when moving to business inventory
        last_updated: new Date().toISOString()
      })

      // Log successful deallocation (catch errors to prevent cascading failures)
      try {
        await auditService.logAllocationEvent(accountId, 'deallocation', itemId, null, transactionId, {
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
    accountId: string,
    item: Item,
    projectId: string,
    additionalNotes?: string
  ): Promise<string | null> {
    await ensureAuthenticatedForDatabase()

    // Get current user ID for created_by field
    const currentUser = await getCurrentUser()
    if (!currentUser?.id) {
      throw new Error('User must be authenticated to create transactions')
    }

    console.log('🏦 Creating/updating sale transaction for item:', item.item_id)

    // Get project name for source field
    let projectName = 'Other'
    try {
      const project = await projectService.getProject(accountId, projectId)
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
        await unifiedItemsService.removeItemFromTransaction(accountId, item.item_id, item.transaction_id, item.project_price || item.market_value || '0.00')
        await unifiedItemsService.updateItem(accountId, item.item_id, {
          project_id: null,
          inventory_status: 'available',
          transaction_id: null
        })

        // Return null to indicate no INV_SALE was created
        return null
      }
    }

    const canonicalTransactionId = `INV_SALE_${projectId}`
    console.log('🔑 Canonical transaction ID:', canonicalTransactionId)

    // Check if the canonical transaction already exists (account-scoped)
    const { data: existingTransaction, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('account_id', accountId)
      .eq('transaction_id', canonicalTransactionId)
      .single()

    if (existingTransaction && !fetchError) {
      // Transaction exists - merge the new item and recalculate amount
      console.log('📋 Existing INV_SALE transaction found, updating with new item')
      const existingItemIds = existingTransaction.item_ids || []
      const updatedItemIds = [...new Set([...existingItemIds, item.item_id])] // Avoid duplicates

      // Get all items to recalculate amount
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('project_price, market_value')
        .eq('account_id', accountId)
        .in('item_id', updatedItemIds)

      if (itemsError) throw itemsError

      const totalAmount = (itemsData || [])
        .map(item => item.project_price || item.market_value || '0.00')
        .reduce((sum: number, price: string) => sum + parseFloat(price || '0'), 0)
        .toFixed(2)

      const now = new Date()
      const updatedTransactionData = {
        item_ids: updatedItemIds,
        amount: totalAmount,
        notes: additionalNotes || 'Transaction for items purchased from project and moved to business inventory',
        updated_at: now.toISOString()
      }

      const { error: updateError } = await supabase
        .from('transactions')
        .update(updatedTransactionData)
        .eq('account_id', accountId)
        .eq('transaction_id', canonicalTransactionId)

      if (updateError) throw updateError

      console.log('🔄 Updated INV_SALE transaction with', updatedItemIds.length, 'items, amount:', totalAmount)
    } else {
      // Calculate amount from item for new transaction
      const calculatedAmount = item.project_price || item.market_value || '0.00'

      // New transaction - create Sale transaction (project moving item TO inventory)
      const now = new Date()
      const transactionData = {
        account_id: accountId,
        transaction_id: canonicalTransactionId,
        project_id: projectId,
        project_name: null,
        transaction_date: toDateOnlyString(now),
        source: projectName,  // Project name as source (project moving to inventory)
        transaction_type: 'To Inventory',  // Project is moving item TO inventory
        payment_method: 'Pending',
        amount: parseFloat(calculatedAmount || '0').toFixed(2),
        budget_category: 'Furnishings',
        notes: additionalNotes || 'Transaction for items purchased from project and moved to business inventory',
        status: 'pending' as const,
        reimbursement_type: COMPANY_OWES_CLIENT,  // We owe the client for this purchase
        trigger_event: 'Inventory sale' as const,
        item_ids: [item.item_id],
        created_by: currentUser.id,
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      }

      console.log('🆕 Creating new INV_SALE transaction with amount:', transactionData.amount)

      // Use upsert to create or update the transaction
      const { error: upsertError } = await supabase
        .from('transactions')
        .upsert(transactionData, { onConflict: 'transaction_id' })

      if (upsertError) throw upsertError
    }

    console.log('✅ Sale transaction created/updated successfully')
    return canonicalTransactionId
  }
}

// Integration Service for Business Inventory and Transactions
export const integrationService = {
  // Allocate business inventory item to project (unified collection)
  async allocateBusinessInventoryToProject(
    accountId: string,
    itemId: string,
    projectId: string,
    amount?: string,
    notes?: string
  ): Promise<string> {
    return await unifiedItemsService.allocateItemToProject(accountId, itemId, projectId, amount, notes)
  },

  // Return item from project to business inventory (unified collection)
  async returnItemToBusinessInventory(
    accountId: string,
    itemId: string,
    _transactionId: string,
    projectId: string
  ): Promise<void> {
    // Use the canonical return method which creates/updates INV_BUY_<projectId> transaction
    await unifiedItemsService.returnItemFromProject(accountId, itemId, projectId)
  },

  // Complete pending transaction and mark item as sold (unified collection)
  async completePendingTransaction(
    accountId: string,
    _itemId: string,
    _transactionId: string,
    projectId: string,
    paymentMethod: string
  ): Promise<void> {
    // For sales, we need to complete the INV_SALE transaction
    return await unifiedItemsService.completePendingTransaction(accountId, 'sale', projectId, paymentMethod)
  },

  // Handle item deallocation (new method)
  async handleItemDeallocation(
    accountId: string,
    itemId: string,
    projectId: string,
    disposition: string
  ): Promise<void> {
    return await deallocationService.handleInventoryDesignation(accountId, itemId, projectId, disposition)
  }
}
