#!/usr/bin/env node

/**
 * Migration Script: Move Items from Project Subcollections to Unified Collection
 *
 * This script migrates all items from the legacy structure (projects/{projectId}/items/)
 * to the new unified structure (items/{itemId} with project_id field).
 *
 * Usage:
 *   node migration/migrate-items-to-unified-collection.cjs
 */

// Load environment variables from .env file
require('dotenv').config()

const { initializeApp } = require('firebase/app')
const { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, writeBatch } = require('firebase/firestore')

// Firebase configuration - should match your .env file
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

/**
 * Main migration function
 */
async function migrateItemsToUnifiedCollection() {
  console.log('🚀 Starting migration of items to unified collection...\n')

  try {
    // Step 1: Get all projects
    console.log('📋 Fetching all projects...')
    const projectsRef = collection(db, 'projects')
    const projectsSnapshot = await getDocs(projectsRef)

    if (projectsSnapshot.empty) {
      console.log('❌ No projects found. Migration complete.')
      return
    }

    console.log(`✅ Found ${projectsSnapshot.docs.length} projects\n`)

    let totalItemsMigrated = 0
    let totalProjectsProcessed = 0

    // Step 2: Process each project
    for (const projectDoc of projectsSnapshot.docs) {
      const projectId = projectDoc.id
      const projectData = projectDoc.data()

      console.log(`🏗️  Processing project: ${projectData.name || projectId}`)

      // Get all items for this project from the legacy subcollection
      const itemsRef = collection(db, 'projects', projectId, 'items')
      const itemsSnapshot = await getDocs(itemsRef)

      if (itemsSnapshot.empty) {
        console.log(`   ⚠️  No items found in project ${projectId}`)
        continue
      }

      console.log(`   📦 Found ${itemsSnapshot.docs.length} items to migrate`)

      // Step 3: Migrate items in batches
      const batchSize = 10 // Process in small batches to avoid memory issues
      const batches = []

      for (let i = 0; i < itemsSnapshot.docs.length; i += batchSize) {
        const batch = writeBatch(db)
        const batchItems = itemsSnapshot.docs.slice(i, i + batchSize)

        batchItems.forEach(itemDoc => {
          const itemId = itemDoc.id
          const itemData = itemDoc.data()

          // Create the new unified item structure
          const unifiedItem = {
            ...itemData,
            project_id: projectId, // Add project reference
            // Ensure required fields are present
            inventory_status: itemData.inventory_status || 'available',
            last_updated: new Date().toISOString()
          }

          // Set the item in the unified collection
          const unifiedItemRef = doc(db, 'items', itemId)
          batch.set(unifiedItemRef, unifiedItem)

          // Delete the old item from the project subcollection
          const oldItemRef = doc(db, 'projects', projectId, 'items', itemId)
          batch.delete(oldItemRef)
        })

        batches.push(batch)
      }

      // Step 4: Execute all batches for this project
      console.log(`   🔄 Executing ${batches.length} batches...`)

      for (let i = 0; i < batches.length; i++) {
        await batches[i].commit()
        console.log(`      ✅ Batch ${i + 1}/${batches.length} completed`)
      }

      const migratedCount = itemsSnapshot.docs.length
      totalItemsMigrated += migratedCount
      totalProjectsProcessed++

      console.log(`   ✅ Successfully migrated ${migratedCount} items from project ${projectId}\n`)
    }

    // Step 5: Summary
    console.log('🎉 Migration completed successfully!')
    console.log(`📊 Summary:`)
    console.log(`   • Projects processed: ${totalProjectsProcessed}`)
    console.log(`   • Total items migrated: ${totalItemsMigrated}`)
    console.log(`   • Items are now in the unified 'items' collection`)
    console.log(`   • Legacy project subcollections have been cleaned up`)

    if (totalItemsMigrated > 0) {
      console.log('\n🔧 Next steps:')
      console.log('   1. Update your application code to use unifiedItemsService instead of itemService')
      console.log('   2. Test that items display correctly in your React app')
      console.log('   3. Consider removing the legacy itemService once everything is working')
    }

  } catch (error) {
    console.error('❌ Migration failed:', error)
    console.error('🔍 Error details:', error.message)

    if (error.message.includes('Missing or insufficient permissions')) {
      console.error('\n💡 Permission error - make sure your Firebase security rules allow the migration:')
      console.error('   - Check that you have write permissions to both collections')
      console.error('   - Ensure your authentication is properly configured')
    }

    throw error
  }
}

/**
 * Validation function to check if migration is safe to run
 */
async function validateMigration() {
  console.log('🔍 Validating migration safety...')

  try {
    // Check if unified items collection exists and has items
    const itemsRef = collection(db, 'items')
    const itemsSnapshot = await getDocs(itemsRef)

    if (!itemsSnapshot.empty) {
      console.log(`⚠️  Warning: Unified items collection already contains ${itemsSnapshot.docs.length} items`)
      console.log('   This migration will add to existing items, not replace them.')
    }

    // Check if projects exist
    const projectsRef = collection(db, 'projects')
    const projectsSnapshot = await getDocs(projectsRef)

    if (projectsSnapshot.empty) {
      console.log('❌ No projects found to migrate from')
      return false
    }

    let totalLegacyItems = 0

    // Count total items in legacy structure
    for (const projectDoc of projectsSnapshot.docs) {
      const projectId = projectDoc.id
      const itemsRef = collection(db, 'projects', projectId, 'items')
      const itemsSnapshot = await getDocs(itemsRef)
      totalLegacyItems += itemsSnapshot.docs.length
    }

    if (totalLegacyItems === 0) {
      console.log('❌ No items found in legacy structure to migrate')
      return false
    }

    console.log(`✅ Validation passed:`)
    console.log(`   • Found ${projectsSnapshot.docs.length} projects`)
    console.log(`   • Found ${totalLegacyItems} items to migrate`)
    console.log(`   • Unified collection ready`)

    return true

  } catch (error) {
    console.error('❌ Validation failed:', error.message)
    return false
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🔧 Firebase Items Migration Tool')
  console.log('================================\n')

  // Validate before running
  const isValid = await validateMigration()

  if (!isValid) {
    console.log('\n❌ Migration aborted due to validation failure')
    process.exit(1)
  }

  console.log('\n🚀 Starting migration in 3 seconds...')
  console.log('   Press Ctrl+C to cancel\n')

  // Wait 3 seconds to allow cancellation
  await new Promise(resolve => setTimeout(resolve, 3000))

  try {
    await migrateItemsToUnifiedCollection()
    console.log('\n✅ Migration completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message)
    process.exit(1)
  }
}

// Check for required environment variables
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_AUTH_DOMAIN'
]

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar])

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:')
  missingEnvVars.forEach(envVar => console.error(`   • ${envVar}`))
  console.error('\n💡 Please set these in your .env file or environment')
  process.exit(1)
}

// Run the migration
main().catch(error => {
  console.error('💥 Unexpected error:', error)
  process.exit(1)
})
