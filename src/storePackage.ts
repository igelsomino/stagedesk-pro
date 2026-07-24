export const STAGEDESK_PACKAGE_FORMAT = 'stagedesk'
export const STAGEDESK_PACKAGE_VERSION = 1

export type StageDeskPackageEnvelope = {
  format: typeof STAGEDESK_PACKAGE_FORMAT
  version: number
  kind: 'script'
  title?: string
  content: string
}

export type DecodedStageDeskPackage = {
  content: string
  title?: string
  format: 'legacy-markdown' | 'envelope'
  version: number
}

const normalizeMarkdown = (value: string) => value
  .replace(/^\uFEFF/, '')
  .replace(/\r\n?/g, '\n')
  .replace(/\u2028|\u2029/g, '\n')
  .trim()

const looksLikeHtml = (value: string) =>
  /^\s*(?:<!doctype\s+html|<html(?:\s|>)|<head(?:\s|>)|<body(?:\s|>))/i.test(value)

const hasStageDeskContent = (value: string) => {
  const hasHeading = /^\s*#{1,6}\s+\S/m.test(value)
  const hasCharacterTable = /(?:^|\n)\s*\|\s*Personaggio\s*\|/im.test(value)
  const hasDialogue = /(?:^|\n)\s*:{2,3}battuta\s*\{/im.test(value) || /(?:^|\n)\s*\[BATTUTA:/im.test(value)
  const hasDirectorNote = /(?:^|\n)\s*:{2,3}regia\s*\{/im.test(value) || /(?:^|\n)\s*\[NOTA:/im.test(value)
  // A short script is still a valid script. Structural markers are the
  // discriminator; an arbitrary minimum length would reject small studies.
  const hasSubstantiveText = value.replace(/\s+/g, ' ').trim().length > 0

  return (hasDialogue || hasDirectorNote || hasCharacterTable || hasHeading) && hasSubstantiveText
}

const stringValue = (value: unknown) => typeof value === 'string' ? value : undefined

const contentFromJson = (value: unknown): { content?: string; title?: string; version?: number } => {
  if (!value || typeof value !== 'object') return {}
  const object = value as Record<string, unknown>
  const format = stringValue(object.format)
  const kind = stringValue(object.kind)
  if (format && format !== STAGEDESK_PACKAGE_FORMAT) return {}
  if (kind && kind !== 'script') return {}
  const title = stringValue(object.title)
  const version = typeof object.version === 'number' ? object.version : undefined
  const directContent = stringValue(object.content) ?? stringValue(object.markdown) ?? stringValue(object.script)
  if (directContent) return { content: directContent, title, version }

  const files = Array.isArray(object.files) ? object.files : Array.isArray(object.scripts) ? object.scripts : []
  for (const file of files) {
    if (!file || typeof file !== 'object') continue
    const fileObject = file as Record<string, unknown>
    const fileContent = stringValue(fileObject.content) ?? stringValue(fileObject.markdown)
    if (fileContent) return { content: fileContent, title: title ?? stringValue(fileObject.name), version }
  }

  return {}
}

export const encodeStageDeskPackage = (content: string, title?: string) => {
  const normalizedContent = normalizeMarkdown(content)
  const envelope: StageDeskPackageEnvelope = {
    format: STAGEDESK_PACKAGE_FORMAT,
    version: STAGEDESK_PACKAGE_VERSION,
    kind: 'script',
    ...(title?.trim() ? { title: title.trim() } : {}),
    content: normalizedContent,
  }
  return JSON.stringify(envelope)
}

export const decodeStageDeskPackage = async (input: ArrayBuffer | string): Promise<DecodedStageDeskPackage> => {
  let text: string
  if (typeof input === 'string') {
    text = input
  } else {
    const bytes = new Uint8Array(input)
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
      if (typeof DecompressionStream === 'undefined') {
        throw new Error('Pacchetto compresso non supportato da questa versione del browser')
      }
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
      text = await new Response(stream).text()
    } else {
      text = new TextDecoder('utf-8').decode(bytes)
    }
  }

  const normalizedText = normalizeMarkdown(text)
  if (!normalizedText) throw new Error('Il pacchetto StageDesk è vuoto')
  if (looksLikeHtml(normalizedText)) {
    throw new Error('Il download del pacchetto ha restituito una pagina HTML invece del copione')
  }

  if (normalizedText.startsWith('{')) {
    try {
      const parsed = JSON.parse(normalizedText) as Record<string, unknown>
      const extracted = contentFromJson(parsed)
      const content = normalizeMarkdown(extracted.content ?? '')
      if (!content || !hasStageDeskContent(content)) {
        throw new Error('Il pacchetto StageDesk non contiene un copione valido')
      }
      return {
        content,
        title: extracted.title,
        format: 'envelope',
        version: extracted.version ?? STAGEDESK_PACKAGE_VERSION,
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Il pacchetto StageDesk')) throw error
      throw new Error('Il pacchetto StageDesk contiene dati non leggibili')
    }
  }

  if (!hasStageDeskContent(normalizedText)) {
    throw new Error('Il pacchetto non contiene un copione StageDesk valido')
  }
  return { content: normalizedText, format: 'legacy-markdown', version: 0 }
}
