import { describe, expect, it } from 'vitest'
import { decodeStageDeskPackage, encodeStageDeskPackage } from './storePackage'

const markdown = `# Copione di prova

| Personaggio | Interprete | Presenza |
| --- | --- | --- |
| NORA | D/A | 1/1 |

:::battuta{id="battuta-1" characterId="nora" character="NORA"}
Buongiorno.
:::
`

describe('StageDesk package codec', () => {
  it('decodes the versioned envelope produced for new publications', async () => {
    const packageText = encodeStageDeskPackage(markdown, 'Copione di prova')
    const decoded = await decodeStageDeskPackage(new TextEncoder().encode(packageText).buffer)

    expect(decoded.format).toBe('envelope')
    expect(decoded.version).toBe(1)
    expect(decoded.title).toBe('Copione di prova')
    expect(decoded.content).toContain(':::battuta')
  })

  it('keeps importing legacy raw Markdown packages', async () => {
    const decoded = await decodeStageDeskPackage(`\uFEFF${markdown.replaceAll('\n', '\r\n')}`)

    expect(decoded.format).toBe('legacy-markdown')
    expect(decoded.content).toBe(markdown.trim())
  })

  it('accepts a package containing a scripts array', async () => {
    const packageText = JSON.stringify({
      format: 'stagedesk',
      version: 1,
      scripts: [{ name: 'copione.md', content: markdown }],
    })

    const decoded = await decodeStageDeskPackage(packageText)
    expect(decoded.content).toContain('| NORA |')
  })

  it('accepts a short but structurally valid script', async () => {
    const decoded = await decodeStageDeskPackage('# Atto 1\n\n:::battuta{id="1"}\nCiao.\n:::')

    expect(decoded.format).toBe('legacy-markdown')
    expect(decoded.content).toContain('Ciao.')
  })

  it('rejects HTML responses and empty or unrelated content', async () => {
    await expect(decodeStageDeskPackage('<!doctype html><html><body>Not found</body></html>'))
      .rejects.toThrow('pagina HTML')
    await expect(decodeStageDeskPackage('Questo non è un pacchetto StageDesk'))
      .rejects.toThrow('copione StageDesk valido')
    await expect(decodeStageDeskPackage(JSON.stringify({ format: 'other', content: markdown })))
      .rejects.toThrow('copione valido')
  })
})
