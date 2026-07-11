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

    expect(browserProjectStorage.load().name).toBe('La locandiera')
  })
})
