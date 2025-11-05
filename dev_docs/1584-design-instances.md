<!-- Mapping document: replace 1584-specific references with a generic placeholder -->
# Mapping: 1584-specific → generic "Design Business"

This document maps hard-coded, 1584-specific strings found in the codebase to their updated, generic replacements that should be used when refactoring source files and developer docs.

Replacement conventions
- UI / company name occurrences → `Design Business`
- Reimbursement / transaction phrases → same phrase with company substituted (e.g. `Client Owes Design Business`)
- Domain / URL occurrences → use the placeholder `<design-business-domain>` for the domain part (e.g. `inventory.<design-business-domain>`)
- Cache/build prefixes → use `<design-business>-inventory-<hash>` or similar

---

## Exact mapping table

```text
"1584 Design"                     -> "Design Business"
"1584" (standalone short name)   -> "Design Business"

"Client Owes 1584"                -> "Client Owes Design Business"
"1584 Owes Client"                -> "Design Business Owes Client"

"1584 Inventory"                  -> "Design Business Inventory"
"1584 Inventory Sale"             -> "Design Business Inventory Sale"
"1584 Inventory Purchase"         -> "Design Business Inventory Purchase"

payment_method: '1584'              -> payment_method: 'Design Business'
"1584 Card"                        -> "Design Business Card"

"inventory.1584design.com"         -> "inventory.<design-business-domain>"
"https://inventory.1584design.com" -> "https://inventory.<design-business-domain>"

"1584 Design Inventory & Transactions" -> "Design Business Inventory & Transactions"
"1584 Project Portal logo"               -> "Design Business Project Portal logo"

"1584-inventory-<hash>"             -> "<design-business>-inventory-<hash>"
```

---

## Locations & matched lines

The following are the files and the exact matched lines found in the repository. Use the mapping table above to update these occurrences.

`cors.json`
```json
"https://inventory.1584design.com"
```

`src/pages/AddTransaction.tsx`
```tsx
                  value="1584 Design"
                  checked={formData.payment_method === '1584 Design'}
                  1584 Design
                  value="Client Owes 1584"
                  checked={formData.reimbursement_type === 'Client Owes 1584'}
                  Client Owes 1584
                  value="1584 Owes Client"
                  checked={formData.reimbursement_type === '1584 Owes Client'}
                  1584 Owes Client
```

`src/pages/AddBusinessInventoryTransaction.tsx`
```tsx
    reimbursement_type: '' as '' | 'Client Owes 1584' | '1584 Owes Client' | null | undefined,
                  value="Client Owes 1584"
                  checked={formData.reimbursement_type === 'Client Owes 1584'}
                  Client Owes 1584
                  value="1584 Owes Client"
                  checked={formData.reimbursement_type === '1584 Owes Client'}
                  1584 Owes Client
```

`src/pages/EditBusinessInventoryTransaction.tsx`
```tsx
    reimbursement_type: '' as '' | 'Client Owes 1584' | '1584 Owes Client' | null | undefined,
                  value="Client Owes 1584"
                  checked={formData.reimbursement_type === 'Client Owes 1584'}
                  Client Owes 1584
                  value="1584 Owes Client"
                  checked={formData.reimbursement_type === '1584 Owes Client'}
                  1584 Owes Client
```

`src/pages/EditTransaction.tsx`
```tsx
                  value="1584 Design"
                  checked={formData.payment_method === '1584 Design'}
                  1584 Design
                  value="Client Owes 1584"
                  checked={formData.reimbursement_type === 'Client Owes 1584'}
                  Client Owes 1584
                  value="1584 Owes Client"
                  checked={formData.reimbursement_type === '1584 Owes Client'}
                  1584 Owes Client
```

`src/pages/BusinessInventory.tsx`
```ts
if (transaction.transaction_id?.startsWith('INV_SALE_')) return '1584 Inventory Sale'
if (transaction.transaction_id?.startsWith('INV_PURCHASE_')) return '1584 Inventory Purchase'
        <h1 className="text-3xl font-bold text-gray-900">1584 Inventory</h1>
```

`src/types/index.ts`
```ts
project_price?: string;       // What we sell it for (1584 design project price) - formerly resale_price
reimbursement_type?: 'Client Owes 1584' | '1584 Owes Client' | '' | null | undefined;
```

`src/services/inventoryService.ts`
```ts
where('reimbursement_type', 'in', ['Client Owes 1584', '1584 Owes Client']),
reimbursement_type: transactionType === 'Purchase' ? 'Client Owes 1584' : '1584 Owes Client',
reimbursement_type: '1584 Owes Client' as const,  // We owe the client for this purchase
source: 'Inventory',  // Project purchasing inventory from 1584
transaction_type: 'Purchase',  // Project purchasing inventory from 1584
reimbursement_type: 'Client Owes 1584' as const,
project_price: businessItemData.project_price, // 1584 design project price from business inventory
payment_method: '1584', // Default payment method for allocated items
reimbursement_type: '1584 Owes Client' as const,  // We owe the client for this purchase
```

`src/pages/TransactionDetail.tsx`
```ts
return '1584 Inventory Sale'
return '1584 Inventory Purchase'
{transaction.reimbursement_type === 'Client Owes 1584' ? 'Client Owes 1584' : '1584 Owes Client'}
```

`src/pages/TransactionsList.tsx`
```ts
if (transaction.transaction_id?.startsWith('INV_SALE_')) return '1584 Inventory Sale'
if (transaction.transaction_id?.startsWith('INV_PURCHASE_')) return '1584 Inventory Purchase'
filtered = filtered.filter(t => t.reimbursement_type === '1584 Owes Client')
filtered = filtered.filter(t => t.reimbursement_type === 'Client Owes 1584')
```

`src/pages/ProjectDetail.tsx`
```ts
// For "owed to 1584", we want transactions where the client owes 1584
// This happens when 1584 paid for the transaction
const isExplicitlyClientOwes = transaction.status === 'pending' && transaction.reimbursement_type === 'Client Owes 1584'
transaction.payment_method === '1584 Card'
console.log('Owed to 1584 - Client Owes transactions:', clientOwesTransactions.length)
// For "owed to client", we want transactions where 1584 owes the client
const isExplicitlyWeOwe = transaction.status === 'pending' && transaction.reimbursement_type === '1584 Owes Client'
{/* Owed to 1584 */}
<div className="text-sm font-medium text-gray-600 mb-0.5">Owed to 1584</div>
```

`src/pages/ProjectInvoice.tsx`
```ts
if (transaction.transaction_id?.startsWith('INV_SALE_')) return '1584 Inventory Sale'
if (transaction.transaction_id?.startsWith('INV_PURCHASE_')) return '1584 Inventory Purchase'
.filter(t => (t.reimbursement_type === 'Client Owes 1584' || t.reimbursement_type === '1584 Owes Client'))
.filter(l => l.transaction.reimbursement_type === 'Client Owes 1584')
.filter(l => l.transaction.reimbursement_type === '1584 Owes Client')
alt="1584 Project Portal logo"
```

`src/components/layout/Header.tsx`
```tsx
1584 Design
```

`dist/sw.js`
```js
e.setCacheNameDetails({prefix:"1584-inventory-1760066834249"})
```

`dist/index.html`
```html
<meta name="description" content="1584 Design Inventory & Transactions - Modern, mobile-first inventory system" />
<meta name="apple-mobile-web-app-title" content="1584 Design Inventory & Transactions" />
<title>1584 Design Inventory & Transactions</title>
```

`dist/manifest.webmanifest`
```json
{"name":"1584 Design Inventory & Transactions","short_name":"1584 Design Projects","description":"Modern, mobile-first inventory management system"}
```

`dist/assets/EditItem.js.map`
```json
"return '1584 Inventory Sale'" (inside source-mapped content)
```

`dist/assets/AddBusinessInventoryItem.js` and built assets
```js
"1584 Inventory Sale" / "1584 Inventory Purchase" and other built references (minified/compiled)
```

---

If you want, I can:

- Replace these hard-coded strings with a single exported constant like `COMPANY_NAME` in `src/constants/company.ts` and update references.
- Provide a diff/edits to perform the refactor automatically.

<!-- End mapping & locations document -->


