import { describe, expect, it } from 'vitest'
import type { MediaCue } from './domain'
import { buildBorderoCsv, buildBorderoRows } from './bordero'
import { parseScriptBlocks } from './markdown'

const musicCue: MediaCue = {
  id: 'cue-musica',
  type: 'music',
  src: '/media/musiche/intro.mp3',
  title: 'Intro',
  description: 'Ingresso pubblico',
  autoplay: true,
  anchorId: 'anchor-1',
  filePath: '/copioni/testo.md',
  options: { duration: 42 },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const audioCue: MediaCue = { ...musicCue, id: 'cue-effetto', type: 'audio', title: 'Campanello' }

describe('bordero export', () => {
  it('exports only music cues in script order, preserving their stage context', () => {
    const blocks = parseScriptBlocks([
      '# Atto 1',
      '## Scena 1',
      '**MIRANDOLINA**: Benvenuti.',
      '[CUE: Campanello] {#cue-effetto .audio}',
      '[CUE: Intro] {#cue-musica .music}',
      '**CAVALIERE**: La musica accompagna la scena.',
    ].join('\n'))

    expect(buildBorderoRows(blocks, [musicCue, audioCue])).toEqual([
      expect.objectContaining({
        sequence: 1,
        cueTitle: 'Intro',
        act: 'Atto 1',
        scene: 'Scena 1',
        durationSeconds: '42',
        autoplay: 'Si',
      }),
    ])
  })

  it('uses a setlist-oriented CSV and escapes spreadsheet cells', () => {
    const csv = buildBorderoCsv([{
      sequence: 1,
      act: 'Atto 1',
      scene: 'Scena 1',
      cueTitle: 'Brano "A"; live',
      source: '/media/a.mp3',
      durationSeconds: '',
      autoplay: 'No',
      author: '',
      composer: '',
      publisher: '',
      workCode: '',
      notes: '',
    }])
    expect(csv).toContain('"Titolo brano/opera"')
    expect(csv).toContain('"Brano ""A""; live"')
    expect(csv).not.toContain('Battuta')
    expect(csv).toContain('\r\n')
  })
})
