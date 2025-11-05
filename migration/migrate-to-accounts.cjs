#!/usr/bin/env node

/**
 * Migration Script: Migrate Data to Account-Scoped Structure
 *
 * This script migrates existing data to the new account-scoped hierarchical structure:
 * 1. Creates a default account
 * 2. Makes first user system owner
 * 3. Maps old roles to new structure (OWNER -> owner, ADMIN -> admin, etc.)
 * 4. Migrates all data to account-scoped paths
 * 5. Creates membership documents for all users
 *
 * Usage:
 *   node migration/migrate-to-accounts.cjs
 */

require('dotenv').config()

const admin = require('firebase-admin')

// Check for service account credentials
console.log('🔑 Checking for Firebase Admin credentials...')

let credential
let projectId

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString())
    credential = admin.credential.cert(serviceAccount)
    projectId = serviceAccount.project_id
    console.log('✅ Using service account from environment variable')
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS || require('fs').existsSync('./service-account-key.json')) {
    credential = admin.credential.applicationDefault()
    const fs = require('fs')
    let firebaseProjectId = process.env.GOOGLE_CLOUD_PROJECT
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
    console.log('✅ Using Application Default Credentials')
    console.log(`   Project ID: ${projectId}`)
  } else {
    const fs = require('fs')
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account-key.json'
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
      credential = admin.credential.cert(serviceAccount)
      projectId = serviceAccount.project_id
      console.log(`✅ Using service account from ${serviceAccountPath}`)
    } else {
      console.log('❌ No Firebase Admin credentials found')
      console.log('💡 Run: gcloud auth application-default login')
      console.log('   Or set GOOGLE_APPLICATION_CREDENTIALS to point to a service account key')
      process.exit(1)
    }
  }

  admin.initializeApp({
    credential: credential,
    projectId: projectId
  })

  const db = admin.firestore()
  console.log('🚀 Firebase Admin SDK initialized successfully\n')

  /**
   * Main migration function
   */
  async function migrateToAccounts() {
    console.log('🔄 Starting migration to account-scoped structure...\n')

    try {
      // Step 1: Get all users
      console.log('📋 Fetching all users...')
      const usersRef = db.collection('users')
      const usersSnapshot = await usersRef.get()

      if (usersSnapshot.empty) {
        console.log('❌ No users found. Cannot proceed with migration.')
        return
      }

      console.log(`✅ Found ${usersSnapshot.docs.length} users\n`)

      // Step 2: Create default account
      console.log('🏢 Creating default account...')
      const defaultAccountId = 'default'
      const defaultAccountRef = db.collection('accounts').doc(defaultAccountId)
      const accountExists = await defaultAccountRef.get()

      if (!accountExists.exists) {
        await defaultAccountRef.set({
          name: 'Default Account',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        })
        console.log('✅ Created default account\n')
      } else {
        console.log('✅ Default account already exists\n')
      }

      // Step 3: Process users - assign to account and map roles
      console.log('👥 Processing users and creating memberships...')
      const batch = db.batch()
      let firstUserProcessed = false

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id
        const userData = userDoc.data()
        const oldRole = userData.role

        // Determine new role structure
        let systemRole = null
        let accountRole = 'user'

        if (oldRole === 'owner' || oldRole === 'OWNER') {
          // First owner becomes system owner
          if (!firstUserProcessed) {
            systemRole = 'owner'
            accountRole = 'admin'
            firstUserProcessed = true
            console.log(`   👑 Making ${userData.email || userId} system owner`)
          } else {
            accountRole = 'admin'
          }
        } else if (oldRole === 'admin' || oldRole === 'ADMIN') {
          accountRole = 'admin'
        } else if (oldRole === 'designer' || oldRole === 'DESIGNER') {
          accountRole = 'user'
        } else if (oldRole === 'viewer' || oldRole === 'VIEWER') {
          accountRole = 'user'
        }

        // Update user document
        const userRef = db.collection('users').doc(userId)
        const userUpdate = {
          accountId: defaultAccountId
        }
        if (systemRole) {
          userUpdate.role = systemRole
        }
        batch.update(userRef, userUpdate)

        // Create membership document
        const membershipRef = db.collection('accounts').doc(defaultAccountId).collection('members').doc(userId)
        batch.set(membershipRef, {
          userId: userId,
          accountId: defaultAccountId,
          role: accountRole,
          joinedAt: admin.firestore.FieldValue.serverTimestamp()
        })
      }

      await batch.commit()
      console.log(`✅ Processed ${usersSnapshot.docs.length} users\n`)

      // Step 4: Migrate projects
      console.log('📁 Migrating projects...')
      const projectsRef = db.collection('projects')
      const projectsSnapshot = await projectsRef.get()

      if (!projectsSnapshot.empty) {
        const projectsBatch = db.batch()
        for (const projectDoc of projectsSnapshot.docs) {
          const projectId = projectDoc.id
          const projectData = projectDoc.data()

          const newProjectRef = db.collection('accounts').doc(defaultAccountId).collection('projects').doc(projectId)
          projectsBatch.set(newProjectRef, {
            ...projectData,
            accountId: defaultAccountId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          })
        }
        await projectsBatch.commit()
        console.log(`✅ Migrated ${projectsSnapshot.docs.length} projects\n`)
      } else {
        console.log('⚠️  No projects found\n')
      }

      // Step 5: Migrate items
      console.log('📦 Migrating items...')
      const itemsRef = db.collection('items')
      const itemsSnapshot = await itemsRef.get()

      if (!itemsSnapshot.empty) {
        const batchSize = 500
        let migrated = 0

        for (let i = 0; i < itemsSnapshot.docs.length; i += batchSize) {
          const itemsBatch = db.batch()
          const batchItems = itemsSnapshot.docs.slice(i, i + batchSize)

          for (const itemDoc of batchItems) {
            const itemId = itemDoc.id
            const itemData = itemDoc.data()

            const newItemRef = db.collection('accounts').doc(defaultAccountId).collection('items').doc(itemId)
            itemsBatch.set(newItemRef, {
              ...itemData,
              accountId: defaultAccountId,
              last_updated: admin.firestore.FieldValue.serverTimestamp()
            })
          }

          await itemsBatch.commit()
          migrated += batchItems.length
          console.log(`   ✅ Migrated ${migrated}/${itemsSnapshot.docs.length} items...`)
        }
        console.log(`✅ Migrated ${itemsSnapshot.docs.length} items\n`)
      } else {
        console.log('⚠️  No items found\n')
      }

      // Step 6: Migrate transactions
      console.log('💳 Migrating transactions...')
      const transactionsRef = db.collection('transactions')
      const transactionsSnapshot = await transactionsRef.get()

      if (!transactionsSnapshot.empty) {
        const batchSize = 500
        let migrated = 0

        for (let i = 0; i < transactionsSnapshot.docs.length; i += batchSize) {
          const transactionsBatch = db.batch()
          const batchTransactions = transactionsSnapshot.docs.slice(i, i + batchSize)

          for (const transactionDoc of batchTransactions) {
            const transactionId = transactionDoc.id
            const transactionData = transactionDoc.data()

            const newTransactionRef = db.collection('accounts').doc(defaultAccountId).collection('transactions').doc(transactionId)
            transactionsBatch.set(newTransactionRef, {
              ...transactionData,
              accountId: defaultAccountId,
              last_updated: admin.firestore.FieldValue.serverTimestamp()
            })
          }

          await transactionsBatch.commit()
          migrated += batchTransactions.length
          console.log(`   ✅ Migrated ${migrated}/${transactionsSnapshot.docs.length} transactions...`)
        }
        console.log(`✅ Migrated ${transactionsSnapshot.docs.length} transactions\n`)
      } else {
        console.log('⚠️  No transactions found\n')
      }

      // Step 7: Migrate settings (tax presets)
      console.log('⚙️  Migrating settings...')
      const settingsRef = db.collection('settings')
      const settingsSnapshot = await settingsRef.get()

      if (!settingsSnapshot.empty) {
        const settingsBatch = db.batch()
        for (const settingDoc of settingsSnapshot.docs) {
          const settingId = settingDoc.id
          const settingData = settingDoc.data()

          const newSettingRef = db.collection('accounts').doc(defaultAccountId).collection('settings').doc(settingId)
          settingsBatch.set(newSettingRef, {
            ...settingData,
            accountId: defaultAccountId
          })
        }
        await settingsBatch.commit()
        console.log(`✅ Migrated ${settingsSnapshot.docs.length} settings\n`)
      } else {
        console.log('⚠️  No settings found\n')
      }

      // Step 8: Migrate audit logs
      console.log('📋 Migrating audit logs...')
      const auditLogsRef = db.collection('audit_logs')
      const auditLogsSnapshot = await auditLogsRef.get()

      if (!auditLogsSnapshot.empty) {
        const batchSize = 500
        let migrated = 0

        for (let i = 0; i < auditLogsSnapshot.docs.length; i += batchSize) {
          const auditBatch = db.batch()
          const batchLogs = auditLogsSnapshot.docs.slice(i, i + batchSize)

          for (const logDoc of batchLogs) {
            const logId = logDoc.id
            const logData = logDoc.data()

            const newLogRef = db.collection('accounts').doc(defaultAccountId).collection('audit_logs').doc(logId)
            auditBatch.set(newLogRef, {
              ...logData,
              accountId: defaultAccountId
            })
          }

          await auditBatch.commit()
          migrated += batchLogs.length
          console.log(`   ✅ Migrated ${migrated}/${auditLogsSnapshot.docs.length} audit logs...`)
        }
        console.log(`✅ Migrated ${auditLogsSnapshot.docs.length} audit logs\n`)
      } else {
        console.log('⚠️  No audit logs found\n')
      }

      // Step 9: Migrate transaction audit logs
      console.log('📋 Migrating transaction audit logs...')
      const txAuditLogsRef = db.collection('transaction_audit_logs')
      const txAuditLogsSnapshot = await txAuditLogsRef.get()

      if (!txAuditLogsSnapshot.empty) {
        const batchSize = 500
        let migrated = 0

        for (let i = 0; i < txAuditLogsSnapshot.docs.length; i += batchSize) {
          const auditBatch = db.batch()
          const batchLogs = txAuditLogsSnapshot.docs.slice(i, i + batchSize)

          for (const logDoc of batchLogs) {
            const logId = logDoc.id
            const logData = logDoc.data()

            const newLogRef = db.collection('accounts').doc(defaultAccountId).collection('transaction_audit_logs').doc(logId)
            auditBatch.set(newLogRef, {
              ...logData,
              accountId: defaultAccountId
            })
          }

          await auditBatch.commit()
          migrated += batchLogs.length
          console.log(`   ✅ Migrated ${migrated}/${txAuditLogsSnapshot.docs.length} transaction audit logs...`)
        }
        console.log(`✅ Migrated ${txAuditLogsSnapshot.docs.length} transaction audit logs\n`)
      } else {
        console.log('⚠️  No transaction audit logs found\n')
      }

      console.log('✅ Migration completed successfully!')
      console.log('\n📋 Next steps:')
      console.log('1. Run validation script: node migration/validate-accounts-migration.cjs')
      console.log('2. Test the application thoroughly')
      console.log('3. Once validated, you can remove legacy collections if desired')

    } catch (error) {
      console.error('❌ Migration failed:', error)
      throw error
    }
  }

  migrateToAccounts().catch(console.error).finally(() => {
    process.exit(0)
  })

} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin SDK:', error)
  process.exit(1)
}

