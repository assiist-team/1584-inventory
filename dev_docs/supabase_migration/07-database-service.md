# Task 3.1: Core Database Service

## Objective
Create a core database service wrapper around Supabase that provides helper functions for common database operations, replacing Firebase Firestore utilities.

## Steps

### 1. Create `src/services/databaseService.ts`

```typescript
import { supabase } from './supabase'
import { PostgrestError } from '@supabase/supabase-js'

// Utility function to convert Postgres timestamps to JavaScript Date
export const timestampToDate = (timestamp: any): Date => {
  if (timestamp instanceof Date) {
    return timestamp
  }
  if (typeof timestamp === 'string') {
    // Handle date-only strings (YYYY-MM-DD) by creating date at midnight local time
    const dateStr = timestamp.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-').map(Number)
      return new Date(year, month - 1, day)
    }
    return new Date(timestamp)
  }
  if (typeof timestamp === 'number') {
    return new Date(timestamp)
  }
  if (!timestamp) {
    return new Date()
  }
  try {
    return new Date(timestamp)
  } catch (error) {
    console.warn('Failed to convert timestamp to date:', timestamp, error)
    return new Date()
  }
}

// Utility function to convert Postgres document data with timestamp conversion
export const convertTimestamps = (data: any): any => {
  if (!data || typeof data !== 'object') {
    return data
  }

  const converted: any = { ...data }

  // Convert known timestamp fields
  const timestampFields = [
    'created_at', 'updated_at', 'last_activity', 'uploaded_at', 
    'generated_at', 'last_scanned', 'last_login', 'joined_at',
    'accepted_at', 'expires_at', 'timestamp'
  ]

  const convertObject = (obj: any): any => {
    if (!obj || typeof obj !== 'object') {
      return obj
    }

    const result: any = { ...obj }

    // Handle arrays of objects FIRST
    if (Array.isArray(result)) {
      return result.map((item: any) => convertObject(item))
    }

    // Convert timestamp fields
    timestampFields.forEach(field => {
      if (result[field]) {
        result[field] = timestampToDate(result[field])
      }
    })

    // Handle nested objects and arrays
    Object.keys(result).forEach(key => {
      if (result[key] && typeof result[key] === 'object') {
        if (Array.isArray(result[key])) {
          result[key] = result[key].map((item: any) => convertObject(item))
        } else {
          result[key] = convertObject(result[key])
        }
      }
    })

    return result
  }

  return convertObject(converted)
}

// Helper to handle Supabase errors
export const handleSupabaseError = (error: PostgrestError | null): void => {
  if (error) {
    console.error('Supabase error:', error)
    throw new Error(error.message || 'Database error occurred')
  }
}

// Helper to get server timestamp (Postgres uses NOW())
// For inserts/updates, use: new Date().toISOString() or let Postgres handle it with DEFAULT
export const serverTimestamp = (): string => {
  return new Date().toISOString()
}

// Helper to ensure authentication before database operations
export const ensureAuthenticatedForDatabase = async (): Promise<void> => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Authentication required for database operations')
  }
}

// Database query helpers
export const db = {
  // Get a single document by ID
  async getDoc<T>(table: string, id: string): Promise<T | null> {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null
      }
      handleSupabaseError(error)
      return null
    }

    return convertTimestamps(data) as T
  },

  // Get multiple documents with optional filters
  async getDocs<T>(
    table: string,
    filters?: {
      column?: string
      value?: any
      orderBy?: string
      orderDirection?: 'asc' | 'desc'
      limit?: number
    }
  ): Promise<T[]> {
    let query = supabase.from(table).select('*')

    if (filters?.column && filters?.value !== undefined) {
      query = query.eq(filters.column, filters.value)
    }

    if (filters?.orderBy) {
      query = query.order(filters.orderBy, {
        ascending: filters.orderDirection !== 'desc'
      })
    }

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    const { data, error } = await query
    handleSupabaseError(error)

    return (data || []).map(item => convertTimestamps(item)) as T[]
  },

  // Create a document
  async createDoc<T>(table: string, data: Partial<T>): Promise<T> {
    const { data: result, error } = await supabase
      .from(table)
      .insert(data)
      .select()
      .single()

    handleSupabaseError(error)
    return convertTimestamps(result) as T
  },

  // Update a document
  async updateDoc<T>(table: string, id: string, data: Partial<T>): Promise<T> {
    const { data: result, error } = await supabase
      .from(table)
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    handleSupabaseError(error)
    return convertTimestamps(result) as T
  },

  // Delete a document
  async deleteDoc(table: string, id: string): Promise<void> {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id)

    handleSupabaseError(error)
  },

  // Batch operations (using Supabase RPC or multiple calls)
  async batchWrite(operations: Array<{
    type: 'create' | 'update' | 'delete'
    table: string
    id?: string
    data?: any
  }>): Promise<void> {
    // Supabase doesn't have native batch writes like Firestore
    // We'll execute operations sequentially or use a transaction via RPC
    for (const op of operations) {
      if (op.type === 'create') {
        await this.createDoc(op.table, op.data)
      } else if (op.type === 'update' && op.id) {
        await this.updateDoc(op.table, op.id, op.data)
      } else if (op.type === 'delete' && op.id) {
        await this.deleteDoc(op.table, op.id)
      }
    }
  }
}

export default db
```

### 2. Update Existing Services to Use Database Service

This service provides a foundation that other services can build upon. The actual migration of specific services happens in subsequent tasks.

## Key Differences from Firestore

1. **Queries**: Use SQL-like syntax instead of Firestore query builder
2. **Timestamps**: Postgres returns ISO strings, not Firestore Timestamp objects
3. **Batch operations**: No native batch API, need to use transactions or sequential calls
4. **Real-time**: Uses Supabase Realtime subscriptions (covered in Task 6.1)

## Verification
- [ ] Database service created
- [ ] Timestamp conversion utilities work
- [ ] CRUD helpers work
- [ ] Error handling works
- [ ] Can perform basic queries

## Next Steps
- Proceed to Task 3.2: Account Service Migration

