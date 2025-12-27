import { getDocument, GlobalWorkerOptions, type TextItem } from 'pdfjs-dist/legacy/build/pdf'
// Vite will bundle the worker and return a URL string.
// eslint-disable-next-line import/no-unresolved
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker?url'

export type PdfTextExtractionResult = {
  pages: string[]
  fullText: string
}

let pdfJsWorkerConfigured = false

function configurePdfJsWorkerOnce() {
  if (pdfJsWorkerConfigured) return
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  pdfJsWorkerConfigured = true
}

function isTextItem(item: unknown): item is TextItem {
  return item != null && typeof item === 'object' && 'str' in item
}

export async function extractPdfText(file: File): Promise<PdfTextExtractionResult> {
  configurePdfJsWorkerOnce()

  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = getDocument({ data: arrayBuffer })
  const pdf = await loadingTask.promise

  const pages: string[] = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item: unknown) => (isTextItem(item) ? item.str : ''))
      .filter(Boolean)
      .join('\n')
    pages.push(pageText)
  }

  const fullText = pages.join('\n\n')
  return { pages, fullText }
}


