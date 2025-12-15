# Task 3.1: Core Database Service

## Objective
Create core database utility functions for Supabase operations. Services will use Supabase's native query builder directly, optimizing for Postgres/SQL patterns rather than abstracting to Firestore-like APIs.

## Approach

**Use Supabase's native query builder directly** - Services should call `supabase.from(table).select()...` etc. directly, leveraging Postgres features like:
- Joins for relational queries
- Aggregations and grouping
- Transactions via RPC functions
- Complex WHERE clauses
- Indexed queries

**Provide utility functions only** - The database service provides helper utilities for:
- Timestamp conversion (Postgres returns ISO strings, we need Date objects)
- Error handling and error type checking
- No authentication checks needed - RLS policies handle this automatically

## Steps

### 1. Create `src/services/databaseService.ts`

This file provides utility functions only - no abstraction layer:

```typescript
import { PostgrestError } from '@supabase/supabase-js'

/**
 * Core database utilities for Supabase operations.
 * 
 * Services should use Supabase's native query builder directly:
 *   supabase.from('table').select('*').eq('id', id).single()
 * 
 * Key principles:
 * - Let Postgres handle timestamps via DEFAULT NOW() in schema
 * - RLS policies handle authentication/authorization automatically
 * - Use SQL joins, aggregations, and Postgres features directly
 * - Convert Postgres ISO timestamp strings to Date objects for app use
 */

// timestampToDate - converts Postgres timestamps to Date objects
// convertTimestamps - recursively converts timestamp fields
// handleSupabaseError - flexible error handling with options
// isNotFoundError - check if error is "not found" (PGRST116)
// isForeignKeyError - check if error is foreign key violation (23503)
// isUniqueConstraintError - check if error is unique constraint (23505)
// isPermissionError - check if error is RLS/permission violation (42501, PGRST301)
```

### 2. Example Usage in Services

Services should use Supabase's native query builder:

```typescript
import { supabase } from './supabase'
import { convertTimestamps, handleSupabaseError, isNotFoundError, isPermissionError } from './databaseService'

// Get a single record
const { data, error } = await supabase
  .from('accounts')
  .select('*')
  .eq('id', accountId)
  .single()

handleSupabaseError(error, { returnNullOnNotFound: true })
const account = data ? convertTimestamps(data) : null

// Get multiple records with filters
const { data, error } = await supabase
  .from('items')
  .select('*')
  .eq('account_id', accountId)
  .order('created_at', { ascending: false })
  .limit(10)

handleSupabaseError(error)
const items = (data || []).map(item => convertTimestamps(item))

// Create a record
const { data, error } = await supabase
  .from('projects')
  .insert({ name: 'New Project', account_id: accountId })
  .select()
  .single()

handleSupabaseError(error)
const project = convertTimestamps(data)

// Update a record
// Note: Let Postgres handle updated_at via DEFAULT NOW() or trigger
// Only set updated_at manually if you need client-side timestamp
const { data, error } = await supabase
  .from('projects')
  .update({ name: 'Updated Name' })
  .eq('id', projectId)
  .select()
  .single()

handleSupabaseError(error)
const updated = convertTimestamps(data)

// Delete a record
const { error } = await supabase
  .from('projects')
  .delete()
  .eq('id', projectId)

handleSupabaseError(error)

// Use joins for relational queries
const { data, error } = await supabase
  .from('items')
  .select(`
    *,
    projects:project_id (
      id,
      name
    )
  `)
  .eq('account_id', accountId)

handleSupabaseError(error)
const itemsWithProjects = (data || []).map(item => convertTimestamps(item))

// Handle errors with custom logic
const { data, error } = await supabase
  .from('accounts')
  .select('*')
  .eq('id', accountId)
  .single()

if (error) {
  if (isNotFoundError(error)) {
    // Handle not found case
    return null
  }
  if (isPermissionError(error)) {
    // Handle permission denied
    throw new Error('You do not have permission to access this account')
  }
  handleSupabaseError(error) // Throw for other errors
}
const account = convertTimestamps(data)
```

### 3. Benefits of Native Supabase Approach

- **Leverage SQL power**: Use joins, aggregations, subqueries directly
- **Better performance**: Optimized queries, use indexes effectively
- **Type safety**: Supabase generates TypeScript types from schema
- **Less abstraction**: Direct access to Postgres features
- **Easier debugging**: Queries are explicit and clear

## Key Differences from Firestore

1. **Queries**: Use Supabase's Postgres query builder (SQL-like) directly - no abstraction layer
2. **Timestamps**: 
   - Postgres returns ISO strings, use `convertTimestamps()` utility to convert to Date objects
   - Let Postgres handle timestamps via `DEFAULT NOW()` in schema - don't use client-side timestamps
   - No `serverTimestamp()` function needed - Postgres handles this automatically
3. **Authentication**: RLS policies handle authentication/authorization automatically - no manual auth checks needed
4. **Relationships**: Use SQL joins instead of document references
5. **Transactions**: Use Postgres transactions via RPC functions or sequential operations
6. **Real-time**: Uses Supabase Realtime subscriptions (covered in Task 6.1)
7. **No document abstraction**: Work directly with relational tables and rows
8. **Error handling**: More structured error codes (PGRST116 for not found, 23503 for FK violations, etc.)

## Verification
- [x] Database service created with utility functions only
- [x] Timestamp conversion utilities implemented
- [x] Flexible error handling utilities implemented with options
- [x] Error type checkers implemented (not found, FK, unique constraint, permission)
- [x] Removed Firebase-like patterns (serverTimestamp, ensureAuthenticatedForDatabase)
- [x] Services can use Supabase query builder directly
- [x] Documentation emphasizes Postgres-native patterns (DEFAULT NOW(), RLS)

## Next Steps
- Proceed to Task 3.2: Account Service Migration

