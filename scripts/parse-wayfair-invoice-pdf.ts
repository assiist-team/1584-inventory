import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

import { buildTextLinesFromPdfTextItems } from '@/utils/pdfTextExtraction'
import { parseWayfairInvoiceText } from '@/utils/wayfairInvoiceParser'
import { parseMoneyToNumber } from '@/utils/money'

async function main() {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const repoRoot = path.resolve(__dirname, '..')

  const pdfPath = path.resolve(repoRoot, 'dev_docs', 'Invoice_4386128736.pdf')
  const pdfBuffer = await fs.readFile(pdfPath)
  // pdfjs-dist (Node) requires a plain Uint8Array, not a Buffer.
  const pdfBytes = new Uint8Array(pdfBuffer.buffer, pdfBuffer.byteOffset, pdfBuffer.byteLength)

  const loadingTask = getDocument({
    data: pdfBytes,
    // In Node scripts we avoid configuring the worker; this keeps the script simple/reliable.
    disableWorker: true,
  } as any)

  const pdf = await loadingTask.promise
  const pages: string[] = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const pageText = buildTextLinesFromPdfTextItems(content.items as any)
    pages.push(pageText)
  }

  const fullText = pages.join('\n\n')
  const result = parseWayfairInvoiceText(fullText)

  const sumLineTotals = result.lineItems.reduce((sum, li) => sum + (parseMoneyToNumber(li.total) || 0), 0)
  const orderTotalNum = result.orderTotal ? (parseMoneyToNumber(result.orderTotal) || 0) : 0

  const shippedCount = result.lineItems.filter(li => li.section === 'shipped').length
  const toBeShippedCount = result.lineItems.filter(li => li.section === 'to_be_shipped').length
  const unknownCount = result.lineItems.filter(li => li.section === 'unknown').length

  const topItems = result.lineItems.slice(0, 10).map(li => ({
    shippedOn: li.shippedOn,
    section: li.section,
    qty: li.qty,
    unitPrice: li.unitPrice,
    total: li.total,
    description: li.description.length > 80 ? `${li.description.slice(0, 77)}...` : li.description,
  }))

  const summary = {
    invoiceNumber: result.invoiceNumber,
    orderDate: result.orderDate,
    orderTotal: result.orderTotal,
    lineItemsDetected: result.lineItems.length,
    sections: { shipped: shippedCount, to_be_shipped: toBeShippedCount, unknown: unknownCount },
    totals: {
      sumLineTotals: Number(sumLineTotals.toFixed(2)),
      orderTotal: Number(orderTotalNum.toFixed(2)),
      diff: Number(Math.abs(sumLineTotals - orderTotalNum).toFixed(2)),
    },
    warnings: result.warnings,
    sampleLineItems: topItems,
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summary, null, 2))
}

void main()


