// Normalize and compare disposition values across the app
export function normalizeDisposition(raw?: string | null): string {
  if (!raw) return 'keep'
  return raw
}

export function dispositionsEqual(a?: string | null, b?: string | null): boolean {
  return normalizeDisposition(a) === normalizeDisposition(b)
}

export function displayDispositionLabel(raw?: string | null): string {
  const d = normalizeDisposition(raw)
  if (d === 'to return') return 'To Return'
  return d.charAt(0).toUpperCase() + d.slice(1)
}


