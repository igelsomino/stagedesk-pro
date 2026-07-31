import { describe, expect, it } from 'vitest'
import type { MediaCue } from './domain'
import { buildBorderoCsv, buildBorderoRows } from './bordero'
import { parseScriptBlocks } from './markdown'

const cue: MediaCue = {
  id: 'cue-musica',
  type: 'music',
  src: '/media/musiche/intro.mp3',
  title: 'Intro',
  description: 'Ingresso pubblico',
  autoplay: false,
  anchorId: 'anchor-1',
  filePath: '/copioni/testo.md',
  options: { duration: 42 },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('bordero export', () => {
  it('keeps act, scene, dialogue and cue order', () => {
    const blocks = parseScriptBlocks([
      '# Atto 1',
      '## Scena 1',
      '**MIRANDOLINA**: Benvenuti.',
      '[CUE: Intro] {#cue-musica .music}',
      '**CAVALIERE**: La musica accompagna la scena.',
    ].join('\n'))

    expect(buildBorderoRows(blocks, [cue])).toMatchObject([
      { sequence: 1, kind: 'Battuta', act: 'Atto 1', scene: 'Scena 1', character: 'MIRANDOLINA' },
      { sequence: 2, kind: 'Musica', act: 'Atto 1', scene: 'Scena 1', title: 'Intro', durationSeconds: '42' },
      { sequence: 3, kind: 'Battuta', character: 'CAVALIERE' },
    ])
  })

  it('escapes semicolons and quotes for spreadsheet import', () => {
    const csv = buildBorderoCsv([{ sequence: 1, kind: 'Battuta', act: 'Atto 1', scene: 'Scena 1', character: 'A', title: 'Dice "ciao"; poi esce', source: '', durationSeconds: '', notes: '' }])
    expect(csv).toContain('"Dice ""ciao""; poi esce"')
    expect(csv).toContain('\r\n')
  })
})
