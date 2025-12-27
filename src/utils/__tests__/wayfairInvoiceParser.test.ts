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

  it('detects table-style rows where qty sits between money columns', () => {
    const tableFixture = `
Wayfair
Invoice # 4386128736
Order Date: Dec 22, 2025
Order Total $12,580.48

Shipped On Dec 26, 2025
Vintage Botanical Wall Art with Heron & Floral Landscape - Classic Chinoiserie Style Hanging Décor ATGT1623 Size: 45" H x 73" W $227.99 1 $227.99 $0.00 ($15.96) $14.31 $226.34
`
    const result = parseWayfairInvoiceText(tableFixture)
    expect(result.lineItems.length).toBe(1)
    expect(result.lineItems[0].qty).toBe(1)
    expect(result.lineItems[0].unitPrice).toBe('227.99')
    expect(result.lineItems[0].total).toBe('226.34')
    expect(result.lineItems[0].shipping).toBe('0.00')
    // Adjustments are normalized to positive values because purchase price is computed as: unitPrice - adjustment + shipping
    expect(result.lineItems[0].adjustment).toBe('15.96')
    expect(result.lineItems[0].tax).toBe('14.31')
    expect(result.lineItems[0].section).toBe('shipped')
    expect(result.lineItems[0].shippedOn).toBe('2025-12-26')
  })

  it('does not prepend table header fragments like "Delivery" into the item description', () => {
    const fixture = `
Wayfair
Invoice # 9999999999
Order Date: 12/27/2025
Order Total $660.62

Shipped On Dec 27, 2025
Delivery
Kinston 114" Table Base
W004170933
$680.05 1 $680.05 $0.00 ($61.20) $41.77 $660.62
`
    const result = parseWayfairInvoiceText(fixture)
    expect(result.lineItems.length).toBe(1)
    expect(result.lineItems[0].sku).toBe('W004170933')
    expect(result.lineItems[0].description.startsWith('Kinston')).toBe(true)
    expect(result.lineItems[0].description.toLowerCase().includes('delivery')).toBe(false)
    expect(result.lineItems[0].description).not.toContain('W004170933')
  })

  it('captures standalone Color/Size lines as attributes instead of merging them into the description', () => {
    const fixture = `
Wayfair
Invoice # 8888888888
Order Date: 12/27/2025
Order Total $707.80

Items to be Shipped
Keynote Upholstered Fabric Curved Platform Bed
FOW21689
Fabric: Linen Blend
Color: Taupe
Size: King
$586.99 1 $586.99 $99.99 ($17.61) $38.43 $707.80
`
    const result = parseWayfairInvoiceText(fixture)
    expect(result.lineItems.length).toBe(1)
    expect(result.lineItems[0].sku).toBe('FOW21689')
    expect(result.lineItems[0].description).toContain('Keynote Upholstered Fabric Curved Platform Bed')
    expect(result.lineItems[0].description.toLowerCase()).not.toContain('color:')
    expect(result.lineItems[0].description.toLowerCase()).not.toContain('size:')
    expect(result.lineItems[0].description.toLowerCase()).not.toContain('fabric:')
    expect(result.lineItems[0].description).not.toContain('FOW21689')
    expect(result.lineItems[0].attributes?.color).toBe('Taupe')
    expect(result.lineItems[0].attributes?.size).toBe('King')
    expect(result.lineItems[0].attributeLines).toEqual(['Fabric: Linen Blend', 'Color: Taupe', 'Size: King'])
  })

  it('attaches standalone attribute lines that appear after the money row to the preceding item', () => {
    const fixture = `
Wayfair
Invoice # 4444444444
Order Date: 12/27/2025
Order Total $1,630.11

Shipped On Dec 24, 2025
Shipping &
Item Unit Price Qty Subtotal Adjustment Tax Total
Delivery
Keynote Upholstered Fabric Curved Platform Bed
FOW21689 $586.99 1 $586.99 $99.99 ($17.61) $38.43 $707.80
Color: Taupe
Size: King
Tilly Upholstered Bed
W004323827
$899.99 1 $899.99 $0.00 ($36.00) $58.32 $922.31
Color: Zuma Laurel Textured Linen
Size: King
`
    const result = parseWayfairInvoiceText(fixture)
    expect(result.lineItems.length).toBe(2)

    const firstItem = result.lineItems[0]
    expect(firstItem.description).toContain('Keynote Upholstered Fabric Curved Platform Bed')
    expect(firstItem.attributes?.color).toBe('Taupe')
    expect(firstItem.attributes?.size).toBe('King')
    expect(firstItem.attributeLines).toEqual(['Color: Taupe', 'Size: King'])

    const secondItem = result.lineItems[1]
    expect(secondItem.description).toContain('Tilly Upholstered Bed')
    expect(secondItem.attributes?.color).toBe('Zuma Laurel Textured Linen')
    expect(secondItem.attributes?.size).toBe('King')
    expect(secondItem.attributeLines).toEqual(['Color: Zuma Laurel Textured Linen', 'Size: King'])
  })

  it('does not drop an item when a table header row is merged into the same extracted line', () => {
    const fixture = `
Wayfair
Invoice # 8888888888
Order Date: 12/27/2025
Order Total $707.80

Items to be Shipped
Item Unit Price Qty Subtotal Shipping & Delivery Adjustment Tax Total Keynote Upholstered Fabric Curved Platform Bed
FOW21689
Fabric: Linen Blend
Color: Taupe
Size: King
$586.99 1 $586.99 $99.99 ($17.61) $38.43 $707.80
`
    const result = parseWayfairInvoiceText(fixture)
    expect(result.lineItems.length).toBe(1)
    expect(result.lineItems[0].sku).toBe('FOW21689')
    expect(result.lineItems[0].description).toContain('Keynote Upholstered Fabric Curved Platform Bed')
    expect(result.lineItems[0].attributeLines).toEqual(['Fabric: Linen Blend', 'Color: Taupe', 'Size: King'])
  })

  it('extracts a trailing SKU token when PDF text reconstruction merges it onto the end of the description line', () => {
    const fixture = `
Wayfair
Invoice # 9999999999
Order Date: 12/27/2025
Order Total $660.62

Shipped On Dec 27, 2025
Kinston 114" Table Base W004170933
$680.05 1 $680.05 $0.00 ($61.20) $41.77 $660.62
`
    const result = parseWayfairInvoiceText(fixture)
    expect(result.lineItems.length).toBe(1)
    expect(result.lineItems[0].sku).toBe('W004170933')
    expect(result.lineItems[0].description).toBe('Kinston 114" Table Base')
  })

  it('captures inline Fabric/Color/Size attributes when PDF text reconstruction merges them into the same line', () => {
    const fixture = `
Wayfair
Invoice # 7777777777
Order Date: 12/27/2025
Order Total $707.80

Items to be Shipped
Keynote Upholstered Fabric Curved Platform Bed FOW21689 Fabric: Linen Blend Color: Taupe Size: King
$586.99 1 $586.99 $99.99 ($17.61) $38.43 $707.80
`
    const result = parseWayfairInvoiceText(fixture)
    expect(result.lineItems.length).toBe(1)
    expect(result.lineItems[0].sku).toBe('FOW21689')
    expect(result.lineItems[0].description).toContain('Keynote Upholstered Fabric Curved Platform Bed')
    expect(result.lineItems[0].attributes?.color).toBe('Taupe')
    expect(result.lineItems[0].attributes?.size).toBe('King')
    expect(result.lineItems[0].attributeLines).toEqual(['Fabric: Linen Blend', 'Color: Taupe', 'Size: King'])
  })

  it('captures a SKU token that starts a money row even when a table header appears directly above the item', () => {
    const fixture = `
Wayfair
Invoice # 1234567890
Order Date: 12/27/2025
Order Total $707.80

Shipped On Dec 24, 2025
Shipping &
Item Unit Price Qty Subtotal Adjustment Tax Total
Delivery
Keynote Upholstered Fabric Curved Platform Bed
FOW21689 $586.99 1 $586.99 $99.99 ($17.61) $38.43 $707.80
`
    const result = parseWayfairInvoiceText(fixture)
    expect(result.lineItems.length).toBe(1)
    expect(result.lineItems[0].sku).toBe('FOW21689')
    expect(result.lineItems[0].description).toContain('Keynote Upholstered Fabric Curved Platform Bed')
    expect(result.lineItems[0].shippedOn).toBe('2025-12-24')
  })

  it('attaches standalone SKU lines that appear after a money row to the preceding line item', () => {
    const fixture = `
Wayfair
Invoice # 5555555555
Order Date: 12/27/2025
Order Total $1,942.85

Shipped On Dec 23, 2025
Kinston 114" Table Base
$680.05 1 $680.05 $0.00 ($61.20) $41.77 $660.62
W004170933
Kinston Table Top
$1,319.95 1 $1,319.95 $0.00 ($118.80) $81.08 $1,282.23
W004171720
`
    const result = parseWayfairInvoiceText(fixture)
    expect(result.lineItems.length).toBe(2)
    expect(result.lineItems[0].sku).toBe('W004170933')
    expect(result.lineItems[1].sku).toBe('W004171720')
    expect(result.lineItems[0].description).toBe('Kinston 114" Table Base')
    expect(result.lineItems[1].description).toBe('Kinston Table Top')
  })

  it('extracts shipping/delivery totals and calculates calculatedSubtotal correctly', () => {
    const fixture = `
Wayfair
Invoice # 1234567890
Order Date: 12/01/2024

Order Summary
Subtotal $10,000.00
Shipping & Delivery $500.00
Adjustments ($200.00)
Tax Total $1,030.00
Order Total $11,330.00
`
    const result = parseWayfairInvoiceText(fixture)
    expect(result.subtotal).toBe('10000.00')
    expect(result.shippingDeliveryTotal).toBe('500.00')
    // Adjustments ($200.00) normalizes to "-200.00"
    expect(result.adjustmentsTotal).toBe('-200.00')
    expect(result.taxTotal).toBe('1030.00')
    // calculatedSubtotal = order total - tax total = 11330 - 1030 = 10300
    expect(result.calculatedSubtotal).toBe('10300.00')
  })

  it('handles delivery total when shipping & delivery is not found together', () => {
    const fixture = `
Wayfair
Invoice # 1234567890
Order Date: 12/01/2024

Order Summary
Subtotal $5,000.00
Delivery $250.00
Tax Total $525.00
Order Total $5,775.00
`
    const result = parseWayfairInvoiceText(fixture)
    expect(result.subtotal).toBe('5000.00')
    expect(result.shippingDeliveryTotal).toBe('250.00')
    expect(result.taxTotal).toBe('525.00')
    // calculatedSubtotal = order total - tax total = 5775 - 525 = 5250
    expect(result.calculatedSubtotal).toBe('5250.00')
  })

  it('leaves calculatedSubtotal undefined when tax total is missing', () => {
    const fixture = `
Wayfair
Invoice # 1111111111
Order Date: 12/01/2024
Order Total $5,000.00
`
    const result = parseWayfairInvoiceText(fixture)
    expect(result.orderTotal).toBe('5000.00')
    expect(result.taxTotal).toBeUndefined()
    expect(result.calculatedSubtotal).toBeUndefined()
  })
})


