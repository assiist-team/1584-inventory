# Dynamic Project Migration

This document explains how to migrate transaction data from a CSV file into your Firestore database. The project name is automatically extracted from the CSV filename.

## Overview

The migration script will:
1. Extract project name from CSV filename (everything after the hyphen)
   - Example: "Client Transactions Master Sheet - **My Project Name**.csv" → Project name: "**My Project Name**"
2. Create a new project with that dynamic name
3. Import all transactions from the CSV file
4. Store summary data in the project metadata
5. Map CSV fields to the appropriate Firestore document structure

## Prerequisites

1. **Environment Variables**: Make sure you have the following environment variables set:
   ```bash
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

2. **Dependencies**: The script requires Node.js and Firebase SDK. Install dependencies:
   ```bash
   npm install firebase
   ```

## Usage

### 1. Run the Migration Script

```bash
# Make the script executable
chmod +x migrate-sandra-dawson-transactions.cjs

# Run the migration
node migrate-sandra-dawson-transactions.cjs
```

### 2. Test the Migration (Optional)

You can test the CSV parsing and mapping logic without actually importing data:

```bash
# Test CSV parsing (replace with your actual CSV filename)
node -e "
const { parseCSVRow, mapCSVToTransaction } = require('./migrate-sandra-dawson-transactions.cjs');
const fs = require('fs');
const csvFilename = 'Client Transactions Master Sheet - Your Project Name.csv';
const csvContent = fs.readFileSync('./' + csvFilename, 'utf-8');
const lines = csvContent.split('\n').filter(line => line.trim());
const headerLine = lines[6];
const headers = headerLine.split(',').map(h => h.replace(/^[\"\\s]*|[\"\\s]*$/g, ''));
const testRow = lines[7]; // First data row
const values = parseCSVRow(testRow);
const projectName = csvFilename.split('-').slice(1).join('-').replace('.csv', '').trim();
console.log('Project name extracted:', projectName);
const transaction = mapCSVToTransaction(values, headers, 'test-project-id', projectName);
console.log('Test transaction:', transaction);
"
```

## CSV Data Structure

The CSV file contains:

### Summary Data (Lines 1-6)
- Project name: (extracted from filename after hyphen)
- Total spent: $12,543.67
- Client card total: $11,754.00
- Amount owed to 1584: $789.67

### Headers (Line 7)
- Date
- Source
- Type
- Method
- Client Amount
- 1584 Amount
- Notes
- Receipt
- Emailed

### Transaction Data (Lines 8+)
Each row represents a transaction with the above fields.

## Data Mapping

The script maps CSV fields to Firestore transaction documents as follows:

| CSV Field | System Field | Processing/Notes |
|-----------|----------------|-------|
| Date | transaction_date | Converted to YYYY-MM-DD format |
| Source | source | Store name/vendor |
| Type | transaction_type | Transaction type (default: "Purchase") |
| Method | payment_method | Payment method used |
| Client Amount | client_amount | Amount charged to client |
| 1584 Amount | amount | Amount charged to 1584 (primary amount) |
| Notes | notes | Transaction details (what was purchased) |
| Receipt | receipt | Literal "Receipt" text (flag indicating receipt exists) |
| Emailed | receipt_emailed | Boolean flag |

## Project Structure Created

The migration creates:

### Project Document
- **Collection**: `projects`
- **Name**: (extracted from CSV filename after hyphen)
- **Client**: (first two words of project name, e.g., "Sandra Dawson")
- **Metadata**: Includes summary data from CSV

### Transaction Documents
- **Collection**: `projects/{projectId}/transactions`
- **Fields**: All mapped transaction data
- **Count**: (varies based on CSV data)

## Validation

After running the migration:

1. **Check the Project**: Look for the new project in your Firestore console
2. **Verify Transactions**: Check that all 4 transactions were imported
3. **Validate Data**: Ensure amounts and dates match the CSV
4. **Test Integration**: Verify the project appears in your React app

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**
   - Error: "Missing required environment variables"
   - Solution: Set all VITE_FIREBASE_* environment variables

2. **CSV Parsing Errors**
   - Error: "Skipping transaction due to missing required fields"
   - Solution: Check CSV format and ensure required fields have values

3. **Firebase Connection Issues**
   - Error: "Firebase: Error (auth/network-request-failed)"
   - Solution: Check your Firebase configuration and network connection

### Debug Mode

To enable debug output, modify the script to add more logging:

```javascript
// Add this at the top of migrateTransactions()
console.log('CSV content preview:', csvContent.substring(0, 500));
console.log('Data rows count:', dataRows.length);
```

## Rollback

If you need to rollback the migration:

1. **Delete the Project**: Remove the project document from Firestore
2. **Delete Transactions**: All transactions will be deleted with the project
3. **Check Dependencies**: Verify no items were created from these transactions

## Security Notes

- The script uses batch operations for efficient data import
- Transaction IDs are auto-generated by Firestore
- The script includes basic validation but you should verify data integrity after import
- Consider backing up your Firestore data before running migrations

## Next Steps

After successful migration:

1. **Create Items**: Consider creating inventory items from these transactions
2. **Update Project Settings**: Adjust project settings as needed
3. **Test UI**: Verify the imported data displays correctly in your React app
4. **Archive CSV**: Move the original CSV file to an archive folder

## Support

If you encounter issues with the migration:

1. Check the console output for detailed error messages
2. Verify your Firebase configuration
3. Test the CSV parsing logic separately
4. Review the Firestore security rules to ensure write permissions
