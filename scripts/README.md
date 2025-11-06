# Supabase Storage Setup Scripts

This directory contains scripts for setting up and testing Supabase Storage buckets.

## Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```

2. Ensure you have your Supabase credentials:
   - `SUPABASE_URL` or `VITE_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (for setup script - get from Supabase Dashboard → Settings → API)
   - `SUPABASE_ANON_KEY` or `VITE_SUPABASE_ANON_KEY` (for test script)

## Setup Script

Creates all required storage buckets:

```bash
npm run setup:storage
```

Or with environment variables:
```bash
SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_service_role_key npm run setup:storage
```

This script will create:
- `item-images` (10MB limit, public)
- `transaction-images` (10MB limit, public)
- `receipt-images` (10MB limit, public)
- `business-logos` (5MB limit, public)
- `other-images` (10MB limit, public)

## Test Script

Tests that all storage buckets are accessible:

```bash
npm run test:storage
```

This script verifies:
- Buckets exist and are accessible
- Public URL generation works
- Basic storage operations are functional

## Manual Setup

If you prefer to set up buckets manually via the Supabase Dashboard:

1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Create each bucket with the specifications listed in `dev_docs/supabase_migration/03-storage-setup.md`

## Next Steps

After buckets are created:
1. Configure storage policies (Task 5.2)
2. Migrate image service (Task 4.1)

