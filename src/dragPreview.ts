export type DragPreviewTone = 'cue' | 'note' | 'media'

type DragPreviewDetails = {
  label: string
  detail?: string
  tone: DragPreviewTone
}

type DragPreviewWindow = Window & {
  __STAGEDESK_NATIVE_DRAG_ACTIVE__?: boolean
  __STAGEDESK_NATIVE_DRAG_IMAGE__?: HTMLElement
}

const kindLabel = (tone: DragPreviewTone) => {
  if (tone === 'note') return 'Nota'
  if (tone === 'media') return 'Media'
  return 'Cue'
}

/** Uses the same compact preview for native browser and pointer-based dragging. */
export const setNativeDragPreview = (dataTransfer: DataTransfer, details: DragPreviewDetails) => {
  if (typeof document === 'undefined') return

  const dragWindow = window as DragPreviewWindow
  dragWindow.__STAGEDESK_NATIVE_DRAG_IMAGE__?.remove()
  dragWindow.__STAGEDESK_NATIVE_DRAG_ACTIVE__ = true
  document.documentElement.classList.add('stagedesk-native-dragging')

  const preview = document.createElement('div')
  preview.className = 'pointer-drag-preview native-drag-image'
  preview.dataset.tone = details.tone

  const kind = document.createElement('span')
  kind.className = 'pointer-drag-preview-kind'
  kind.textContent = kindLabel(details.tone)
  preview.append(kind)

  const label = document.createElement('strong')
  label.textContent = details.label
  preview.append(label)

  if (details.detail) {
    const detail = document.createElement('span')
    detail.textContent = details.detail
    preview.append(detail)
  }

  document.body.append(preview)
  dragWindow.__STAGEDESK_NATIVE_DRAG_IMAGE__ = preview
  dataTransfer.setDragImage(preview, 14, 14)
}

export const clearNativeDragPreview = () => {
  if (typeof window === 'undefined') return
  const dragWindow = window as DragPreviewWindow
  dragWindow.__STAGEDESK_NATIVE_DRAG_IMAGE__?.remove()
  delete dragWindow.__STAGEDESK_NATIVE_DRAG_IMAGE__
  delete dragWindow.__STAGEDESK_NATIVE_DRAG_ACTIVE__
  document.documentElement.classList.remove('stagedesk-native-dragging')
}
