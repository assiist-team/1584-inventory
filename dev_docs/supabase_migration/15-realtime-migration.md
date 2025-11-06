# Task 6.1: Real-time Subscriptions

## Objective
Replace Firestore `onSnapshot` listeners with Supabase Realtime subscriptions.

## Steps

### 1. Enable Realtime for Tables

**Option A: Run the Migration File (Recommended)**

Run the migration file `supabase/migrations/006_enable_realtime.sql` using one of these methods:

1. **Via Supabase Dashboard:**
   - Go to your Supabase project dashboard
   - Navigate to **SQL Editor**
   - Copy and paste the contents of `supabase/migrations/006_enable_realtime.sql`
   - Click **Run** to execute the SQL

2. **Via Supabase CLI:**
   ```bash
   supabase db push
   ```

**Option B: Manual SQL Commands**

If you prefer to run the SQL manually, open the Supabase SQL Editor and run:

```sql
-- Ensure the supabase_realtime publication exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Add tables to the publication
ALTER PUBLICATION supabase_realtime ADD TABLE projects;
ALTER PUBLICATION supabase_realtime ADD TABLE items;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
```

**Note:** If you get errors saying a table is already in the publication, that's fine - it means realtime is already enabled for that table. You can safely ignore those errors.

**Tables enabled for realtime:**
- `projects` - for project list updates
- `items` - for inventory item updates  
- `transactions` - for transaction updates
- `account_members` (optional) - uncomment in migration file if needed

### 2. Create Realtime Hook

Create `src/hooks/useRealtime.ts`:

```typescript
import { useEffect, useState } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'

export function useRealtimeSubscription<T>(
  table: string,
  filter?: { column: string; value: any },
  callback?: (payload: any) => void
) {
  const [data, setData] = useState<T[]>([])
  const [channel, setChannel] = useState<RealtimeChannel | null>(null)

  useEffect(() => {
    // Create channel
    const channelName = `realtime:${table}${filter ? `:${filter.column}:${filter.value}` : ''}`
    const newChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: filter ? `${filter.column}=eq.${filter.value}` : undefined
        },
        (payload) => {
          console.log('Realtime update:', payload)
          if (callback) {
            callback(payload)
          }
        }
      )
      .subscribe()

    setChannel(newChannel)

    // Initial fetch
    const fetchData = async () => {
      let query = supabase.from(table).select('*')
      if (filter) {
        query = query.eq(filter.column, filter.value)
      }
      const { data, error } = await query
      if (!error && data) {
        setData(data as T[])
      }
    }

    fetchData()

    return () => {
      newChannel.unsubscribe()
    }
  }, [table, filter?.column, filter?.value])

  return { data, channel }
}
```

### 3. Replace Firestore Listeners

#### Example: Projects Listener

**Before (Firestore)**:
```typescript
const unsubscribe = onSnapshot(
  query(collection(db, 'accounts', accountId, 'projects'), orderBy('updatedAt', 'desc')),
  (snapshot) => {
    const projects = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    setProjects(projects)
  }
)
```

**After (Supabase)**:
```typescript
useEffect(() => {
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
        const { data } = await supabase
          .from('projects')
          .select('*')
          .eq('account_id', accountId)
          .order('updated_at', { ascending: false })
        if (data) setProjects(data)
      }
    )
    .subscribe()

  // Initial fetch
  const fetchProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('account_id', accountId)
      .order('updated_at', { ascending: false })
    if (data) setProjects(data)
  }
  fetchProjects()

  return () => {
    channel.unsubscribe()
  }
}, [accountId])
```

### 4. Update Inventory Service Real-time Functions

If `inventoryService.ts` has real-time functions, update them:

```typescript
// Example: Subscribe to items for a project
export const subscribeToItems = (
  accountId: string,
  projectId: string,
  callback: (items: Item[]) => void
) => {
  const channel = supabase
    .channel(`items:${projectId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'items',
        filter: `project_id=eq.${projectId}`
      },
      async () => {
        const { data } = await supabase
          .from('items')
          .select('*')
          .eq('account_id', accountId)
          .eq('project_id', projectId)
        if (data) callback(data as Item[])
      }
    )
    .subscribe()

  return () => {
    channel.unsubscribe()
  }
}
```

## Key Differences

1. **Event Types**:
   - Firestore: `onSnapshot` fires on any change
   - Supabase: Specify event types (`INSERT`, `UPDATE`, `DELETE`, or `*`)

2. **Filtering**:
   - Firestore: Use query filters
   - Supabase: Use `filter` parameter in subscription

3. **Data Format**:
   - Firestore: Provides snapshot with docs
   - Supabase: Provides payload with `new` and `old` records

4. **Cleanup**:
   - Both: Need to unsubscribe on component unmount

## Performance Considerations

- Supabase Realtime uses WebSockets
- Consider debouncing rapid updates
- May want to refetch on changes rather than updating incrementally
- Use filters to limit subscription scope

## Verification
- [ ] Realtime enabled for necessary tables
- [ ] Subscriptions work for INSERT
- [ ] Subscriptions work for UPDATE
- [ ] Subscriptions work for DELETE
- [ ] Filters work correctly
- [ ] Cleanup works on unmount

## Next Steps
- Proceed to Task 7.1: Auth Components Update

