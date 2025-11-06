# Task 3.3: Inventory Service Migration

## Objective
Migrate the inventory service (projects, items, transactions) from Firestore to Supabase Postgres. This is the largest service migration.

## Steps

### 1. Update Imports in `src/services/inventoryService.ts`

Replace Firestore imports:
```typescript
// Remove Firebase imports
// import { collection, doc, getDoc, ... } from 'firebase/firestore'
// import { db, convertTimestamps } from './firebase'

// Add Supabase imports
import { supabase } from './supabase'
import { convertTimestamps, ensureAuthenticatedForDatabase } from './databaseService'
```

### 2. Migrate Project Service Functions

#### `getProjects`
```typescript
async getProjects(accountId: string): Promise<Project[]> {
  await ensureAuthenticatedForDatabase()

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('account_id', accountId)
    .order('updated_at', { ascending: false })

  if (error) throw error

  return (data || []).map(project => convertTimestamps({
    id: project.id,
    accountId: project.account_id,
    name: project.name,
    description: project.description,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    createdBy: project.created_by,
    itemCount: project.item_count,
    transactionCount: project.transaction_count,
    totalValue: project.total_value
  })) as Project[]
}
```

#### `createProject`
```typescript
async createProject(accountId: string, projectData: Partial<Project>): Promise<Project> {
  await ensureAuthenticatedForDatabase()

  const { data, error } = await supabase
    .from('projects')
    .insert({
      account_id: accountId,
      name: projectData.name,
      description: projectData.description || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: projectData.createdBy,
      item_count: 0,
      transaction_count: 0,
      total_value: 0
    })
    .select()
    .single()

  if (error) throw error

  return convertTimestamps({
    id: data.id,
    accountId: data.account_id,
    name: data.name,
    description: data.description,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    createdBy: data.created_by,
    itemCount: data.item_count,
    transactionCount: data.transaction_count,
    totalValue: data.total_value
  }) as Project
}
```

#### `updateProject`, `deleteProject`
Similar pattern - convert Firestore operations to Supabase queries.

### 3. Migrate Item Service Functions

#### `getItems`
```typescript
async getItems(
  accountId: string,
  projectId?: string,
  options?: FilterOptions & PaginationOptions
): Promise<Item[]> {
  await ensureAuthenticatedForDatabase()

  let query = supabase
    .from('items')
    .select('*')
    .eq('account_id', accountId)

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  // Apply filters
  if (options?.search) {
    query = query.or(`name.ilike.%${options.search}%,description.ilike.%${options.search}%,sku.ilike.%${options.search}%`)
  }

  if (options?.bookmark !== undefined) {
    query = query.eq('bookmark', options.bookmark)
  }

  // Apply ordering
  if (options?.orderBy) {
    const orderField = options.orderBy === 'last_updated' ? 'last_updated' : 'date_created'
    query = query.order(orderField, { ascending: options.orderDirection !== 'desc' })
  } else {
    query = query.order('last_updated', { ascending: false })
  }

  // Apply pagination
  if (options?.limit) {
    query = query.limit(options.limit)
    if (options.offset) {
      query = query.range(options.offset, options.offset + options.limit - 1)
    }
  }

  const { data, error } = await query
  if (error) throw error

  return (data || []).map(item => convertTimestamps({
    id: item.id,
    accountId: item.account_id,
    projectId: item.project_id,
    transactionId: item.transaction_id,
    itemId: item.item_id,
    name: item.name,
    description: item.description,
    sku: item.sku,
    source: item.source,
    dateCreated: item.date_created,
    lastUpdated: item.last_updated,
    images: item.images || [],
    bookmark: item.bookmark,
    createdBy: item.created_by,
    createdAt: item.created_at
  })) as Item[]
}
```

#### `createItem`, `updateItem`, `deleteItem`
Convert similarly, handling JSONB fields (images) appropriately.

### 4. Migrate Transaction Service Functions

Similar pattern - convert Firestore queries to Supabase queries, handling:
- Array fields (`item_ids` as `TEXT[]`)
- JSONB fields (`images`)
- Date fields (`transaction_date` as `DATE`)
- Complex queries with multiple filters

### 5. Migrate Audit Service Functions

```typescript
export const auditService = {
  async logAllocationEvent(
    accountId: string,
    eventType: 'allocation' | 'deallocation' | 'return',
    itemId: string,
    projectId: string | null,
    transactionIdOrDetails: any,
    detailsOrUndefined?: Record<string, any>
  ): Promise<void> {
    try {
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
    }
  },

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
    }
  }
}
```

## Key Conversion Patterns

### Firestore → Supabase

1. **Collection queries**:
   ```typescript
   // Firestore
   const q = query(collection(db, 'accounts', accountId, 'items'), where('project_id', '==', projectId))
   
   // Supabase
   supabase.from('items').select('*').eq('account_id', accountId).eq('project_id', projectId)
   ```

2. **Order by**:
   ```typescript
   // Firestore
   orderBy('updated_at', 'desc')
   
   // Supabase
   .order('updated_at', { ascending: false })
   ```

3. **Array contains**:
   ```typescript
   // Firestore
   where('item_ids', 'array-contains', itemId)
   
   // Supabase
   .contains('item_ids', [itemId])
   ```

4. **Nested queries**:
   ```typescript
   // Firestore
   collection(db, 'accounts', accountId, 'projects', projectId, 'items')
   
   // Supabase (use foreign key)
   supabase.from('items').eq('account_id', accountId).eq('project_id', projectId)
   ```

## Verification
- [ ] All project functions migrated
- [ ] All item functions migrated
- [ ] All transaction functions migrated
- [ ] Audit logging works
- [ ] Complex queries work correctly
- [ ] Pagination works
- [ ] Filtering works

## Next Steps
- Proceed to Task 3.4: Business Profile Service Migration

