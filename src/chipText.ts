export const sanitizeChipLabel = (value: unknown, fallback = '') => {
  const raw = String(value ?? '').trim()
  if (!raw) return fallback

  const decodedRaw = decodeBasicEntities(raw)
  const markerLabel = decodedRaw.match(/\[BOOKMARK:\s*([^\]]+)\]/i)?.[1]
  const candidate = markerLabel ?? decodedRaw
  const attrLabel = candidate.match(/\bdata-chip-label=(["'])(.*?)\1/i)?.[2]
    ?? candidate.match(/\bdata-chip-label=([^\s>]+)/i)?.[1]
  const selected = attrLabel ?? candidate

  const withoutTags = selected.replace(/<[^>]*>/g, ' ')
  const decoded = decodeBasicEntities(withoutTags)
  const normalized = decoded.replace(/\s+/g, ' ').trim()
  return normalized || fallback
}

const decodeBasicEntities = (value: string) =>
  value
    .replace(/&#10;/g, '\n')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
