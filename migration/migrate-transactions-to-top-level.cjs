#!/usr/bin/env node

/**
 * Migration script to move transactions from project subcollections to top-level collection
 *
 * Usage: node migration/migrate-transactions-to-top-level.cjs
 */

require('dotenv').config()

const admin = require('firebase-admin')

// Check for service account credentials (following pattern from existing migration scripts)
console.log('🔑 Checking for Firebase Admin credentials...')

let credential
let projectId

if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  // Load from environment variable (base64 encoded)
  const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString())
  credential = admin.credential.cert(serviceAccount)
  projectId = serviceAccount.project_id
  console.log('✅ Using service account from environment variable')
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS || require('fs').existsSync(require('os').homedir() + '/.config/gcloud/application_default_credentials.json')) {
  // Use Application Default Credentials (check both env var and default location)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('✅ Using Application Default Credentials from GOOGLE_APPLICATION_CREDENTIALS')
  } else {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = require('os').homedir() + '/.config/gcloud/application_default_credentials.json'
    console.log('✅ Using Application Default Credentials from default gcloud location')
  }
  credential = admin.credential.applicationDefault()
  projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.VITE_FIREBASE_PROJECT_ID
} else {
  console.log('❌ No Firebase Admin credentials found.')
  console.log('Please set one of:')
  console.log('  - FIREBASE_SERVICE_ACCOUNT_KEY (base64 encoded service account JSON)')
  console.log('  - GOOGLE_APPLICATION_CREDENTIALS (path to service account file)')
  console.log('  - Run: gcloud auth application-default login')
  process.exit(1)
}

admin.initializeApp({
  credential: credential,
  projectId: projectId
})

const db = admin.firestore()

/**
 * Migrates all transactions from project subcollections to top-level collection
 */
async function migrateTransactions() {
  console.log('🚀 Starting transaction migration...')

  try {
    // Get all projects
    const projectsSnapshot = await db.collection('projects').get()
    const projects = projectsSnapshot.docs

    console.log(`📋 Found ${projects.length} projects to migrate`)

    let totalMigrated = 0
    let totalSkipped = 0

    // Process each project
    for (const projectDoc of projects) {
      const projectId = projectDoc.id
      const projectData = projectDoc.data()

      console.log(`\n🏗️  Processing project: ${projectData.name} (${projectId})`)

      // Get all transactions for this project
      const transactionsSnapshot = await db.collection('projects').doc(projectId).collection('transactions').get()

      if (transactionsSnapshot.empty) {
        console.log(`   ⏭️  No transactions found for project ${projectId}`)
        continue
      }

      console.log(`   📦 Found ${transactionsSnapshot.size} transactions to migrate`)

      // Migrate each transaction
      for (const transactionDoc of transactionsSnapshot.docs) {
        const transactionId = transactionDoc.id
        const transactionData = transactionDoc.data()

        try {
          // Prepare the new transaction document data
          const newTransactionData = {
            ...transactionData,
            project_id: projectId,
            transaction_id: transactionId,
            created_at: transactionData.created_at || new Date().toISOString(),
            // Ensure required fields are present
            project_name: projectData.name || null,
            last_updated: transactionData.last_updated || new Date().toISOString()
          }

          // Write to top-level collection (preserving original document ID)
          await db.collection('transactions').doc(transactionId).set(newTransactionData)

          // Optional: Mark legacy document as migrated
          await transactionDoc.ref.update({
            migrated: true,
            migrated_at: new Date().toISOString()
          })

          console.log(`   ✅ Migrated transaction: ${transactionId}`)
          totalMigrated++

        } catch (error) {
          console.error(`   ❌ Error migrating transaction ${transactionId}:`, error)
          totalSkipped++
        }
      }
    }

    console.log(`\n🎉 Migration completed!`)
    console.log(`   ✅ Migrated: ${totalMigrated} transactions`)
    console.log(`   ❌ Skipped: ${totalSkipped} transactions`)

    if (totalSkipped > 0) {
      console.log(`\n⚠️  Some transactions failed to migrate. Check the logs above for details.`)
    }

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    // Close Firebase connection
    await admin.app().delete()
  }
}

/**
 * Validates that the migration completed successfully
 */
async function validateMigration() {
  console.log('\n🔍 Validating migration...')

  try {
    // Count transactions in top-level collection
    const topLevelSnapshot = await db.collection('transactions').get()
    const topLevelCount = topLevelSnapshot.size

    // Count transactions in legacy collections
    const projectsSnapshot = await db.collection('projects').get()
    let legacyCount = 0

    for (const projectDoc of projectsSnapshot.docs) {
      const projectId = projectDoc.id
      const transactionsSnapshot = await db.collection('projects').doc(projectId).collection('transactions').get()
      legacyCount += transactionsSnapshot.size
    }

    console.log(`   📊 Top-level transactions: ${topLevelCount}`)
    console.log(`   📊 Legacy transactions: ${legacyCount}`)

    if (topLevelCount > 0) {
      console.log('   ✅ Migration appears successful')
    } else {
      console.log('   ⚠️  No transactions found in top-level collection')
    }

  } catch (error) {
    console.error('❌ Validation failed:', error)
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🔄 Transaction Migration Script')
  console.log('================================')

  // Run migration
  await migrateTransactions()

  // Validate results
  await validateMigration()

  console.log('\n✨ Migration process completed!')
  process.exit(0)
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error)
  process.exit(1)
})

// Run the script
main().catch((error) => {
  console.error('❌ Script failed:', error)
  process.exit(1)
})
