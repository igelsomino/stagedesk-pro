import { describe, expect, it } from 'vitest'
import type { MediaAsset } from './domain'
import { blankProject, defaultProject } from './defaultProject'

const flattenMedia = (assets: MediaAsset[]): MediaAsset[] =>
  assets.flatMap((asset) => [asset, ...flattenMedia(asset.children ?? [])])

describe('default project', () => {
  it('starts from La locandiera with real sample media assets', () => {
    const project = defaultProject()
    const mediaAssets = flattenMedia(project.media)
    const mediaPaths = mediaAssets.map((asset) => asset.path)
    const mediaSourcePaths = mediaAssets.map((asset) => asset.sourcePath).filter(Boolean)
    const script = project.scripts[0]?.children?.[0]?.content ?? ''

    expect(project.name).toBe('La locandiera')
    expect(mediaPaths).toEqual(expect.arrayContaining([
      '/media/suoni/doorbell-ding-dong.mp3',
      '/media/suoni/gunshot.mp3',
      '/media/musiche/blues-jazz.mp3',
      '/media/immagini/image.jpg',
    ]))
    expect(mediaPaths).not.toContain('/media/suoni/porta-apertura.wav')
    expect(mediaPaths).not.toContain('/media/video/cambio-luce-locanda.mp4')
    expect(mediaSourcePaths).toEqual(expect.arrayContaining([
      '/sample-media/suoni/doorbell-ding-dong.mp3',
      '/sample-media/suoni/gunshot.mp3',
      '/sample-media/musiche/blues-jazz.mp3',
      '/sample-media/immagini/image.jpg',
    ]))
    expect(script).toContain('AVVISO IMPORTANTE')
    expect(script).toContain('questo è un file di esempio e non è registrato sul dispositivo')
    expect(script).toContain('**MIRANDOLINA**: A pranzo, che cosa comanda?')
    expect(script).not.toContain('Nuovo progetto teatrale')
  })

  it('creates new projects from a minimal working script', () => {
    const project = blankProject('Prova regia')
    const mediaAssets = flattenMedia(project.media)
    const script = project.scripts[0]?.children?.[0]?.content ?? ''

    expect(project.name).toBe('Prova regia')
    expect(project.notes).toEqual([])
    expect(project.cues).toEqual([])
    expect(project.characters).toEqual([{ id: 'personaggio-1', name: 'PERSONAGGIO 1' }])
    expect(mediaAssets.map((asset) => asset.path)).toEqual([
      '/media/suoni',
      '/media/musiche',
      '/media/immagini',
      '/media/video',
    ])
    expect(mediaAssets.some((asset) => asset.sourcePath)).toBe(false)
    expect(script).toContain('# Prova regia')
    expect(script).toContain('## Atto 1')
    expect(script).toContain('### Scena 1')
    expect(script).toContain('**PERSONAGGIO 1**: Battuta 1')
    expect(script).not.toContain('MIRANDOLINA')
    expect(script).not.toContain('::media')
    expect(script).not.toContain('::regia')
  })
})
