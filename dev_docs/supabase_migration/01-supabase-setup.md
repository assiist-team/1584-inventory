# Task 1.1: Supabase Project Setup

## Objective
Set up a new Supabase project and configure the development environment to use Supabase instead of Firebase.

## Steps

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in
3. Create a new project
4. Note down:
   - Project URL
   - Anon (public) key
   - Service role key (keep secret!)

### 2. Install Supabase Client Library
```bash
npm install @supabase/supabase-js
```

### 3. Create Environment Variables
Create or update `.env` file (and `.env.example`):

```env
# Supabase Configuration
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Create Supabase Client File
Create `src/services/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

// Helper to check if Supabase is ready
export const isSupabaseReady = (): boolean => {
  return supabase !== null && typeof supabase === 'object'
}
```

### 5. Update TypeScript Types (Optional)
You may want to generate TypeScript types from your database schema later:
```bash
npx supabase gen types typescript --project-id your-project-id > src/types/supabase.ts
```

## Verification
- [ ] Supabase project created
- [ ] Environment variables configured
- [ ] Supabase client library installed
- [ ] `src/services/supabase.ts` created and working
- [ ] Can import and use `supabase` client in other files

## Next Steps
- Proceed to Task 1.2: Database Schema Design

