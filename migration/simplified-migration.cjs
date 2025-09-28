#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function loadEnvironmentVariables() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#') && trimmedLine.includes('=')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    });
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
  values.push(currentValue.trim());
  return values;
}

async function simplifiedMigration() {
  try {
    console.log('🔧 Starting simplified migration...');
    
    const { initializeApp } = require('firebase/app');
    const { getFirestore, collection, addDoc, writeBatch, doc } = require('firebase/firestore');

    const firebaseConfig = {
      apiKey: process.env.VITE_FIREBASE_API_KEY,
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.VITE_FIREBASE_APP_ID,
      measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
    };

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    // Read CSV data
    const csvFilename = 'Client Transactions Master Sheet - Sandra Dawson Martinique Rental.csv';
    const csvPath = path.join(__dirname, csvFilename);
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    const dataRows = lines.slice(7);
    const headerLine = lines[6];
    const headers = headerLine.split(',').map(h => h.replace(/^["\s]*|["\s]*$/g, ''));

    console.log('📋 Headers:', headers);
    console.log('📊 Data rows:', dataRows.length);

    // Create project
    const projectName = csvFilename.split('-').slice(1).join('-').replace('.csv', '').trim();
    const currentTimestamp = new Date().toISOString();
    
    const projectData = {
      name: projectName,
      description: `Client transactions for ${projectName} project`,
      clientName: projectName.split(' ')[0] + ' ' + projectName.split(' ')[1],
      createdAt: currentTimestamp,
      updatedAt: currentTimestamp,
      createdBy: 'test-user-id',
      settings: {
        allowPublicAccess: false,
        notificationsEnabled: true
      },
      metadata: {
        totalItems: 0,
        lastActivity: currentTimestamp,
        completionPercentage: 0,
        totalSpent: 12543.67,
        totalClientCard: 11754.00,
        totalOwedTo1584: 789.67,
        clientPurchases: 11754.00,
        clientRefunds: 0.00,
        purchases1584: 789.67,
        credited1584: 0.00
      }
    };

    const projectsRef = collection(db, 'projects');
    const projectDocRef = await addDoc(projectsRef, projectData);
    const projectId = projectDocRef.id;
    console.log('✅ Project created with ID:', projectId);

    // Process transactions with simplified inline mapping
    const transactions = [];
    const batch = writeBatch(db);

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const values = parseCSVRow(row);

      // Skip empty rows (check values[1] for date, not values[0] which is always empty)
      if (values.length < 2 || !values[1]) continue;

      console.log(`\n🔍 Processing row ${i + 1}:`, values);

      const transaction = {
        project_id: projectId,
        project_name: projectName,
        created_by: 'test-user-id',
        created_at: new Date().toISOString(),
        receipt_emailed: false
      };

      let clientAmount = 0;
      let amount1584 = 0;

      // First pass: collect amounts and payment method
      headers.forEach((header, index) => {
        if (values[index]) {
          let value = values[index].trim();
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

      // Determine amount based on payment method
      if (transaction.payment_method === 'Client Card') {
        transaction.amount = clientAmount.toString();
      } else if (transaction.payment_method === '1584 Card') {
        transaction.amount = amount1584.toString();
      } else {
        transaction.amount = (clientAmount > 0 ? clientAmount : amount1584).toString();
      }

      // Second pass: map other fields
      headers.forEach((header, index) => {
        if (values[index]) {
          let value = values[index].trim();
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          }

          if (header === 'Date') {
            const parts = value.split('/');
            if (parts.length === 3) {
              const date = new Date(parts[2], parts[0] - 1, parts[1]);
              value = date.toISOString().split('T')[0];
            }
            transaction.transaction_date = value;
          } else if (header === 'Emailed') {
            transaction.receipt_emailed = value.toLowerCase() === 'yes' || value.toLowerCase() === 'true';
            return;
          } else if (header === 'Source') {
            transaction.source = value;
          } else if (header === 'Type') {
            transaction.transaction_type = value;
          } else if (header === 'Notes') {
            transaction.notes = value;
          } else if (header === 'Receipt') {
            transaction.receipt = value;
          }
        }
      });

      // Set defaults
      transaction.transaction_type = transaction.transaction_type || 'Purchase';
      transaction.payment_method = transaction.payment_method || '1584 Card';

      // Validate required fields
      if (!transaction.transaction_date || !transaction.source || !transaction.amount) {
        console.log('⚠️ Skipping transaction due to missing required fields:', transaction);
        continue;
      }

      transactions.push(transaction);

      // Add to batch
      const transactionsRef = collection(db, 'projects', projectId, 'transactions');
      const transactionDocRef = doc(transactionsRef);
      batch.set(transactionDocRef, {
        ...transaction,
        transaction_id: transactionDocRef.id
      });
    }

    console.log(`📝 Prepared ${transactions.length} transactions for import`);

    if (transactions.length === 0) {
      console.log('⚠️ No valid transactions found. Migration complete with just project.');
      return;
    }

    // Execute batch import
    console.log('💾 Importing transactions...');
    await batch.commit();
    console.log(`✅ Successfully imported ${transactions.length} transactions`);

    // Update project metadata
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
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      name: error.name
    });
    process.exit(1);
  }
}

loadEnvironmentVariables();
simplifiedMigration().catch(console.error);
