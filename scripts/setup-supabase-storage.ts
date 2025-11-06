#!/usr/bin/env node
/**
 * Setup script for Supabase Storage buckets
 * 
 * This script creates the required storage buckets for the application.
 * 
 * Usage:
 *   SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_service_role_key npm run setup:storage
 * 
 * Or set these in a .env file:
 *   SUPABASE_URL=your_url
 *   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Error: Missing required environment variables')
  console.error('Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  console.error('\nYou can either:')
  console.error('1. Set them as environment variables:')
  console.error('   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run setup:storage')
  console.error('2. Add them to a .env file:')
  console.error('   SUPABASE_URL=...')
  console.error('   SUPABASE_SERVICE_ROLE_KEY=...')
  process.exit(1)
}

// Create Supabase client with service role key (has admin privileges)
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

interface BucketConfig {
  name: string
  public: boolean
  fileSizeLimit: number // in bytes
  allowedMimeTypes: string[]
}

const buckets: BucketConfig[] = [
  {
    name: 'item-images',
    public: true,
    fileSizeLimit: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  },
  {
    name: 'transaction-images',
    public: true,
    fileSizeLimit: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  },
  {
    name: 'receipt-images',
    public: true,
    fileSizeLimit: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  },
  {
    name: 'business-logos',
    public: true,
    fileSizeLimit: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']
  },
  {
    name: 'other-images',
    public: true,
    fileSizeLimit: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  }
]

async function createBucket(config: BucketConfig): Promise<boolean> {
  try {
    console.log(`Creating bucket: ${config.name}...`)
    
    // Check if bucket already exists
    const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      console.error(`Error listing buckets:`, listError)
      return false
    }
    
    const bucketExists = existingBuckets?.some(b => b.id === config.name)
    
    if (bucketExists) {
      console.log(`  ✓ Bucket "${config.name}" already exists, skipping...`)
      return true
    }
    
    // Create the bucket
    const { data, error } = await supabase.storage.createBucket(config.name, {
      public: config.public,
      fileSizeLimit: config.fileSizeLimit,
      allowedMimeTypes: config.allowedMimeTypes.length > 0 ? config.allowedMimeTypes : undefined
    })
    
    if (error) {
      console.error(`  ✗ Error creating bucket "${config.name}":`, error.message)
      return false
    }
    
    console.log(`  ✓ Successfully created bucket "${config.name}"`)
    console.log(`    - Public: ${config.public}`)
    console.log(`    - File size limit: ${config.fileSizeLimit / 1024 / 1024}MB`)
    console.log(`    - Allowed MIME types: ${config.allowedMimeTypes.join(', ')}`)
    
    return true
  } catch (error: any) {
    console.error(`  ✗ Unexpected error creating bucket "${config.name}":`, error.message)
    return false
  }
}

async function setupStorage() {
  console.log('Setting up Supabase Storage buckets...\n')
  
  let successCount = 0
  let failCount = 0
  
  for (const bucket of buckets) {
    const success = await createBucket(bucket)
    if (success) {
      successCount++
    } else {
      failCount++
    }
    console.log() // Empty line for readability
  }
  
  console.log('='.repeat(50))
  console.log(`Setup complete: ${successCount} succeeded, ${failCount} failed`)
  
  if (failCount > 0) {
    console.error('\nSome buckets failed to create. Please check the errors above.')
    process.exit(1)
  } else {
    console.log('\n✓ All storage buckets created successfully!')
    console.log('\nNext steps:')
    console.log('1. Configure CORS in Supabase Dashboard → Storage → Settings')
    console.log('2. Run the test script: npm run test:storage')
    console.log('3. Configure storage policies (Task 5.2)')
  }
}

setupStorage().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})

