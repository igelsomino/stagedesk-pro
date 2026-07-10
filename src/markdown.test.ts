import { describe, expect, it } from 'vitest'
import type { DirectorNote, MediaCue } from './domain'
import { cleanScriptMarkdown, hasMarkdownTable, markdownToHtml, parseScriptBlocks, serializeExtendedMarkdown } from './markdown'

const note = (patch: Partial<DirectorNote> = {}): DirectorNote => ({
  id: 'note-001',
  type: 'tone',
  color: 'purple',
  title: 'Tono del Barman',
  content: 'Pronunciare con tono amaro.',
  filePath: '/copione/atto-1.md',
  anchorId: 'anchor-note',
  sceneId: 'scena-1',
  createdAt: '2026-07-02T00:00:00.000Z',
  updatedAt: '2026-07-02T00:00:00.000Z',
  ...patch,
})

const cue = (patch: Partial<MediaCue> = {}): MediaCue => ({
  id: 'cue-001',
  type: 'audio',
  src: 'media/musiche/blues-intro.mp3',
  title: 'Blues intro',
  description: 'Ingresso musicale.',
  autoplay: true,
  anchorId: 'anchor-cue',
  filePath: '/copione/atto-1.md',
  sceneId: 'scena-1',
  options: { volume: 70, fadeIn: 2, fadeOut: 1, loop: false },
  createdAt: '2026-07-02T00:00:00.000Z',
  updatedAt: '2026-07-02T00:00:00.000Z',
  ...patch,
})

describe('markdown chip rendering', () => {
  it('renders note blocks with title, stable ref, note type color and editable content', () => {
    const html = markdownToHtml('::regia{id="note-001" type="tone" color="purple" title="Tono del Barman" collapsed="true"}\nTesto\n::')

    expect(html).toContain('data-note-block="true"')
    expect(html).toContain('data-note-title="Tono del Barman"')
    expect(html).toContain('data-ref-id="note-001"')
    expect(html).toContain('data-note-color="purple"')
    expect(html).toContain('data-note-type="tone"')
    expect(html).toContain('data-note-content="Testo"')
    expect(html).toContain('data-note-collapsed="true"')
  })

  it('renders cue chips with title, stable ref and cue type color', () => {
    const html = markdownToHtml('::media{id="cue-001" type="audio" src="media/musiche/blues-intro.mp3" title="Blues intro"}\nTesto\n::')

    expect(html).toContain('data-chip="cue"')
    expect(html).toContain('data-chip-label="Blues intro"')
    expect(html).toContain('data-ref-id="cue-001"')
    expect(html).toContain('data-chip-color="audio"')
    expect(html).toContain('>Blues intro</span>')
  })

  it('preserves rich markdown blocks when reopening editor content', () => {
    const html = markdownToHtml([
      '### Scena interna',
      'Testo con **grassetto** e *corsivo*.',
      '- Primo punto',
      '- Secondo punto',
      '1. Prima azione',
      '2. Seconda azione',
      '> Nota citata',
      '---',
    ].join('\n'))

    expect(html).toContain('<h3>Scena interna</h3>')
    expect(html).toContain('<strong>grassetto</strong>')
    expect(html).toContain('<em>corsivo</em>')
    expect(html).toContain('<ul><li><p>Primo punto</p></li><li><p>Secondo punto</p></li></ul>')
    expect(html).toContain('<ol><li><p>Prima azione</p></li><li><p>Seconda azione</p></li></ol>')
    expect(html).toContain('<blockquote><p>Nota citata</p></blockquote>')
    expect(html).toContain('<hr>')
  })

  it('renders markdown tables as editable tables', () => {
    const html = markdownToHtml([
      '### Personaggi',
      '| Personaggio | Attore | Presenza |',
      '| --- | --- | --- |',
      '| REGISTA | Mario Rossi | In scena |',
      '| ATTORE | Laura Bianchi | In scena |',
    ].join('\n'))

    expect(html).toContain('<table>')
    expect(html).toContain('<th><p>Personaggio</p></th>')
    expect(html).toContain('<td><p>REGISTA</p></td>')
  })

  it('renders github markdown tables without leading and trailing pipes', () => {
    const markdown = [
      'Personaggio | Attore | Presenza',
      '--- | --- | ---',
      'REGISTA | Mario Rossi | In scena',
      'ATTORE | Laura Bianchi | In scena',
    ].join('\n')
    const html = markdownToHtml(markdown)

    expect(hasMarkdownTable(markdown)).toBe(true)
    expect(html).toContain('<table>')
    expect(html).toContain('<th><p>Personaggio</p></th>')
    expect(html).toContain('<td><p>Laura Bianchi</p></td>')
  })

  it('renders markdown links as clickable anchors', () => {
    const html = markdownToHtml('Vai al [sito ufficiale](https://stagedesk-pro.aigconsulting.it).')

    expect(html).toContain('<a href="https://stagedesk-pro.aigconsulting.it"')
    expect(html).toContain('>sito ufficiale</a>')
  })

  it('does not promote uppercase character names to h3 headings', () => {
    const html = markdownToHtml('MIRANDOLINA')

    expect(html).toBe('<p>MIRANDOLINA</p>')
  })
})

describe('markdown serialization', () => {
  it('serializes notes and cues by stable id before falling back to order', () => {
    const editorMarkdown = [
      '# Copione',
      '[NOTA: note-002]',
      '[CUE cue-002]',
    ].join('\n')

    const serialized = serializeExtendedMarkdown(
      editorMarkdown,
      [
        note(),
        note({ id: 'note-002', title: 'Seconda nota', content: 'Nota corretta.', collapsed: true }),
      ],
      [
        cue(),
        cue({ id: 'cue-002', title: 'Secondo cue', description: 'Cue corretto.', src: 'media/suoni/door.wav' }),
      ],
    )

    expect(serialized).toContain('::regia{id="note-002"')
    expect(serialized).toContain('collapsed="true"')
    expect(serialized).toContain('Nota corretta.')
    expect(serialized).toContain('::media{id="cue-002"')
    expect(serialized).toContain('Cue corretto.')
  })

  it('serializes rich note and cue markers by ref id', () => {
    const editorMarkdown = [
      '[NOTA: Seconda nota] {#note-002 .purple type="tone" content="Nota corretta."}',
      '[CUE: Secondo cue] {#cue-002 .audio}',
    ].join('\n')

    const serialized = serializeExtendedMarkdown(
      editorMarkdown,
      [
        note(),
        note({ id: 'note-002', title: 'Seconda nota', content: 'Nota corretta.' }),
      ],
      [
        cue(),
        cue({ id: 'cue-002', title: 'Secondo cue', description: 'Cue corretto.', src: 'media/suoni/door.wav' }),
      ],
    )

    expect(serialized).toContain('::regia{id="note-002"')
    expect(serialized).toContain('::media{id="cue-002"')
  })

  it('removes visual note and cue markers from clean export', () => {
    const clean = cleanScriptMarkdown([
      'PERSONAGGIO',
      'Battuta.',
      '[NOTA: Tono del Barman] {#note-001 .purple}',
      '[CUE: Blues intro] {#cue-001 .audio}',
    ].join('\n'))

    expect(clean).toBe('PERSONAGGIO\nBattuta.')
  })

  it('parses the visual cue marker as a media block', () => {
    const blocks = parseScriptBlocks('[CUE: Blues intro] {#cue-001 .audio}')

    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.type).toBe('media')
  })

  it('parses h3 sections for fullscreen navigation', () => {
    const blocks = parseScriptBlocks('## Scena 1\n### Personaggi\nTesto')

    expect(blocks.map((block) => block.type)).toEqual(['scene', 'section', 'dialogue'])
    expect(blocks[1]).toMatchObject({ text: 'Personaggi', headingLevel: 3 })
  })

  it('parses markdown tables with rows and columns for fullscreen rendering', () => {
    const blocks = parseScriptBlocks([
      '### Personaggi',
      '| Personaggio | Attore | Presenza |',
      '| --- | --- | --- |',
      '| REGISTA | Mario Rossi | In scena |',
      '| ATTORE | Laura Bianchi | In scena |',
    ].join('\n'))

    expect(blocks.map((block) => block.type)).toEqual(['section', 'table'])
    expect(blocks[1]?.tableRows).toEqual([
      { cells: ['Personaggio', 'Attore', 'Presenza'], header: true },
      { cells: ['REGISTA', 'Mario Rossi', 'In scena'] },
      { cells: ['ATTORE', 'Laura Bianchi', 'In scena'] },
    ])
  })

  it('parses inline character dialogue from bold name syntax', () => {
    const blocks = parseScriptBlocks('**MIRANDOLINA**: A pranzo, che cosa comanda?')

    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      type: 'dialogue',
      characterId: 'mirandolina',
      text: '**MIRANDOLINA**: A pranzo, che cosa comanda?',
    })
  })

  it('parses blockquotes as quote blocks outside fullscreen dialogue flow', () => {
    const blocks = parseScriptBlocks('> Citazione non da proiettare\n**MIRANDOLINA**: Battuta')

    expect(blocks.map((block) => block.type)).toEqual(['quote', 'dialogue'])
    expect(blocks[0]).toMatchObject({ text: 'Citazione non da proiettare' })
  })
})
