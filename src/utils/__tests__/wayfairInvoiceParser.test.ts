import { describe, expect, it } from 'vitest'
import { parseWayfairInvoiceText } from '@/utils/wayfairInvoiceParser'

const fixtureText = `
Wayfair
Invoice # 4386128736
Order Date: 12/01/2024

Order Summary
Subtotal $11,642.98
Tax Total $937.50
Order Total $12,580.48

Shipped On Dec 10, 2024
Accent Chair - Blue Velvet
1 $399.99 $399.99

Shipped On Dec 11, 2024
Dining Table - Oak Finish
1 $1,999.00 $1,999.00

Items to be Shipped
Floor Lamp - Brass
2 $149.75 $299.50
`

describe('parseWayfairInvoiceText', () => {
  it('extracts header fields and line items', () => {
    const result = parseWayfairInvoiceText(fixtureText)

    expect(result.invoiceNumber).toBe('4386128736')
    expect(result.orderDate).toBe('2024-12-01')
    expect(result.orderTotal).toBe('12580.48')
    expect(result.subtotal).toBe('11642.98')
    expect(result.taxTotal).toBe('937.50')

    expect(result.lineItems.length).toBe(3)
    expect(result.lineItems.filter(i => i.section === 'shipped').length).toBe(2)
    expect(result.lineItems.filter(i => i.section === 'to_be_shipped').length).toBe(1)

    const lamp = result.lineItems.find(i => i.description.includes('Floor Lamp'))
    expect(lamp?.qty).toBe(2)
    expect(lamp?.total).toBe('299.50')
  })
})


