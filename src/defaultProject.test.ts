import { describe, expect, it } from 'vitest'
import type { MediaAsset } from './domain'
import { defaultProject } from './defaultProject'

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
    expect(script).toContain('**MIRANDOLINA**: A pranzo, che cosa comanda?')
    expect(script).not.toContain('Nuovo progetto teatrale')
  })
})
