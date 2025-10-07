#!/usr/bin/env node

/**
 * Admin SDK Migration Script: Move Items from Project Subcollections to Unified Collection
 *
 * This script uses Firebase Admin SDK to migrate items with proper authentication.
 * Requires a service account key file.
 *
 * Usage:
 *   node migration/migrate-with-admin-sdk.cjs
 */

require('dotenv').config()

const admin = require('firebase-admin')
const { initializeApp } = require('firebase/app')
const { getFirestore } = require('firebase/firestore')

// Check for service account credentials
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account-key.json'

console.log('🔑 Checking for Firebase Admin credentials...')

try {
  // Try different credential sources in order of preference
  let credential
  let projectId

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    // Load from environment variable (base64 encoded)
    const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString())
    credential = admin.credential.cert(serviceAccount)
    projectId = serviceAccount.project_id
    console.log('✅ Using service account from environment variable')
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS || require('fs').existsSync('./service-account-key.json')) {
    // Use Application Default Credentials (set up via gcloud auth application-default login)
    credential = admin.credential.applicationDefault()

    // Get Firebase project ID from .env file
    const fs = require('fs')
    let firebaseProjectId = process.env.GOOGLE_CLOUD_PROJECT // fallback to gcloud project
    try {
      if (fs.existsSync('.env')) {
        const envContent = fs.readFileSync('.env', 'utf8')
        const match = envContent.match(/VITE_FIREBASE_PROJECT_ID=([^\n\r]*)/)
        if (match) {
          firebaseProjectId = match[1].trim()
        }
      }
    } catch (error) {
      console.log('⚠️  Could not read Firebase project ID from .env file')
    }

    projectId = firebaseProjectId
    console.log('✅ Using Application Default Credentials (from gcloud auth)')
    console.log(`   Project ID: ${projectId}`)
  } else {
    // Try to load from file
    const fs = require('fs')
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account-key.json'
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
      credential = admin.credential.cert(serviceAccount)
      projectId = serviceAccount.project_id
      console.log(`✅ Using service account from ${serviceAccountPath}`)
    } else {
      console.log('❌ No Firebase Admin credentials found')
      console.log('💡 You have Application Default Credentials set up, but they need to be configured for Firebase.')
      console.log('   Run: gcloud auth application-default login')
      console.log('   Or set GOOGLE_APPLICATION_CREDENTIALS to point to a service account key')
      process.exit(1)
    }
  }

  // Initialize Firebase Admin SDK
  admin.initializeApp({
    credential: credential,
    projectId: projectId
  })

  const db = admin.firestore()
  console.log('🚀 Firebase Admin SDK initialized successfully\n')

  /**
   * Main migration function
   */
  async function migrateItemsToUnifiedCollection() {
    console.log('🔄 Starting migration of items to unified collection...\n')

    try {
      // Step 1: Get all projects
      console.log('📋 Fetching all projects...')
      const projectsRef = db.collection('projects')
      const projectsSnapshot = await projectsRef.get()

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
        const itemsRef = db.collection('projects').doc(projectId).collection('items')
        const itemsSnapshot = await itemsRef.get()

        if (itemsSnapshot.empty) {
          console.log(`   ⚠️  No items found in project ${projectId}`)
          continue
        }

        console.log(`   📦 Found ${itemsSnapshot.docs.length} items to migrate`)

        // Step 3: Migrate items in batches
        const batchSize = 10
        const batches = []

        for (let i = 0; i < itemsSnapshot.docs.length; i += batchSize) {
          const batch = db.batch()
          const batchItems = itemsSnapshot.docs.slice(i, i + batchSize)

          batchItems.forEach(itemDoc => {
            const itemId = itemDoc.id
            const itemData = itemDoc.data()

            // Create the new unified item structure
            const unifiedItem = {
              ...itemData,
              project_id: projectId, // Add project reference
              inventory_status: itemData.inventory_status || 'available',
              last_updated: admin.firestore.FieldValue.serverTimestamp()
            }

            // Set the item in the unified collection
            const unifiedItemRef = db.collection('items').doc(itemId)
            batch.set(unifiedItemRef, unifiedItem)

            // Delete the old item from the project subcollection
            const oldItemRef = db.collection('projects').doc(projectId).collection('items').doc(itemId)
            batch.delete(oldItemRef)
          })

          batches.push(batch.commit())
        }

        // Step 4: Execute all batches for this project
        console.log(`   🔄 Executing ${batches.length} batches...`)

        await Promise.all(batches)
        console.log(`      ✅ All batches completed`)

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
        console.log('\n✅ Migration successful! Your test items are now in the unified collection.')
      }

    } catch (error) {
      console.error('❌ Migration failed:', error)
      console.error('🔍 Error details:', error.message)
      throw error
    }
  }

  /**
   * Validation function
   */
  async function validateMigration() {
    console.log('🔍 Validating migration...')

    try {
      // Check if unified items collection exists and has items
      const itemsRef = db.collection('items')
      const itemsSnapshot = await itemsRef.get()

      if (!itemsSnapshot.empty) {
        console.log(`⚠️  Warning: Unified items collection already contains ${itemsSnapshot.docs.length} items`)
      }

      // Check if projects exist
      const projectsRef = db.collection('projects')
      const projectsSnapshot = await projectsRef.get()

      if (projectsSnapshot.empty) {
        console.log('❌ No projects found to migrate from')
        return false
      }

      let totalLegacyItems = 0

      // Count total items in legacy structure
      for (const projectDoc of projectsSnapshot.docs) {
        const projectId = projectDoc.id
        const itemsRef = db.collection('projects').doc(projectId).collection('items')
        const itemsSnapshot = await itemsRef.get()
        totalLegacyItems += itemsSnapshot.docs.length
      }

      if (totalLegacyItems === 0) {
        console.log('❌ No items found in legacy structure to migrate')
        return false
      }

      console.log(`✅ Validation passed:`)
      console.log(`   • Found ${projectsSnapshot.docs.length} projects`)
      console.log(`   • Found ${totalLegacyItems} items to migrate`)

      return true

    } catch (error) {
      console.error('❌ Validation failed:', error.message)
      return false
    }
  }

  // Run the migration
  async function main() {
    console.log('🔧 Firebase Items Migration Tool (Admin SDK)')
    console.log('=============================================\n')

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

  // Run the migration
  main().catch(error => {
    console.error('💥 Unexpected error:', error)
    process.exit(1)
  })

} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin SDK:', error.message)
  console.error('\n💡 To run this migration, you need:')
  console.error('   1. A Firebase service account key file')
  console.error('   2. Or GOOGLE_APPLICATION_CREDENTIALS environment variable pointing to it')
  console.error('   3. Or FIREBASE_SERVICE_ACCOUNT_KEY (base64 encoded service account JSON)')
  console.error('\n📖 See: https://firebase.google.com/docs/admin/setup#initialize-sdk')
  process.exit(1)
}
