import { normalizeMoneyToTwoDecimalString, parseMoneyToNumber } from '@/utils/money'

export type WayfairInvoiceLineItem = {
  description: string
  sku?: string
  qty: number
  unitPrice?: string
  subtotal?: string
  shipping?: string
  adjustment?: string
  tax?: string
  total: string
  /**
   * Raw attribute lines captured from the invoice *below the SKU* (e.g. "Fabric: Linen", "Color: Taupe", "Size: King").
   * These are intended to be appended into item notes during import.
   */
  attributeLines?: string[]
  attributes?: {
    color?: string
    size?: string
  }
  shippedOn?: string
  section?: 'shipped' | 'to_be_shipped' | 'unknown'
}

export type WayfairInvoiceParseResult = {
  invoiceNumber?: string
  orderDate?: string // YYYY-MM-DD
  invoiceLastUpdated?: string
  orderTotal?: string
  subtotal?: string
  shippingDeliveryTotal?: string
  taxTotal?: string
  adjustmentsTotal?: string
  calculatedSubtotal?: string // subtotal + shipping + delivery - adjustments
  lineItems: WayfairInvoiceLineItem[]
  warnings: string[]
}

function toIsoDate(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function parseDateToIso(input: string): string | undefined {
  const s = input.trim()
  if (!s) return undefined

  // 1) MM/DD/YYYY
  const mdy = s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/)
  if (mdy) {
    const month = Number(mdy[1])
    const day = Number(mdy[2])
    const year = Number(mdy[3])
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month - 1, day))
      return toIsoDate(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    }
  }

  // 2) Month DD, YYYY (e.g., Dec 1, 2024)
  const monthName = s.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),\s*(\d{4})\b/i)
  if (monthName) {
    const monthKey = monthName[1].toLowerCase().slice(0, 3)
    const monthIndex: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    }
    const month = monthIndex[monthKey]
    const day = Number(monthName[2])
    const year = Number(monthName[3])
    if (month !== undefined && day >= 1 && day <= 31) {
      const d = new Date(year, month, day)
      return toIsoDate(d)
    }
  }

  // 3) Fallback to Date.parse
  const parsed = Date.parse(s)
  if (Number.isFinite(parsed)) {
    return toIsoDate(new Date(parsed))
  }

  return undefined
}

function extractFirstMatch(text: string, regex: RegExp): string | undefined {
  const m = text.match(regex)
  return m?.[1]?.trim() || undefined
}

function normalizeLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function extractMoneyTokens(line: string): string[] {
  // Capture tokens like "$12.34", "-$12.34", "(12.34)", "($12.34)"
  // Note: normalizeMoneyToTwoDecimalString will interpret parentheses as negative.
  return (line.match(/(?:\(\s*\$?\s*[\d,]+\.\d{2}\s*\)|-?\$?\s*[\d,]+\.\d{2})/g) || [])
    .map(t => normalizeMoneyToTwoDecimalString(t) || '')
    .filter(Boolean)
}

function absMoneyString(input: string | undefined): string | undefined {
  if (!input) return undefined
  const n = parseMoneyToNumber(input)
  if (n === undefined) return undefined
  return Math.abs(n).toFixed(2)
}

function extractQty(line: string): number | undefined {
  // 1) Explicit qty label
  const qtyMatch = line.match(/\bQty\b\s*[:#]?\s*(\d{1,3})\b/i)
  if (qtyMatch) {
    const q = Number(qtyMatch[1])
    if (Number.isFinite(q) && q > 0) return q
  }

  // 2) Table-ish pattern: "<unitPrice> <qty> <subtotal>" (qty between money columns)
  const betweenMoneyMatch = line.match(/\$?\s*[\d,]+\.\d{2}\s+(\d{1,3})\s+\$?\s*[\d,]+\.\d{2}/)
  if (betweenMoneyMatch) {
    const q = Number(betweenMoneyMatch[1])
    if (Number.isFinite(q) && q > 0) return q
  }

  // 3) Legacy/simple pattern: "... <qty> <unitPrice> <total>" (qty appears before trailing money)
  const qtyWithTwoMoneyAtEnd = line.match(/^(.*)\b(\d{1,3})\b\s+\$?\s*[\d,]+\.\d{2}\s+\$?\s*[\d,]+\.\d{2}\s*$/)
  if (qtyWithTwoMoneyAtEnd) {
    const q = Number(qtyWithTwoMoneyAtEnd[2])
    if (Number.isFinite(q) && q > 0) return q
  }

  return undefined
}

function isLikelyWayfairTableHeaderLine(line: string): boolean {
  const s = line.trim()
  if (!s) return false

  // Common invoice table headers. pdf text extraction sometimes yields these as fragmented lines.
  // We keep this conservative to avoid dropping valid item descriptions.
  if (/^(?:Item|Unit Price|Qty|Subtotal|Adjustment|Tax|Total)$/i.test(s)) return true
  if (/^Shipping\s*&\s*Delivery$/i.test(s)) return true
  if (/^Shipping\s*(?:and|&)\s*Delivery$/i.test(s)) return true
  if (/^Delivery$/i.test(s)) return true

  // Full header row in one line
  if (/\bUnit Price\b/i.test(s) && /\bQty\b/i.test(s) && /\bSubtotal\b/i.test(s) && /\bTotal\b/i.test(s)) return true
  if (/\bShipping\b/i.test(s) && /\bDelivery\b/i.test(s) && /\bAdjustment\b/i.test(s) && /\bTax\b/i.test(s)) return true

  return false
}

/**
 * pdf text extraction can occasionally merge a table header row with the first item row (especially at page breaks).
 * We do NOT want to drop the entire merged line as "header".
 *
 * This tries to strip leading header fragments and return the remaining payload (item description / other content).
 * It only strips when we see multiple header phrases within the first ~80 characters to avoid false positives.
 */
function stripLeadingMergedWayfairTableHeader(line: string): string | undefined {
  let s = line.replace(/\s+/g, ' ').trim()
  if (!s) return undefined

  const headerPhrases = [
    'Shipping & Delivery',
    'Shipping and Delivery',
    'Unit Price',
    'Subtotal',
    'Adjustment',
    'Delivery',
    'Item',
    'Qty',
    'Tax',
    'Total',
  ]

  const scanWindow = s.slice(0, 80).toLowerCase()
  const phraseHitCount = headerPhrases.reduce((count, phrase) => {
    return count + (scanWindow.includes(phrase.toLowerCase()) ? 1 : 0)
  }, 0)

  // Require a few distinct header phrases to be present; this keeps stripping conservative.
  if (phraseHitCount < 4) return undefined

  // 1) Simple: repeatedly strip header labels if they appear as a prefix token sequence.
  // This handles cases like: "Item Unit Price Qty ... Total <payload>"
  let changed = false
  for (let i = 0; i < 20; i++) {
    const before = s
    s = s
      .replace(/^Item\s+/i, '')
      .replace(/^Unit Price\s+/i, '')
      .replace(/^Qty\s+/i, '')
      .replace(/^Subtotal\s+/i, '')
      .replace(/^Shipping\s*(?:and|&)\s*Delivery\s+/i, '')
      .replace(/^Delivery\s+/i, '')
      .replace(/^Adjustment\s+/i, '')
      .replace(/^Tax\s+/i, '')
      .replace(/^Total\s+/i, '')
      .trim()

    if (s !== before) changed = true
    if (s === before) break
  }
  if (changed && s) return s

  // 2) Fallback: if the full header row appears early, cut to the content after the last header phrase match.
  // We only consider matches that occur near the start of the line.
  const lower = line.toLowerCase()
  let cutIdx = -1
  const candidates: Array<{ phrase: string; idx: number }> = []
  for (const phrase of headerPhrases) {
    const idx = lower.indexOf(phrase.toLowerCase())
    if (idx >= 0 && idx < 80) candidates.push({ phrase, idx })
  }
  if (candidates.length < 4) return undefined

  for (const c of candidates) {
    cutIdx = Math.max(cutIdx, c.idx + c.phrase.length)
  }

  if (cutIdx > 0 && cutIdx < line.length - 1) {
    const payload = line.slice(cutIdx).replace(/\s+/g, ' ').trim()
    if (payload) return payload
  }

  return undefined
}

function normalizeAttributeLine(key: string, value: string): string {
  const normalizedKey = key.replace(/\s+/g, ' ').trim()
  const normalizedValue = value.replace(/\s+/g, ' ').trim()
  return `${normalizedKey}: ${normalizedValue}`.trim()
}

function isLikelyWayfairSkuToken(token: string): boolean {
  const t = token.trim()
  if (!t) return false
  // Wayfair item codes are typically compact alphanumerics like "W004170933", "FOW21689".
  // Require both a letter and a digit to avoid picking up pure numbers like invoice IDs.
  return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9-]{6,20}$/.test(t)
}

function extractStandaloneSkuLine(line: string): string | undefined {
  const s = line.trim()
  if (!s) return undefined
  if (extractMoneyTokens(s).length > 0) return undefined

  const labeled = s.match(/^(?:SKU|Item\s*(?:#|No\.?|Number|ID))\s*[:#]?\s*([A-Za-z0-9-]{4,30})\s*$/i)
  if (labeled?.[1]) return labeled[1].trim()

  if (isLikelyWayfairSkuToken(s)) return s
  return undefined
}

function extractLeadingSkuFromMoneyRow(line: string): { lineWithoutSku: string; sku?: string } {
  const normalized = line.replace(/\s+/g, ' ').trim()
  if (!normalized) return { lineWithoutSku: line }

  const tokenCount = extractMoneyTokens(normalized).length
  if (tokenCount < 2) return { lineWithoutSku: line }

  const match = normalized.match(/^([A-Za-z0-9-]{6,20})\s+(.+)$/)
  if (!match) return { lineWithoutSku: line }

  const candidateSku = match[1].trim()
  if (!isLikelyWayfairSkuToken(candidateSku)) return { lineWithoutSku: line }

  const remainder = match[2].trim()
  if (!remainder) return { lineWithoutSku: line }

  if (extractMoneyTokens(remainder).length < 2) return { lineWithoutSku: line }

  return {
    lineWithoutSku: remainder,
    sku: candidateSku,
  }
}

function splitSkuPrefixFromDescription(description: string): { sku?: string; cleanedDescription: string } {
  const s = description.replace(/\s+/g, ' ').trim()
  if (!s) return { cleanedDescription: s }

  const m = s.match(/^([A-Za-z0-9-]{6,20})\s+(.+)$/)
  if (!m) return { cleanedDescription: s }

  const possibleSku = m[1].trim()
  if (!isLikelyWayfairSkuToken(possibleSku)) return { cleanedDescription: s }

  return {
    sku: possibleSku,
    cleanedDescription: m[2].trim(),
  }
}

function extractStandaloneAttributeLine(line: string): { key?: 'color' | 'size'; value: string; rawLine: string } | undefined {
  const s = line.trim()
  if (!s) return undefined

  // Only treat these as standalone attribute lines (no money columns).
  if (extractMoneyTokens(s).length > 0) return undefined

  // Most Wayfair attribute lines are "Key: Value" (Fabric, Color, Size, Material, Finish, etc.)
  // Keep this conservative to reduce false positives.
  const kvMatch = s.match(/^([A-Za-z][A-Za-z0-9 /&()-]{0,30})\s*:\s*(.+)$/)
  if (kvMatch) {
    const key = kvMatch[1].trim()
    const value = kvMatch[2].trim()
    if (!value) return undefined

    const rawLine = normalizeAttributeLine(key, value)
    const lowerKey = key.toLowerCase()
    if (lowerKey === 'color') return { key: 'color', value, rawLine }
    if (lowerKey === 'size') return { key: 'size', value, rawLine }
    return { value, rawLine }
  }

  return undefined
}

function extractInlineAttributesFromDescription(description: string): {
  cleanedDescription: string
  attributes?: { color?: string; size?: string }
  attributeLines?: string[]
} {
  let s = description.replace(/\s+/g, ' ').trim()
  const attributes: { color?: string; size?: string } = {}
  const attributeLines: string[] = []

  // Remove stray table header fragments that sometimes get prepended by PDF line reconstruction.
  // Keep conservative: only remove the single word "Delivery" when it is the leading token.
  s = s.replace(/^Delivery\s+/i, '')

  // Capture inline Fabric when merged into the same line. We keep this scoped to the explicit key label.
  const fabricInline = s.match(/\bFabric\s*:\s*([A-Za-z][A-Za-z0-9 /-]{0,60})\b/i)
  if (fabricInline) {
    const value = fabricInline[1].trim()
    if (value) attributeLines.push(normalizeAttributeLine('Fabric', value))
    s = s.replace(fabricInline[0], '').replace(/\s+/g, ' ').trim()
  }

  // Best-effort extraction of inline attributes (usually appear at the end, sometimes merged into the same line).
  // Keep conservative to avoid stripping dimension-style sizes like `Size: 45" H x 73" W`.
  const colorInline = s.match(/\bColor\s*:\s*([A-Za-z][A-Za-z0-9 /-]{0,40})\b/i)
  if (colorInline) {
    const value = colorInline[1].trim()
    if (value) attributes.color = value
    if (value) attributeLines.push(normalizeAttributeLine('Color', value))
    s = s.replace(colorInline[0], '').replace(/\s+/g, ' ').trim()
  }

  const sizeInline = s.match(/\bSize\s*:\s*([A-Za-z0-9][A-Za-z0-9 /-]{0,25})\b/i)
  if (sizeInline) {
    const value = sizeInline[1].trim()
    // Skip dimension-y sizes (quotes or ' x ' patterns) even if they slipped into the capture.
    if (value && !/["']/.test(value) && !/\b\d+\s*x\s*\d+/i.test(value)) {
      attributes.size = value
      attributeLines.push(normalizeAttributeLine('Size', value))
      s = s.replace(sizeInline[0], '').replace(/\s+/g, ' ').trim()
    }
  }

  return {
    cleanedDescription: s,
    attributes: (attributes.color || attributes.size) ? attributes : undefined,
    attributeLines: attributeLines.length > 0 ? attributeLines : undefined,
  }
}

function extractTrailingSkuFromDescriptionLine(line: string): { cleanedLine: string; sku?: string } {
  const s = line.replace(/\s+/g, ' ').trim()
  if (!s) return { cleanedLine: s }
  if (extractMoneyTokens(s).length > 0) return { cleanedLine: s }

  const parts = s.split(' ').filter(Boolean)
  if (parts.length < 2) return { cleanedLine: s }

  const last = parts[parts.length - 1]
  if (!isLikelyWayfairSkuToken(last)) return { cleanedLine: s }

  const cleanedLine = parts.slice(0, -1).join(' ').trim()
  return { cleanedLine, sku: last }
}

function parseLineItemFromLine(line: string, bufferedDescription: string): Omit<WayfairInvoiceLineItem, 'shippedOn' | 'section'> | undefined {
  const moneyTokens = extractMoneyTokens(line)
  if (moneyTokens.length < 2) return undefined

  const qty = extractQty(line)
  if (!qty || qty <= 0) return undefined

  // For Wayfair invoices, the first money token is typically unit price and the last is total.
  // We keep additional fields best-effort since templates vary.
  const unitPrice = moneyTokens[0]
  const total = moneyTokens[moneyTokens.length - 1]

  // Often: unitPrice, subtotal, shipping, adjustment, tax, total (or similar)
  const subtotal = moneyTokens.length >= 3 ? moneyTokens[1] : undefined

  // Only treat the second-to-last token as tax when there are enough columns to support it.
  // (For 2-3 tokens, the "second-to-last" is not reliably tax.)
  const tax = moneyTokens.length >= 4 ? moneyTokens[moneyTokens.length - 2] : undefined

  // Middle tokens (excluding unitPrice, subtotal, tax, total) may include shipping + adjustment.
  // Heuristic:
  // - If any middle token is negative (e.g. "($15.96)" -> "-15.96"), treat it as adjustment (stored as ABS value).
  // - Otherwise, if two tokens exist, treat as [shipping, adjustment].
  // - If one token exists and it isn't negative, treat it as shipping.
  let shipping: string | undefined
  let adjustment: string | undefined

  const middleBeforeTax = moneyTokens.length >= 6 ? moneyTokens.slice(2, -2) : (moneyTokens.length === 5 ? moneyTokens.slice(2, -2) : [])
  if (middleBeforeTax.length > 0) {
    const negIdx = middleBeforeTax.findIndex(t => t.startsWith('-'))
    if (negIdx >= 0) {
      adjustment = absMoneyString(middleBeforeTax[negIdx])
      const remaining = middleBeforeTax.filter((_, i) => i !== negIdx)
      shipping = remaining[0]
    } else if (middleBeforeTax.length >= 2) {
      shipping = middleBeforeTax[0]
      adjustment = absMoneyString(middleBeforeTax[1])
    } else {
      shipping = middleBeforeTax[0]
    }
  }

  const description = (bufferedDescription || '').trim() || line.replace(/\s+\$?\s*[\d,]+\.\d{2}.*$/, '').trim()
  if (!description) return undefined

  return {
    description,
    qty,
    unitPrice,
    subtotal,
    shipping,
    adjustment,
    tax,
    total
  }
}

export function parseWayfairInvoiceText(fullText: string): WayfairInvoiceParseResult {
  const warnings: string[] = []

  const invoiceNumber =
    extractFirstMatch(fullText, /\bInvoice\s*(?:Number|#)?\s*[:#]?\s*(\d{6,})\b/i) ||
    extractFirstMatch(fullText, /\bInvoice\s*[:#]?\s*(\d{6,})\b/i)

  const orderDateRaw =
    extractFirstMatch(fullText, /\bOrder\s*Date\s*[:#]?\s*([^\n\r]+)\b/i) ||
    extractFirstMatch(fullText, /\bOrder\s*Placed\s*[:#]?\s*([^\n\r]+)\b/i)
  const orderDate = orderDateRaw ? parseDateToIso(orderDateRaw) : undefined

  const orderTotalRaw = extractFirstMatch(fullText, /\bOrder\s*Total\s*[:#]?\s*\$?\s*([\d,]+\.\d{2})\b/i)
  const subtotalRaw = extractFirstMatch(fullText, /\bSubtotal\s*[:#]?\s*\$?\s*([\d,]+\.\d{2})\b/i)
  const shippingDeliveryRaw = extractFirstMatch(fullText, /\bShipping(?:\s*(?:&|and)\s*Delivery)?\s*[:#]?\s*\$?\s*([\d,]+\.\d{2})\b/i) ||
    extractFirstMatch(fullText, /\bDelivery\s*[:#]?\s*\$?\s*([\d,]+\.\d{2})\b/i)
  const taxTotalRaw = extractFirstMatch(fullText, /\bTax(?:\s*Total)?\s*[:#]?\s*\$?\s*([\d,]+\.\d{2})\b/i)
  const adjustmentsRaw = extractFirstMatch(fullText, /\bAdjustments?\s*[:#]?\s*\$?\s*([-]?[\d,]+\.\d{2})\b/i)

  const orderTotal = orderTotalRaw ? normalizeMoneyToTwoDecimalString(orderTotalRaw) : undefined
  const subtotal = subtotalRaw ? normalizeMoneyToTwoDecimalString(subtotalRaw) : undefined
  const shippingDeliveryTotal = shippingDeliveryRaw ? normalizeMoneyToTwoDecimalString(shippingDeliveryRaw) : undefined
  const taxTotal = taxTotalRaw ? normalizeMoneyToTwoDecimalString(taxTotalRaw) : undefined
  const adjustmentsTotal = adjustmentsRaw ? normalizeMoneyToTwoDecimalString(adjustmentsRaw) : undefined

  // Calculate: Order Total - Tax Total (business requirement for Calculated Subtotal)
  let calculatedSubtotal: string | undefined
  if (orderTotal && taxTotal) {
    const totalNum = parseMoneyToNumber(orderTotal) || 0
    const taxNum = parseMoneyToNumber(taxTotal) || 0
    const calculated = totalNum - taxNum
    calculatedSubtotal = calculated.toFixed(2)
  }

  if (!invoiceNumber) warnings.push('Could not confidently find an invoice number.')
  if (!orderDate) warnings.push('Could not confidently find an order date; defaulting to today is recommended.')
  if (!orderTotal) warnings.push('Could not confidently find an order total; totals reconciliation will be limited.')

  const lines = normalizeLines(fullText)

  let currentSection: 'shipped' | 'to_be_shipped' | 'unknown' = 'unknown'
  let currentShippedOn: string | undefined
  let bufferedDescriptionParts: string[] = []
  let pendingSku: string | undefined
  let pendingAttributes: { color?: string; size?: string } = {}
  let pendingAttributeLines: string[] = []

  const lineItems: WayfairInvoiceLineItem[] = []

  for (const rawLine of lines) {
    let line = rawLine.trim()

    const shippedOnMatch = line.match(/\bShipped\s+On\s+(.+)\b/i)
    if (shippedOnMatch) {
      currentSection = 'shipped'
      const shippedOnIso = parseDateToIso(shippedOnMatch[1])
      currentShippedOn = shippedOnIso
      bufferedDescriptionParts = []
      pendingSku = undefined
      pendingAttributes = {}
      pendingAttributeLines = []
      continue
    }

    if (/\bItems\s+to\s+be\s+Shipped\b/i.test(line) || /\bTo\s+be\s+Shipped\b/i.test(line)) {
      currentSection = 'to_be_shipped'
      currentShippedOn = undefined
      bufferedDescriptionParts = []
      pendingSku = undefined
      pendingAttributes = {}
      pendingAttributeLines = []
      continue
    }

    // Wayfair invoices often have: [Name line], [SKU line], [attribute lines], [money row].
    // Capture the SKU line and don't let it get merged into the description buffer.
    const standaloneSku = extractStandaloneSkuLine(line)
    if (standaloneSku) {
      if (bufferedDescriptionParts.length > 0) {
        pendingSku = standaloneSku
      } else {
        const previousLineItem = lineItems[lineItems.length - 1]
        if (previousLineItem && !previousLineItem.sku) {
          previousLineItem.sku = standaloneSku
        } else {
          pendingSku = standaloneSku
        }
      }
      continue
    }

    const standaloneAttr = extractStandaloneAttributeLine(line)
    if (standaloneAttr) {
      pendingAttributeLines.push(standaloneAttr.rawLine)
      if (standaloneAttr.key) pendingAttributes[standaloneAttr.key] = standaloneAttr.value
      continue
    }

    if (isLikelyWayfairTableHeaderLine(line)) {
      const payload = stripLeadingMergedWayfairTableHeader(line)
      bufferedDescriptionParts = []
      pendingSku = undefined
      pendingAttributes = {}
      pendingAttributeLines = []
      if (payload) {
        line = payload
        // fall through and process payload as a normal line
      } else {
        continue
      }
    }

    // Skip obvious header/summary lines to avoid false positives.
    if (
      /\b(Order Total|Subtotal|Tax Total|Tax|Adjustments?|Invoice|Order Date)\b/i.test(line) ||
      /\b(Ship(?:ping)?|Handling|Payment|Bill(?:ing)?|Address)\b/i.test(line)
    ) {
      bufferedDescriptionParts = []
      pendingSku = undefined
      pendingAttributes = {}
      pendingAttributeLines = []
      continue
    }

    if (!pendingSku) {
      const skuFromMoneyRow = extractLeadingSkuFromMoneyRow(line)
      if (skuFromMoneyRow.sku) {
        pendingSku = skuFromMoneyRow.sku
        line = skuFromMoneyRow.lineWithoutSku
      }
    }

    // Accumulate possible multi-line descriptions, then parse when we see a numeric row.
    const maybeParsed = parseLineItemFromLine(line, bufferedDescriptionParts.join(' '))
    if (maybeParsed) {
      const extracted = extractInlineAttributesFromDescription(maybeParsed.description)
      const skuSplit = pendingSku
        ? { sku: pendingSku, cleanedDescription: extracted.cleanedDescription }
        : splitSkuPrefixFromDescription(extracted.cleanedDescription)

      const mergedAttributes = {
        ...extracted.attributes,
        ...pendingAttributes,
      }
      const allAttributeLines = [
        ...(pendingAttributeLines || []),
        ...(extracted.attributeLines || []),
      ].map(l => l.trim()).filter(Boolean)
      const dedupedAttributeLines = allAttributeLines.length > 0
        ? Array.from(new Set(allAttributeLines))
        : undefined

      lineItems.push({
        ...maybeParsed,
        sku: skuSplit.sku,
        description: skuSplit.cleanedDescription,
        attributeLines: dedupedAttributeLines,
        attributes: (mergedAttributes.color || mergedAttributes.size) ? mergedAttributes : undefined,
        shippedOn: currentShippedOn,
        section: currentSection,
      })
      bufferedDescriptionParts = []
      pendingSku = undefined
      pendingAttributes = {}
      pendingAttributeLines = []
      continue
    }

    // Buffer text that looks like a description line (avoid buffering lines that are mostly numbers).
    if (!/^\$?\s*[\d,]+\.\d{2}\s*$/.test(line) && !/^\d+$/.test(line)) {
      // If PDF extraction merged a trailing SKU onto the end of the description line, split it off.
      if (!pendingSku) {
        const trailingSku = extractTrailingSkuFromDescriptionLine(line)
        if (trailingSku.sku) {
          pendingSku = trailingSku.sku
          line = trailingSku.cleanedLine
        }
      }

      // If PDF extraction merged SKU + name into one line, split and keep SKU separately.
      if (!pendingSku) {
        const split = splitSkuPrefixFromDescription(line)
        if (split.sku) {
          pendingSku = split.sku
          bufferedDescriptionParts.push(split.cleanedDescription)
          if (bufferedDescriptionParts.length > 3) bufferedDescriptionParts.shift()
          continue
        }
      }

      // If PDF extraction merged inline attribute key/value pairs into the description line, strip them and capture.
      const inline = extractInlineAttributesFromDescription(line)
      if (inline.attributeLines) pendingAttributeLines.push(...inline.attributeLines)
      if (inline.attributes?.color) pendingAttributes.color = inline.attributes.color
      if (inline.attributes?.size) pendingAttributes.size = inline.attributes.size

      bufferedDescriptionParts.push(inline.cleanedDescription)
      if (bufferedDescriptionParts.length > 3) bufferedDescriptionParts.shift()
    }
  }

  if (lineItems.length === 0) {
    warnings.push('No line items were detected. The PDF may be image-based or the template changed.')
  }

  const sumLineTotals = lineItems.reduce((sum, li) => sum + (parseMoneyToNumber(li.total) || 0), 0)
  if (orderTotal) {
    const orderTotalNum = parseMoneyToNumber(orderTotal) || 0
    const diff = Math.abs(sumLineTotals - orderTotalNum)
    if (diff > 0.05) {
      warnings.push(`Line totals ($${sumLineTotals.toFixed(2)}) do not match order total ($${orderTotalNum.toFixed(2)}). Difference: $${diff.toFixed(2)}.`)
    }
  }

  return {
    invoiceNumber,
    orderDate,
    orderTotal,
    subtotal,
    shippingDeliveryTotal,
    taxTotal,
    adjustmentsTotal,
    calculatedSubtotal,
    lineItems,
    warnings,
  }
}


