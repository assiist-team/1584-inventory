#!/usr/bin/env node

/**
 * Migration script to update item dispositions from old "return" value to new "to return" value
 *
 * Usage:
 *   node migrate-disposition-values.cjs
 *
 * This script will:
 * 1. Find all items with disposition = "return"
 * 2. Update them to use disposition = "to return"
 * 3. Log the changes made
 */

// Load environment variables from .env file
require('dotenv').config({ path: '../.env' });

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, writeBatch, doc, updateDoc } = require('firebase/firestore');

// Firebase configuration - these should match your .env file
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Validate required environment variables
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please ensure all VITE_FIREBASE_* environment variables are set.');
  process.exit(1);
}

let db;
let batch;

async function initializeFirebase() {
  try {
    console.log('🔥 Initializing Firebase...');
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    batch = writeBatch(db);
    console.log('✅ Firebase initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error.message);
    process.exit(1);
  }
}

async function migrateDispositions() {
  try {
    console.log('🔍 Finding all projects...');
    const projectsRef = collection(db, 'projects');
    const projectsSnapshot = await getDocs(projectsRef);

    if (projectsSnapshot.empty) {
      console.log('⚠️  No projects found. Nothing to migrate.');
      return;
    }

    let totalItemsUpdated = 0;
    const projects = projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    for (const project of projects) {
      console.log(`\n📁 Processing project: ${project.name} (ID: ${project.id})`);

      // Get all items for this project
      const itemsRef = collection(db, 'projects', project.id, 'items');
      const itemsSnapshot = await getDocs(itemsRef);

      if (itemsSnapshot.empty) {
        console.log(`   ⚠️  No items found in project ${project.name}`);
        continue;
      }

      let itemsUpdatedInProject = 0;
      const items = itemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      for (const item of items) {
        if (item.disposition === 'return') {
          console.log(`   🔄 Updating item ${item.item_id}: "${item.disposition}" → "to return"`);

          const itemRef = doc(db, 'projects', project.id, 'items', item.id);
          batch.update(itemRef, {
            disposition: 'to return',
            last_updated: new Date().toISOString()
          });

          itemsUpdatedInProject++;
          totalItemsUpdated++;
        }
      }

      if (itemsUpdatedInProject > 0) {
        console.log(`   ✅ Updated ${itemsUpdatedInProject} items in project ${project.name}`);
      } else {
        console.log(`   ✅ No items needed updating in project ${project.name}`);
      }
    }

    // Commit all updates
    if (totalItemsUpdated > 0) {
      console.log(`\n💾 Committing ${totalItemsUpdated} updates...`);
      await batch.commit();
      console.log(`✅ Successfully migrated ${totalItemsUpdated} items from "return" to "to return"`);
    } else {
      console.log('\n✅ No items needed migration - all dispositions are already up to date');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

async function main() {
  console.log('🚀 Starting disposition migration...\n');

  await initializeFirebase();
  await migrateDispositions();

  console.log('\n🎉 Migration completed successfully!');
  process.exit(0);
}

// Run the migration
main().catch(error => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});
