import type { MediaCue, ScriptBlock } from './domain'

export type BorderoRow = {
  sequence: number
  kind: 'Battuta' | 'Audio' | 'Musica' | 'Immagine' | 'Video'
  act: string
  scene: string
  character: string
  title: string
  source: string
  durationSeconds: string
  notes: string
}

const cleanText = (value: string | undefined) => (value ?? '')
  .replace(/^\*\*(.*?)\*\*:?\s*/, '')
  .replace(/^\[[^\]]+\]\s*/, '')
  .replace(/\s+/g, ' ')
  .trim()

const characterFromDialogue = (text: string | undefined) => {
  const match = (text ?? '').match(/^\*\*([^*]+)\*\*:/)
  return match?.[1]?.trim() ?? ''
}

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`

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

    if (block.type === 'dialogue') {
      sequence += 1
      rows.push({
        sequence,
        kind: 'Battuta',
        act,
        scene,
        character: characterFromDialogue(block.text) || block.characterId || '',
        title: cleanText(block.text),
        source: '',
        durationSeconds: '',
        notes: '',
      })
      continue
    }

    if (block.type === 'media' && block.cueId) {
      const cue = cuesById.get(block.cueId)
      if (!cue) continue
      sequence += 1
      const kind = cue.type === 'music' ? 'Musica' : cue.type === 'audio' ? 'Audio' : cue.type === 'image' ? 'Immagine' : 'Video'
      rows.push({
        sequence,
        kind,
        act,
        scene,
        character: '',
        title: cue.title?.trim() || cue.src,
        source: cue.src,
        durationSeconds: cue.options.duration == null ? '' : String(cue.options.duration),
        notes: cue.description?.trim() ?? '',
      })
    }
  }

  return rows
}

export const buildBorderoCsv = (rows: BorderoRow[]) => {
  const header = ['N.', 'Tipo', 'Atto', 'Scena', 'Personaggio', 'Titolo/Testo', 'Sorgente', 'Durata (s)', 'Note']
  const lines = [header, ...rows.map((row) => [
    row.sequence,
    row.kind,
    row.act,
    row.scene,
    row.character,
    row.title,
    row.source,
    row.durationSeconds,
    row.notes,
  ])]
  return `\uFEFF${lines.map((line) => line.map(csvCell).join(';')).join('\r\n')}\r\n`
}
