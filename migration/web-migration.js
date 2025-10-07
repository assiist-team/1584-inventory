/**
 * Web Migration Script
 *
 * This script can be run in the browser console when authenticated to your Firebase app,
 * or integrated into your React app as a temporary migration component.
 *
 * To use:
 * 1. Open your app in the browser (must be authenticated)
 * 2. Open browser console
 * 3. Copy and paste this script
 * 4. Run: runMigration()
 */

// Import Firebase services (adjust paths as needed for your app)
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  getFirestore
} from 'firebase/firestore'

// Initialize Firebase (use your existing initialization)
const db = getFirestore()

/**
 * Main migration function - run this in browser console
 */
window.runMigration = async function() {
  console.log('🚀 Starting web-based migration...')

  try {
    // Step 1: Get all projects
    console.log('📋 Fetching all projects...')
    const projectsRef = collection(db, 'projects')
    const projectsSnapshot = await getDocs(projectsRef)

    if (projectsSnapshot.empty) {
      console.log('❌ No projects found.')
      return
    }

    console.log(`✅ Found ${projectsSnapshot.docs.length} projects`)

    let totalItemsMigrated = 0
    let totalProjectsProcessed = 0

    // Step 2: Process each project
    for (const projectDoc of projectsSnapshot.docs) {
      const projectId = projectDoc.id
      const projectData = projectDoc.data()

      console.log(`🏗️  Processing project: ${projectData.name || projectId}`)

      // Get all items for this project
      const itemsRef = collection(db, 'projects', projectId, 'items')
      const itemsSnapshot = await getDocs(itemsRef)

      if (itemsSnapshot.empty) {
        console.log(`   ⚠️  No items found in project ${projectId}`)
        continue
      }

      console.log(`   📦 Found ${itemsSnapshot.docs.length} items to migrate`)

      // Step 3: Migrate items in batches
      const batchSize = 10
      for (let i = 0; i < itemsSnapshot.docs.length; i += batchSize) {
        const batch = writeBatch(db)
        const batchItems = itemsSnapshot.docs.slice(i, i + batchSize)

        batchItems.forEach(itemDoc => {
          const itemId = itemDoc.id
          const itemData = itemDoc.data()

          // Create the new unified item structure
          const unifiedItem = {
            ...itemData,
            project_id: projectId,
            inventory_status: itemData.inventory_status || 'available'
          }

          // Set the item in the unified collection
          const unifiedItemRef = doc(db, 'items', itemId)
          batch.set(unifiedItemRef, unifiedItem)

          // Delete the old item
          const oldItemRef = doc(db, 'projects', projectId, 'items', itemId)
          batch.delete(oldItemRef)
        })

        // Commit the batch
        await batch.commit()
        console.log(`   ✅ Batch ${Math.floor(i / batchSize) + 1} completed`)
      }

      totalItemsMigrated += itemsSnapshot.docs.length
      totalProjectsProcessed++
      console.log(`   ✅ Migrated ${itemsSnapshot.docs.length} items from ${projectData.name}`)
    }

    // Step 4: Summary
    console.log('\n🎉 Migration completed!')
    console.log(`📊 Summary:`)
    console.log(`   • Projects processed: ${totalProjectsProcessed}`)
    console.log(`   • Total items migrated: ${totalItemsMigrated}`)
    console.log(`   • Items are now in the unified 'items' collection`)

    return {
      projectsProcessed: totalProjectsProcessed,
      itemsMigrated: totalItemsMigrated
    }

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  }
}

/**
 * Validation function - check what would be migrated
 */
window.validateMigration = async function() {
  console.log('🔍 Validating migration...')

  try {
    const projectsRef = collection(db, 'projects')
    const projectsSnapshot = await getDocs(projectsRef)

    console.log(`Found ${projectsSnapshot.docs.length} projects`)

    let totalItems = 0
    for (const projectDoc of projectsSnapshot.docs) {
      const projectId = projectDoc.id
      const itemsRef = collection(db, 'projects', projectId, 'items')
      const itemsSnapshot = await getDocs(itemsRef)
      totalItems += itemsSnapshot.docs.length

      if (itemsSnapshot.docs.length > 0) {
        console.log(`   ${projectDoc.data().name}: ${itemsSnapshot.docs.length} items`)
      }
    }

    console.log(`\n📊 Would migrate ${totalItems} items from ${projectsSnapshot.docs.length} projects`)

    return {
      projects: projectsSnapshot.docs.length,
      totalItems: totalItems
    }

  } catch (error) {
    console.error('❌ Validation failed:', error)
    throw error
  }
}

// Export for use in React component if needed
export { runMigration, validateMigration }
