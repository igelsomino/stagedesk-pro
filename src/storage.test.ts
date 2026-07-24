import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { blankProject, defaultProject } from './defaultProject'
import { browserProjectStorage } from './storage'

const createLocalStorage = () => {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}

describe('browser project storage recovery', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      localStorage: createLocalStorage(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('recovers unsaved sample edits after a reload', () => {
    const project = defaultProject()
    const editedScript = project.scripts[0]?.children?.[0]
    if (!editedScript) throw new Error('Missing sample script')
    editedScript.content = '# Bozza recuperata\n\n**MIRANDOLINA**: Testo modificato.'

    browserProjectStorage.save(project)

    const recoveredProject = browserProjectStorage.load()
    const recoveredScript = recoveredProject.scripts[0]?.children?.[0]?.content ?? ''
    expect(recoveredScript).toContain('Bozza recuperata')
    expect(recoveredScript).toContain('Testo modificato')
  })

  it('clears recovery data when a folder-backed project is saved', () => {
    const sampleProject = defaultProject()
    browserProjectStorage.save(sampleProject)

    const folderProject = { ...blankProject('Progetto reale'), rootPath: '/Users/test/Progetto reale' }
    browserProjectStorage.save(folderProject)

    expect(browserProjectStorage.load().name).toBe('Goldoni')
  })

  it('removes the legacy ID column from recovered character tables', () => {
    const project = defaultProject()
    const script = project.scripts[0]?.children?.[0]
    if (!script) throw new Error('Missing sample script')
    script.content = `# Atto 1

| ID | Personaggio | Interprete | Presenza | Note |
| --- | --- | --- | --- | --- |
| mirandolina | MIRANDOLINA | Da assegnare | In scena | Guida il ritmo della scena. |
| cavaliere | CAVALIERE | Da assegnare | In scena | Resiste, poi si lascia incuriosire. |

## Scena XV
`

    browserProjectStorage.save(project)

    const recoveredScript = browserProjectStorage.load().scripts[0]?.children?.[0]?.content ?? ''
    expect(recoveredScript).toContain('| Personaggio | Interprete | Presenza | Note |')
    expect(recoveredScript).toContain('| MIRANDOLINA | Da assegnare | In scena | Guida il ritmo della scena. |')
    expect(recoveredScript).toContain('| CAVALIERE | Da assegnare | In scena | Resiste, poi si lascia incuriosire. |')
    expect(recoveredScript).not.toContain('| ID | Personaggio | Interprete | Presenza | Note |')
    expect(recoveredScript).not.toContain('| mirandolina | MIRANDOLINA |')
  })

  it('refreshes an outdated sample with the current synopsis', () => {
    const project = defaultProject()
    const script = project.scripts[0]?.children?.[0]
    if (!script) throw new Error('Missing sample script')
    project.sampleVersion = 2
    script.content = script.content?.replace(/### Sinossi[\s\S]*?\n\n(?=::regia)/, '')

    browserProjectStorage.save(project)

    const refreshedScript = browserProjectStorage.load().scripts[0]?.children?.[0]?.content ?? ''
    expect(browserProjectStorage.load().sampleVersion).toBe(3)
    expect(refreshedScript).toContain('### Sinossi')
  })

  it('migrates legacy script paths to the copioni root', () => {
    const project = defaultProject()
    const root = project.scripts[0]
    if (!root || !root.children?.[0]) throw new Error('Missing sample script tree')
    project.name = 'La locandiera'
    root.name = 'copione'
    root.path = '/copione'
    root.children[0].name = 'atto-1.md'
    root.children[0].path = '/copione/atto-1.md'
    project.notes = project.notes.map((note) => ({ ...note, filePath: '/copione/atto-1.md' }))
    project.cues = project.cues.map((cue) => ({ ...cue, filePath: '/copione/atto-1.md' }))

    browserProjectStorage.save(project)

    const migratedProject = browserProjectStorage.load()
    expect(migratedProject.name).toBe('Goldoni')
    expect(migratedProject.scripts[0]?.name).toBe('copioni')
    expect(migratedProject.scripts[0]?.path).toBe('/copioni')
    expect(migratedProject.scripts[0]?.children?.[0]?.name).toBe('la locandiera.md')
    expect(migratedProject.scripts[0]?.children?.[0]?.path).toBe('/copioni/la locandiera.md')
    expect(migratedProject.notes.every((note) => note.filePath.startsWith('/copioni/'))).toBe(true)
    expect(migratedProject.cues.every((cue) => cue.filePath.startsWith('/copioni/'))).toBe(true)
  })
})
