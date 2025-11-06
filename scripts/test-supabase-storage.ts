#!/usr/bin/env node
/**
 * Test script for Supabase Storage buckets
 * 
 * This script tests that storage buckets are accessible and working correctly.
 * 
 * Usage:
 *   npm run test:storage
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: Missing required environment variables')
  console.error('Required: SUPABASE_URL and SUPABASE_ANON_KEY (or VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY)')
  process.exit(1)
}

// Create Supabase client with anon key (for testing user-level access)
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const buckets = [
  'item-images',
  'transaction-images',
  'receipt-images',
  'business-logos',
  'other-images'
]

async function testBucket(bucketName: string): Promise<boolean> {
  try {
    console.log(`Testing bucket: ${bucketName}...`)
    
    // Test 1: List bucket contents (should work even if empty)
    const { data: files, error: listError } = await supabase.storage
      .from(bucketName)
      .list('', {
        limit: 1,
        offset: 0
      })
    
    if (listError) {
      console.error(`  ✗ Error listing files:`, listError.message)
      return false
    }
    
    console.log(`  ✓ Can list files (found ${files?.length || 0} files)`)
    
    // Test 2: Try to get public URL (test bucket configuration)
    const testPath = 'test/test.txt'
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(testPath)
    
    if (urlData?.publicUrl) {
      console.log(`  ✓ Public URL generation works`)
      console.log(`    Example URL: ${urlData.publicUrl}`)
    } else {
      console.warn(`  ⚠ Could not generate public URL`)
    }
    
    return true
  } catch (error: any) {
    console.error(`  ✗ Unexpected error testing bucket "${bucketName}":`, error.message)
    return false
  }
}

async function testStorageAccess() {
  console.log('Testing Supabase Storage access...\n')
  console.log('Note: This test uses the anon key to verify bucket accessibility.')
  console.log('For upload/delete tests, authentication will be required.\n')
  
  let successCount = 0
  let failCount = 0
  
  for (const bucket of buckets) {
    const success = await testBucket(bucket)
    if (success) {
      successCount++
    } else {
      failCount++
    }
    console.log() // Empty line for readability
  }
  
  console.log('='.repeat(50))
  console.log(`Test results: ${successCount} passed, ${failCount} failed`)
  
  if (failCount > 0) {
    console.error('\nSome buckets failed the test. Please check:')
    console.error('1. Buckets exist in Supabase Dashboard')
    console.error('2. Bucket policies allow public read access')
    console.error('3. CORS is configured correctly')
    process.exit(1)
  } else {
    console.log('\n✓ All storage buckets are accessible!')
    console.log('\nStorage setup is complete. You can now:')
    console.log('1. Proceed with image service migration (Task 4.1)')
    console.log('2. Configure storage policies (Task 5.2)')
  }
}

testStorageAccess().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})

