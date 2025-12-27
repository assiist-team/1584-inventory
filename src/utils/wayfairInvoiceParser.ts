import { normalizeMoneyToTwoDecimalString, parseMoneyToNumber } from '@/utils/money'

export type WayfairInvoiceLineItem = {
  description: string
  qty: number
  unitPrice?: string
  subtotal?: string
  adjustment?: string
  tax?: string
  total: string
  shippedOn?: string
  section?: 'shipped' | 'to_be_shipped' | 'unknown'
}

export type WayfairInvoiceParseResult = {
  invoiceNumber?: string
  orderDate?: string // YYYY-MM-DD
  invoiceLastUpdated?: string
  orderTotal?: string
  subtotal?: string
  taxTotal?: string
  adjustmentsTotal?: string
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
  return (line.match(/\$?\s*[\d,]+\.\d{2}/g) || [])
    .map(t => normalizeMoneyToTwoDecimalString(t) || '')
    .filter(Boolean)
}

function parseLineItemFromLine(line: string, bufferedDescription: string): Omit<WayfairInvoiceLineItem, 'shippedOn' | 'section'> | undefined {
  const moneyTokens = extractMoneyTokens(line)
  if (moneyTokens.length === 0) return undefined

  // Common case: "... <qty> <unitPrice> <total>"
  const qtyWithTwoMoneyAtEnd = line.match(/^(.*)\b(\d{1,3})\b\s+\$?\s*[\d,]+\.\d{2}\s+\$?\s*[\d,]+\.\d{2}\s*$/)
  let qty: number | undefined
  if (qtyWithTwoMoneyAtEnd) {
    qty = Number(qtyWithTwoMoneyAtEnd[2])
  } else {
    const qtyMatch = line.match(/\bQty\b\s*[:#]?\s*(\d{1,3})\b/i)
    if (qtyMatch) qty = Number(qtyMatch[1])
  }

  if (!qty || qty <= 0) return undefined

  const total = moneyTokens[moneyTokens.length - 1]
  const unitPrice = moneyTokens.length >= 2 ? moneyTokens[moneyTokens.length - 2] : undefined
  const subtotal = moneyTokens.length >= 3 ? moneyTokens[moneyTokens.length - 3] : undefined

  const description = (bufferedDescription || '').trim() || line.replace(/\s+\$?\s*[\d,]+\.\d{2}.*$/, '').trim()
  if (!description) return undefined

  return {
    description,
    qty,
    unitPrice,
    subtotal,
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
  const taxTotalRaw = extractFirstMatch(fullText, /\bTax(?:\s*Total)?\s*[:#]?\s*\$?\s*([\d,]+\.\d{2})\b/i)
  const adjustmentsRaw = extractFirstMatch(fullText, /\bAdjustments?\s*[:#]?\s*\$?\s*([-]?[\d,]+\.\d{2})\b/i)

  const orderTotal = orderTotalRaw ? normalizeMoneyToTwoDecimalString(orderTotalRaw) : undefined
  const subtotal = subtotalRaw ? normalizeMoneyToTwoDecimalString(subtotalRaw) : undefined
  const taxTotal = taxTotalRaw ? normalizeMoneyToTwoDecimalString(taxTotalRaw) : undefined
  const adjustmentsTotal = adjustmentsRaw ? normalizeMoneyToTwoDecimalString(adjustmentsRaw) : undefined

  if (!invoiceNumber) warnings.push('Could not confidently find an invoice number.')
  if (!orderDate) warnings.push('Could not confidently find an order date; defaulting to today is recommended.')
  if (!orderTotal) warnings.push('Could not confidently find an order total; totals reconciliation will be limited.')

  const lines = normalizeLines(fullText)

  let currentSection: 'shipped' | 'to_be_shipped' | 'unknown' = 'unknown'
  let currentShippedOn: string | undefined
  let bufferedDescriptionParts: string[] = []

  const lineItems: WayfairInvoiceLineItem[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()

    const shippedOnMatch = line.match(/\bShipped\s+On\s+(.+)\b/i)
    if (shippedOnMatch) {
      currentSection = 'shipped'
      const shippedOnIso = parseDateToIso(shippedOnMatch[1])
      currentShippedOn = shippedOnIso
      bufferedDescriptionParts = []
      continue
    }

    if (/\bItems\s+to\s+be\s+Shipped\b/i.test(line) || /\bTo\s+be\s+Shipped\b/i.test(line)) {
      currentSection = 'to_be_shipped'
      currentShippedOn = undefined
      bufferedDescriptionParts = []
      continue
    }

    // Skip obvious header/summary lines to avoid false positives.
    if (
      /\b(Order Total|Subtotal|Tax Total|Tax|Adjustments?|Invoice|Order Date)\b/i.test(line) ||
      /\b(Ship(?:ping)?|Handling|Payment|Bill(?:ing)?|Address)\b/i.test(line)
    ) {
      bufferedDescriptionParts = []
      continue
    }

    // Accumulate possible multi-line descriptions, then parse when we see a numeric row.
    const maybeParsed = parseLineItemFromLine(line, bufferedDescriptionParts.join(' '))
    if (maybeParsed) {
      lineItems.push({
        ...maybeParsed,
        shippedOn: currentShippedOn,
        section: currentSection,
      })
      bufferedDescriptionParts = []
      continue
    }

    // Buffer text that looks like a description line (avoid buffering lines that are mostly numbers).
    if (!/^\$?\s*[\d,]+\.\d{2}\s*$/.test(line) && !/^\d+$/.test(line)) {
      bufferedDescriptionParts.push(line)
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
    taxTotal,
    adjustmentsTotal,
    lineItems,
    warnings,
  }
}


