import type { MediaCue, ScriptBlock } from './domain'

/**
 * Riga di supporto alla compilazione della setlist in mioBordero.
 * Il CSV non e' un tracciato ufficiale SIAE e non sostituisce l'invio
 * dal portale: conserva soltanto i brani musicali effettivamente richiamati.
 */
export type BorderoRow = {
  sequence: number
  act: string
  scene: string
  cueTitle: string
  source: string
  durationSeconds: string
  autoplay: string
  author: string
  composer: string
  publisher: string
  workCode: string
  notes: string
}

const cleanText = (value: string | undefined) => (value ?? '')
  .replace(/^\*\*(.*?)\*\*: ?\s*/, '')
  .replace(/^\[[^\]]+\]\s*/, '')
  .replace(/\s+/g, ' ')
  .trim()

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`

/**
 * Returns only music cues, in the order in which they occur in the script.
 * Dialogue, stage directions and non-musical media deliberately never reach
 * the export: they are not entries of a SIAE music programme.
 */
export const buildBorderoRows = (blocks: ScriptBlock[], cues: MediaCue[] = []): BorderoRow[] => {
  const cuesById = new Map(cues.map((cue) => [cue.id, cue]))
  let act = ''
  let scene = ''
  let sequence = 0
  const rows: BorderoRow[] = []

  for (const block of blocks) {
    if (block.type === 'title' && /^(atto|act)\b/i.test(block.text ?? '')) {
      act = cleanText(block.text)
      scene = ''
      continue
    }
    if (block.type === 'scene') {
      scene = cleanText(block.text)
      continue
    }
    if (block.type !== 'media' || !block.cueId) continue

    const cue = cuesById.get(block.cueId)
    if (!cue || cue.type !== 'music') continue

    sequence += 1
    rows.push({
      sequence,
      act,
      scene,
      cueTitle: cue.title?.trim() || cue.src,
      source: cue.src,
      durationSeconds: cue.options.duration == null ? '' : String(cue.options.duration),
      autoplay: cue.autoplay ? 'Si' : 'No',
      // These data cannot be inferred reliably from an audio filename.
      author: '',
      composer: '',
      publisher: '',
      workCode: '',
      notes: cue.description?.trim() ?? '',
    })
  }

  return rows
}

export const buildBorderoCsv = (rows: BorderoRow[]) => {
  const header = [
    'N.',
    'Titolo brano/opera',
    'Autore testo',
    'Compositore',
    'Editore',
    'Codice opera (facoltativo)',
    'Durata (s)',
    'Esecuzione automatica',
    'Atto',
    'Scena',
    'Sorgente StageDesk',
    'Note',
  ]
  const lines = [header, ...rows.map((row) => [
    row.sequence,
    row.cueTitle,
    row.author,
    row.composer,
    row.publisher,
    row.workCode,
    row.durationSeconds,
    row.autoplay,
    row.act,
    row.scene,
    row.source,
    row.notes,
  ])]
  return `\uFEFF${lines.map((line) => line.map(csvCell).join(';')).join('\r\n')}\r\n`
}
