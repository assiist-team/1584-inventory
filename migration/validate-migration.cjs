#!/usr/bin/env node

/**
 * Validation Script: Check Current Data Structure
 *
 * This script validates the current state of projects and items
 * without making any changes, to help plan the migration.
 *
 * Usage:
 *   node migration/validate-migration.cjs
 */

// Load environment variables from .env file
require('dotenv').config()

const { initializeApp } = require('firebase/app')
const { getFirestore, collection, getDocs, query, where, limit } = require('firebase/firestore')

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
 * Main validation function
 */
async function validateCurrentStructure() {
  console.log('🔍 Validating current Firestore structure...\n')

  try {
    // Check 1: Projects collection
    console.log('📋 Checking projects collection...')
    const projectsRef = collection(db, 'projects')
    const projectsSnapshot = await getDocs(projectsRef)

    console.log(`   ✅ Found ${projectsSnapshot.docs.length} projects:`)

    for (const projectDoc of projectsSnapshot.docs) {
      const projectId = projectDoc.id
      const projectData = projectDoc.data()
      console.log(`      • ${projectData.name || 'Unnamed'} (${projectId})`)
    }

    console.log()

    // Check 2: Legacy items structure (projects/{id}/items)
    console.log('📦 Checking legacy items structure...')
    let totalLegacyItems = 0

    for (const projectDoc of projectsSnapshot.docs) {
      const projectId = projectDoc.id
      const projectData = projectDoc.data()

      try {
        const itemsRef = collection(db, 'projects', projectId, 'items')
        const itemsSnapshot = await getDocs(itemsRef)

        if (!itemsSnapshot.empty) {
          totalLegacyItems += itemsSnapshot.docs.length
          console.log(`   📁 Project "${projectData.name || projectId}": ${itemsSnapshot.docs.length} items`)

          // Show first few items as examples
          const sampleItems = itemsSnapshot.docs.slice(0, 3)
          for (const itemDoc of sampleItems) {
            const itemData = itemDoc.data()
            console.log(`      • ${itemData.description || 'No description'} (${itemDoc.id})`)
          }

          if (itemsSnapshot.docs.length > 3) {
            console.log(`      ... and ${itemsSnapshot.docs.length - 3} more items`)
          }
        }
      } catch (error) {
        console.log(`   ⚠️  Could not access items for project ${projectId}: ${error.message}`)
      }
    }

    console.log(`   📊 Total legacy items found: ${totalLegacyItems}\n`)

    // Check 3: Unified items collection (items/)
    console.log('🆕 Checking unified items collection...')
    try {
      const unifiedItemsRef = collection(db, 'items')
      const unifiedItemsSnapshot = await getDocs(unifiedItemsRef)

      if (unifiedItemsSnapshot.empty) {
        console.log('   📭 Unified items collection is empty (ready for migration)')
      } else {
        console.log(`   📋 Unified items collection has ${unifiedItemsSnapshot.docs.length} items`)

        // Check if any already have project_id field (already migrated)
        let migratedItems = 0
        let businessInventoryItems = 0

        for (const itemDoc of unifiedItemsSnapshot.docs) {
          const itemData = itemDoc.data()
          if (itemData.project_id) {
            migratedItems++
          }
          if (itemData.project_id === null) {
            businessInventoryItems++
          }
        }

        if (migratedItems > 0) {
          console.log(`      • ${migratedItems} items already have project_id (already migrated)`)
        }
        if (businessInventoryItems > 0) {
          console.log(`      • ${businessInventoryItems} business inventory items (project_id: null)`)
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Could not access unified items collection: ${error.message}`)
    }

    console.log()

    // Summary
    console.log('📋 Migration Summary:')
    console.log(`   • Projects to process: ${projectsSnapshot.docs.length}`)
    console.log(`   • Legacy items to migrate: ${totalLegacyItems}`)
    console.log(`   • Unified collection status: Ready`)

    if (totalLegacyItems > 0) {
      console.log('\n🚀 Ready for migration!')
      console.log('   Run: node migration/migrate-items-to-unified-collection.cjs')
    } else {
      console.log('\n✅ No items to migrate - all items are already in unified collection')
    }

  } catch (error) {
    console.error('❌ Validation failed:', error.message)
    console.error('💡 Make sure your Firebase configuration is correct in .env file')
  }
}

/**
 * Check specific test project from screenshot
 */
async function checkTestProject() {
  console.log('\n🔍 Checking for test project from your screenshot...')

  try {
    // Look for projects that might match the test project pattern
    const projectsRef = collection(db, 'projects')
    const projectsSnapshot = await getDocs(projectsRef)

    let testProject = null
    for (const projectDoc of projectsSnapshot.docs) {
      const projectId = projectDoc.id
      // Look for project ID that starts with T9uGla (from your screenshot)
      if (projectId.startsWith('T9uGla')) {
        testProject = {
          id: projectId,
          data: projectDoc.data()
        }
        break
      }
    }

    if (testProject) {
      console.log(`✅ Found test project: ${testProject.data.name || 'Unnamed'}`)
      console.log(`   ID: ${testProject.id}`)

      // Check items in this project
      const itemsRef = collection(db, 'projects', testProject.id, 'items')
      const itemsSnapshot = await getDocs(itemsRef)

      console.log(`   Items in test project: ${itemsSnapshot.docs.length}`)

      if (itemsSnapshot.docs.length > 0) {
        console.log('   Sample items:')
        for (const itemDoc of itemsSnapshot.docs.slice(0, 3)) {
          const itemData = itemDoc.data()
          console.log(`      • ${itemData.description || 'No description'} (${itemDoc.id})`)
        }
      }
    } else {
      console.log('❌ Test project from screenshot not found')
      console.log('   Available projects:')
      for (const projectDoc of projectsSnapshot.docs) {
        console.log(`      • ${projectDoc.data().name || 'Unnamed'} (${projectDoc.id})`)
      }
    }

  } catch (error) {
    console.log(`❌ Could not check test project: ${error.message}`)
  }
}

// Run validation
async function main() {
  await validateCurrentStructure()
  await checkTestProject()
}

main().catch(error => {
  console.error('💥 Unexpected error:', error)
  process.exit(1)
})
