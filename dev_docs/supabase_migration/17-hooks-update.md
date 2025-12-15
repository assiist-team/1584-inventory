# Task 7.2: Service Hook Updates

## Objective
Update any hooks that depend on Firebase to work with Supabase.

## Steps

### 1. Review Existing Hooks

Check these hooks for Firebase dependencies:
- `src/hooks/useBookmark.ts`
- `src/hooks/useDuplication.ts`
- `src/hooks/useNavigationContext.ts`

### 2. Update `useBookmark.ts` (if needed)

If it uses Firebase directly:

**Before**:
```typescript
import { updateDoc, doc } from 'firebase/firestore'
import { db } from '../services/firebase'

export function useBookmark() {
  const toggleBookmark = async (itemId: string) => {
    await updateDoc(doc(db, 'items', itemId), {
      bookmark: !currentBookmark
    })
  }
}
```

**After**:
```typescript
import { supabase } from '../services/supabase'

export function useBookmark() {
  const toggleBookmark = async (itemId: string, currentBookmark: boolean) => {
    await supabase
      .from('items')
      .update({ bookmark: !currentBookmark })
      .eq('id', itemId)
  }
}
```

### 3. Update `useDuplication.ts` (if needed)

Similar pattern - replace Firestore operations with Supabase queries.

### 4. Update `useNavigationContext.ts` (if needed)

Check if it uses Firebase for any data fetching or state management.

### 5. Create New Hooks if Needed

#### `useRealtime` Hook (if not created in Task 6.1)

See Task 6.1 for implementation.

#### `useSupabaseQuery` Hook (optional)

Create a reusable hook for Supabase queries:

```typescript
import { useState, useEffect } from 'react'
import { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'

export function useSupabaseQuery<T>(
  table: string,
  options?: {
    filters?: Record<string, any>
    orderBy?: string
    orderDirection?: 'asc' | 'desc'
    limit?: number
  }
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<PostgrestError | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)

      let query = supabase.from(table).select('*')

      if (options?.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          query = query.eq(key, value)
        })
      }

      if (options?.orderBy) {
        query = query.order(options.orderBy, {
          ascending: options.orderDirection !== 'desc'
        })
      }

      if (options?.limit) {
        query = query.limit(options.limit)
      }

      const { data: result, error: err } = await query

      if (err) {
        setError(err)
      } else {
        setData(result as T[])
      }

      setLoading(false)
    }

    fetchData()
  }, [table, JSON.stringify(options)])

  return { data, loading, error }
}
```

## Verification Results

✅ **All hooks reviewed and verified compatible with Supabase**

### Hook Analysis:

1. **`useBookmark.ts`** ✅
   - No Firebase dependencies
   - Uses service functions passed as props (`updateItemService`)
   - Already abstracted and compatible with Supabase services

2. **`useDuplication.ts`** ✅
   - No Firebase dependencies
   - Uses service functions passed as props or imports from `inventoryService`
   - Already compatible with Supabase services

3. **`useNavigationContext.ts`** ✅
   - No Firebase dependencies
   - Only uses React Router's `useLocation` hook
   - No database dependencies

4. **`useRealtime.ts`** ✅
   - Already uses Supabase!
   - Imports from `../services/supabase`
   - Uses Supabase Realtime subscriptions
   - Created in Task 6.1

### Verification Checklist:
- [x] All hooks reviewed
- [x] Firebase dependencies removed (none found)
- [x] Hooks work with Supabase
- [x] No breaking changes to components using hooks

### Notes:
- All hooks follow a service-layer pattern, abstracting database operations
- Components use hooks with service functions, maintaining clean separation of concerns
- The `useSupabaseQuery` hook mentioned in the doc is optional and not needed since components use service layers instead of direct queries

## Next Steps
- Proceed to Task 8.1: Remove Firebase Dependencies

