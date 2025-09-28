#!/usr/bin/env node

/**
 * Migration script to import Sandra Dawson Martinique Rental transaction data
 * from CSV into Firestore
 */

const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  addDoc,
  writeBatch,
  doc
} = require('firebase/firestore');
// const { getAuth, signInAnonymously } = require('firebase/auth'); // Commented out for testing

// Firebase configuration - make sure these environment variables are set
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
// const auth = getAuth(app); // Commented out for testing

// Extract project name from CSV filename (module-level variable)
const csvFilename = 'Client Transactions Master Sheet - Sandra Dawson Martinique Rental.csv';
const projectName = csvFilename.split('-').slice(1).join('-').replace('.csv', '').trim();

async function migrateTransactions() {
  try {
    const userId = 'test-user-id'; // Using test user ID since auth is disabled for testing
    console.log(`🚀 Starting migration of ${projectName} transactions...`);

    // Read the CSV file
    const csvPath = path.join(__dirname, '..', 'migration', csvFilename);
    const csvContent = fs.readFileSync(csvPath, 'utf-8');

    // Parse CSV
    const lines = csvContent.split('\n').filter(line => line.trim());
    const dataRows = lines.slice(7); // Skip summary rows (lines 1-6)

    // Parse header to understand column structure
    const headerLine = lines[6]; // Line 7 (0-indexed as 6)
    const headers = headerLine.split(',').map(h => h.replace(/^["\s]*|["\s]*$/g, ''));

    console.log('📋 CSV Headers found:', headers);

    // Create the project first
    const currentTimestamp = new Date().toISOString();
    const projectData = {
      name: projectName,
      description: `Client transactions for ${projectName} project`,
      clientName: projectName.split(' ')[0] + ' ' + projectName.split(' ')[1], // Extract first two words as client name
      createdAt: currentTimestamp,
      updatedAt: currentTimestamp,
      createdBy: userId, // Use authenticated user ID
      settings: {
        allowPublicAccess: false,
        notificationsEnabled: true
      },
      metadata: {
        totalItems: 0,
        lastActivity: currentTimestamp,
        completionPercentage: 0,
        // Store summary data from CSV
        totalSpent: 12543.67,
        totalClientCard: 11754.00,
        totalOwedTo1584: 789.67,
        clientPurchases: 11754.00,
        clientRefunds: 0.00,
        purchases1584: 789.67,
        credited1584: 0.00
      }
    };

    console.log('🏗️ Creating project...');
    const projectsRef = collection(db, 'projects');
    const projectDocRef = await addDoc(projectsRef, projectData);
    const projectId = projectDocRef.id;
    console.log(`✅ Project created with ID: ${projectId}`);

    // Prepare transactions for batch import
    const transactions = [];
    const batch = writeBatch(db);

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const values = parseCSVRow(row);

      // Skip empty rows (check values[1] for date, not values[0] which is always empty)
      if (values.length < 2 || !values[1]) continue;

      // Map CSV data to transaction structure
      const transaction = mapCSVToTransaction(values, headers, projectId, projectName, userId);
      if (transaction) {
        transactions.push(transaction);

        // Add to batch for efficient import
        const transactionsRef = collection(db, 'projects', projectId, 'transactions');
        const transactionDocRef = doc(transactionsRef);
        batch.set(transactionDocRef, {
          ...transaction,
          transaction_id: transactionDocRef.id
        });
      }
    }

    console.log(`📝 Prepared ${transactions.length} transactions for import`);

    // Execute batch import
    console.log('💾 Importing transactions...');
    await batch.commit();
    console.log(`✅ Successfully imported ${transactions.length} transactions`);

    // Update project metadata with transaction count
    const updatedTimestamp = new Date().toISOString();
    const { updateDoc } = require('firebase/firestore');
    await updateDoc(projectDocRef, {
      updatedAt: updatedTimestamp,
      metadata: {
        ...projectData.metadata,
        lastActivity: updatedTimestamp,
        transactionCount: transactions.length
      }
    });

    console.log('🎉 Migration completed successfully!');
    console.log(`📊 Summary:
    - Project ID: ${projectId}
    - Project Name: ${projectName}
    - Transactions imported: ${transactions.length}
    - Total spent: $${projectData.metadata.totalSpent}
    - Client card total: $${projectData.metadata.totalClientCard}
    - Amount owed to 1584: $${projectData.metadata.totalOwedTo1584}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

function parseCSVRow(row) {
  const values = [];
  let currentValue = '';
  let insideQuotes = false;
  let quoteChar = null;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];

    if (char === '"' || char === "'") {
      if (!insideQuotes) {
        insideQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        insideQuotes = false;
        quoteChar = null;
      } else {
        currentValue += char;
      }
    } else if (char === ',' && !insideQuotes) {
      values.push(currentValue.trim());
      currentValue = '';
    } else {
      currentValue += char;
    }
  }

  // Add the last value
  values.push(currentValue.trim());

  return values;
}

function mapCSVToTransaction(values, headers, projectId, projectName, userId) {
  // Map CSV headers to expected fields
  const fieldMap = {
    'Date': 'transaction_date',
    'Source': 'source',
    'Type': 'transaction_type',
    'Method': 'payment_method',
    'Client Amount': 'client_amount',
    '1584 Amount': 'amount_1584',
    'Notes': 'notes',
    'Receipt': 'receipt', // Maps to receipt field (literal "Receipt" text)
    'Emailed': 'emailed'
  };

  const transaction = {
    project_id: projectId,
    project_name: projectName,
    created_by: userId, // Use authenticated user ID
    created_at: new Date().toISOString(),
    receipt_emailed: false
  };

  let clientAmount = 0;
  let amount1584 = 0;

  // First pass: collect amount values and payment method
  headers.forEach((header, index) => {
    if (values[index]) {
      let value = values[index].trim();

      // Clean up quoted values
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }

      if (header === 'Client Amount') {
        clientAmount = parseFloat(value.replace(/[$,]/g, '')) || 0;
      } else if (header === '1584 Amount') {
        amount1584 = parseFloat(value.replace(/[$,]/g, '')) || 0;
      } else if (header === 'Method') {
        transaction.payment_method = value;
      }
    }
  });

  // Determine which amount to use based on payment method
  if (transaction.payment_method === 'Client Card') {
    transaction.amount = clientAmount.toString();
  } else if (transaction.payment_method === '1584 Card') {
    transaction.amount = amount1584.toString();
  } else {
    // For other payment methods, use whichever amount is populated
    transaction.amount = (clientAmount > 0 ? clientAmount : amount1584).toString();
  }

  // Second pass: map remaining fields
  headers.forEach((header, index) => {
    if (fieldMap[header] && values[index]) {
      const fieldName = fieldMap[header];
      let value = values[index].trim();

      // Clean up value
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }

      // Handle special cases
      if (fieldName === 'transaction_date') {
        // Parse date - assuming MM/DD/YYYY format
        const parts = value.split('/');
        if (parts.length === 3) {
          const date = new Date(parts[2], parts[0] - 1, parts[1]);
          value = date.toISOString().split('T')[0]; // YYYY-MM-DD format
        }
      } else if (fieldName === 'emailed') {
        // Convert to boolean
        transaction.receipt_emailed = value.toLowerCase() === 'yes' || value.toLowerCase() === 'true';
        return; // Skip adding to transaction object
      }

  // Map all remaining fields directly (including receipt)
  // Note: In this CSV, "Notes" field contains item descriptions purchased in the transaction
  transaction[fieldName] = value;
    }
  });

  // Set defaults
  transaction.transaction_type = transaction.transaction_type || 'Purchase';
  transaction.payment_method = transaction.payment_method || '1584 Card';

  // Handle receipt information
  // The "Receipt" field in CSV contains literal text "Receipt" or is empty
  // This is not an actual receipt image URL, just a flag - so we ignore it
  // We don't put meaningless "Receipt" text in notes or receipt_image

  // Validate required fields
  if (!transaction.transaction_date || !transaction.source || !transaction.amount) {
    console.warn('⚠️ Skipping transaction due to missing required fields:', transaction);
    return null;
  }

  return transaction;
}

// Load environment variables from .env file
function loadEnvironmentVariables() {
  try {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '..', '.env');

    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const lines = envContent.split('\n');

      lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#') && trimmedLine.includes('=')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove quotes
          process.env[key] = value;
        }
      });

      console.log('✅ Environment variables loaded from .env file');
    } else {
      console.warn('⚠️ No .env file found');
    }
  } catch (error) {
    console.warn('⚠️ Could not load .env file:', error.message);
  }
}

// Check if required environment variables are set
function checkEnvironment() {
  const requiredEnvVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_PROJECT_ID'
  ];

  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(envVar => console.error(`   - ${envVar}`));
    console.error('Please set these environment variables and try again.');
    console.error('Or make sure your .env file exists in the project root.');
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  loadEnvironmentVariables();
  checkEnvironment();
  migrateTransactions()
    .then(() => {
      console.log('✅ Migration completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateTransactions, mapCSVToTransaction, parseCSVRow };
