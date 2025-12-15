## QuickBooks: Generate Invoice Draft Button — Plan

### Overview
- **Goal**: Add a button in our app that creates an invoice draft in QuickBooks Online (QBO) from our existing invoices.
- **Ease**: Low-to-medium complexity.
- **Timeline**: ~1–3 days for MVP if QBO is already connected; 1–3 days more if OAuth needs adding.

### Assumptions
- **Platform**: QuickBooks Online (not Desktop).
- **Data**: Our app has invoices with customer info, line items, amounts, optional taxes.
- **Draft semantics**: QBO has no explicit Draft state; an invoice not emailed/printed is effectively a draft (unsent, open).

### User Flow
1. User clicks "Generate in QuickBooks" on an invoice in our app.
2. If not connected to QBO, user is prompted to connect (OAuth 2.0).
3. We map our invoice fields to QBO and call the QBO API to create an invoice.
4. We store the returned QBO `Id` and display a "View in QuickBooks" link.

### Technical Design
- **OAuth and Company Context**
  - Use QBO OAuth 2.0 with scope `com.intuit.quickbooks.accounting`.
  - Persist `realmId` (company id), access token, and refresh token per tenant.
- **Mapping: Our Invoice → QBO Invoice**
  - `CustomerRef`: Map to an existing QBO customer. If missing, auto-create or prompt.
  - `Line` items: Prefer `SalesItemLineDetail` with an `ItemRef`; fall back to description-only lines if needed.
  - `TxnDate`: Invoice date; `DueDate`: optional.
  - `DocNumber`: Optional unique number (requires QBO setting “Custom transaction numbers”).
  - `PrivateNote`: Optional reference back to our invoice (e.g., our invoice id).
  - Taxes: Use QBO `TxnTaxDetail`/TaxCodes if configured; otherwise keep untaxed for MVP.
- **Draft Behavior**
  - Do not email or print; do not trigger send actions.
  - Ensure `EmailStatus`/`PrintStatus` not set to “NeedToSend”.
- **Idempotency**
  - On create success, persist the QBO `Id` on our invoice to prevent duplicates.
  - Optionally set a unique `DocNumber` to guard against re-creates.
- **Multi-company**
  - Store tokens and `realmId` per tenant/account; route API calls accordingly.

### API Interaction
- **Endpoint**: `POST /v3/company/{realmId}/invoice`
- **Docs**: [QuickBooks Invoice API](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/most-commonly-used/invoice)
- **Minimum viable payload** (example):

```json
{
  "CustomerRef": { "value": "123" },
  "TxnDate": "2025-10-25",
  "PrivateNote": "Our invoice #INV-123",
  "Line": [
    {
      "DetailType": "SalesItemLineDetail",
      "Amount": 100.0,
      "Description": "Consulting hours",
      "SalesItemLineDetail": {
        "ItemRef": { "value": "1" },
        "Qty": 1,
        "UnitPrice": 100.0
      }
    }
  ]
}
```

### Edge Cases and Gotchas
- **Customer mapping**: Customer must exist in QBO. Strategy: look up by email/external id; create if missing (MVP may prompt instead).
- **Item mapping**: Lines typically need `ItemRef`. MVP may use a default "Services" item for service lines.
- **Taxes**: Regional differences (US sales tax vs VAT/GST). MVP can skip taxes or use a default TaxCode if configured.
- **Currency**: If multi-currency enabled, ensure currency matches or omit for default.
- **Duplicates**: Guard with persisted QBO `Id` or `DocNumber`.

### Security and Permissions
- **Scope**: `com.intuit.quickbooks.accounting`.
- **Storage**: Encrypt tokens at rest; rotate via refresh token; least privilege in backend.
- **Testing**: Use QBO Sandbox before production.

### Effort Estimate
- **If QBO already connected**: 0.5–1 day (button, mapping, API call, link-back).
- **If OAuth not present**: +1–3 days (OAuth UI/flow, token storage).
- **Robust sync (auto-create customers/items, complex tax, multi-currency)**: 1–2 weeks.

### Decisions Needed
- Should we auto-create missing Customers/Items, or require pre-existence?
- Do we require unique `DocNumber` mapping to our invoice number?
- Minimal taxes for MVP vs full tax mapping?

### Testing Plan
- Connect to QBO Sandbox and create invoices from a variety of our invoices:
  - With existing customer and item.
  - Missing customer (auto-create or prompt).
  - Free-form description-only lines.
  - With and without taxes.
- Verify created invoices appear in QBO, are unsent, and amounts/lines match.
- Verify idempotency: repeated clicks do not create duplicates.

### Acceptance Criteria
- From any invoice in our app, clicking the button creates a corresponding invoice in QBO without sending it.
- The created invoice is visible in QBO, with correct customer, lines, amounts.
- Our invoice stores the QBO `Id` and shows a working "View in QuickBooks" link.
- Duplicate creation is prevented once linked.

### Out of Scope (MVP)
- Full tax engine mapping and regional tax compliance.
- Payments sync, email sending, or status sync back from QBO.
- Multi-currency conversions.


