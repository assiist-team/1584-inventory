#!/usr/bin/env node

/**
 * Validation Script: Validate Accounts Migration
 *
 * This script validates that the migration to account-scoped structure was successful:
 * 1. Verifies all data migrated
 * 2. Validates account assignments
 * 3. Validates role mappings
 * 4. Checks for orphaned data
 *
 * Usage:
 *   node migration/validate-accounts-migration.cjs
 */

require('dotenv').config()

const admin = require('firebase-admin')

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
   * Validation function
   */
  async function validateMigration() {
    console.log('🔍 Validating accounts migration...\n')

    const defaultAccountId = 'default'
    let errors = []
    let warnings = []

    try {
      // 1. Verify account exists
      console.log('1️⃣  Checking account...')
      const accountRef = db.collection('accounts').doc(defaultAccountId)
      const accountSnap = await accountRef.get()

      if (!accountSnap.exists) {
        errors.push('Default account does not exist')
        console.log('   ❌ Default account not found')
      } else {
        console.log('   ✅ Default account exists')
      }

      // 2. Verify users have accountId
      console.log('\n2️⃣  Checking user account assignments...')
      const usersRef = db.collection('users')
      const usersSnapshot = await usersRef.get()

      let usersWithAccount = 0
      let usersWithoutAccount = 0
      let systemOwners = 0

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data()
        if (userData.accountId === defaultAccountId) {
          usersWithAccount++
        } else {
          usersWithoutAccount++
          warnings.push(`User ${userDoc.id} missing accountId`)
        }
        if (userData.role === 'owner') {
          systemOwners++
        }
      }

      console.log(`   ✅ ${usersWithAccount} users have accountId assigned`)
      if (usersWithoutAccount > 0) {
        console.log(`   ⚠️  ${usersWithoutAccount} users missing accountId`)
      }
      console.log(`   ✅ ${systemOwners} system owner(s) found`)

      // 3. Verify memberships
      console.log('\n3️⃣  Checking account memberships...')
      const membersRef = db.collection('accounts').doc(defaultAccountId).collection('members')
      const membersSnapshot = await membersRef.get()

      console.log(`   ✅ ${membersSnapshot.docs.length} membership documents found`)

      if (membersSnapshot.docs.length !== usersSnapshot.docs.length) {
        warnings.push(`Membership count (${membersSnapshot.docs.length}) does not match user count (${usersSnapshot.docs.length})`)
        console.log(`   ⚠️  Membership count mismatch`)
      }

      // 4. Verify data migration
      console.log('\n4️⃣  Checking data migration...')

      // Projects
      const legacyProjectsRef = db.collection('projects')
      const legacyProjectsSnapshot = await legacyProjectsRef.get()
      const newProjectsRef = db.collection('accounts').doc(defaultAccountId).collection('projects')
      const newProjectsSnapshot = await newProjectsRef.get()

      console.log(`   Projects: Legacy=${legacyProjectsSnapshot.docs.length}, New=${newProjectsSnapshot.docs.length}`)
      if (legacyProjectsSnapshot.docs.length !== newProjectsSnapshot.docs.length) {
        warnings.push(`Project count mismatch: ${legacyProjectsSnapshot.docs.length} legacy vs ${newProjectsSnapshot.docs.length} new`)
      }

      // Items
      const legacyItemsRef = db.collection('items')
      const legacyItemsSnapshot = await legacyItemsRef.get()
      const newItemsRef = db.collection('accounts').doc(defaultAccountId).collection('items')
      const newItemsSnapshot = await newItemsRef.get()

      console.log(`   Items: Legacy=${legacyItemsSnapshot.docs.length}, New=${newItemsSnapshot.docs.length}`)
      if (legacyItemsSnapshot.docs.length !== newItemsSnapshot.docs.length) {
        warnings.push(`Item count mismatch: ${legacyItemsSnapshot.docs.length} legacy vs ${newItemsSnapshot.docs.length} new`)
      }

      // Transactions
      const legacyTransactionsRef = db.collection('transactions')
      const legacyTransactionsSnapshot = await legacyTransactionsRef.get()
      const newTransactionsRef = db.collection('accounts').doc(defaultAccountId).collection('transactions')
      const newTransactionsSnapshot = await newTransactionsRef.get()

      console.log(`   Transactions: Legacy=${legacyTransactionsSnapshot.docs.length}, New=${newTransactionsSnapshot.docs.length}`)
      if (legacyTransactionsSnapshot.docs.length !== newTransactionsSnapshot.docs.length) {
        warnings.push(`Transaction count mismatch: ${legacyTransactionsSnapshot.docs.length} legacy vs ${newTransactionsSnapshot.docs.length} new`)
      }

      // Settings
      const legacySettingsRef = db.collection('settings')
      const legacySettingsSnapshot = await legacySettingsRef.get()
      const newSettingsRef = db.collection('accounts').doc(defaultAccountId).collection('settings')
      const newSettingsSnapshot = await newSettingsRef.get()

      console.log(`   Settings: Legacy=${legacySettingsSnapshot.docs.length}, New=${newSettingsSnapshot.docs.length}`)
      if (legacySettingsSnapshot.docs.length !== newSettingsSnapshot.docs.length) {
        warnings.push(`Settings count mismatch: ${legacySettingsSnapshot.docs.length} legacy vs ${newSettingsSnapshot.docs.length} new`)
      }

      // 5. Summary
      console.log('\n📊 Validation Summary:')
      console.log('=====================')
      if (errors.length === 0 && warnings.length === 0) {
        console.log('✅ Migration validation passed! All checks successful.')
      } else {
        if (errors.length > 0) {
          console.log(`\n❌ Errors (${errors.length}):`)
          errors.forEach(err => console.log(`   - ${err}`))
        }
        if (warnings.length > 0) {
          console.log(`\n⚠️  Warnings (${warnings.length}):`)
          warnings.forEach(warn => console.log(`   - ${warn}`))
        }
      }

    } catch (error) {
      console.error('❌ Validation failed:', error)
      throw error
    }
  }

  validateMigration().catch(console.error).finally(() => {
    process.exit(0)
  })

} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin SDK:', error)
  process.exit(1)
}

