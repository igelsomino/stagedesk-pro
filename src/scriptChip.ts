import { mergeAttributes, Node } from '@tiptap/core'

type CuePlaybackState = {
  id: string
  state: 'playing' | 'paused' | 'stopped'
}

type CuePlaybackWindow = Window & {
  __STAGEDESK_EDITOR_CUE_STATE__?: CuePlaybackState
  __STAGEDESK_DRAG_PAYLOAD__?: {
    type: string
    value: string
    startedAt: number
    startX?: number
    startY?: number
    pointerId?: number
    pointerActive?: boolean
    label?: string
    detail?: string
    tone?: 'cue' | 'note' | 'media'
  }
}

export const ScriptChip = Node.create({
  name: 'scriptChip',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      kind: {
        default: 'note',
        parseHTML: (element) => element.getAttribute('data-chip') ?? 'note',
      },
      label: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-chip-label') ?? element.textContent ?? '',
      },
      refId: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-ref-id') ?? '',
      },
      color: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-chip-color') ?? '',
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-chip]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-chip': node.attrs.kind,
        'data-chip-label': node.attrs.label,
        'data-ref-id': node.attrs.refId,
        'data-chip-color': node.attrs.color,
        contenteditable: 'false',
        draggable: 'false',
      }),
      node.attrs.label,
    ]
  },

  renderText({ node }) {
    return node.attrs.label
  },

  addNodeView() {
    return ({ node }) => {
      let currentNode = node
      const dom = document.createElement('span')
      const label = document.createElement('span')
      const playButton = document.createElement('button')
      const equalizer = document.createElement('span')
      const stopButton = document.createElement('button')
      let cueState: 'idle' | 'playing' | 'paused' = 'idle'
      let playHandledOnPointerDown = false
      let stopHandledOnPointerDown = false

      dom.contentEditable = 'false'
      dom.draggable = false
      label.className = 'script-chip-label'
      playButton.type = 'button'
      playButton.className = 'script-chip-play'
      playButton.title = 'Esegui cue'
      playButton.setAttribute('aria-label', 'Esegui cue')
      equalizer.className = 'script-chip-equalizer'
      equalizer.setAttribute('aria-hidden', 'true')
      stopButton.type = 'button'
      stopButton.className = 'script-chip-stop'
      stopButton.title = 'Ferma cue'
      stopButton.setAttribute('aria-label', 'Ferma cue')

      const syncCueState = () => {
        dom.dataset.cueState = cueState
        playButton.dataset.state = cueState
        playButton.title = cueState === 'playing' ? 'Pausa cue' : 'Esegui cue'
        playButton.setAttribute('aria-label', playButton.title)
      }

      const onCueState = (event: Event) => {
        const { id, state } = (event as CustomEvent<{ id?: string; state?: 'playing' | 'paused' | 'stopped' }>).detail ?? {}
        const currentId = String(currentNode.attrs.refId ?? '')
        if (!currentId) return
        cueState = id === currentId && state !== 'stopped' ? state ?? 'idle' : 'idle'
        syncCueState()
      }

      const render = () => {
        dom.dataset.chip = String(currentNode.attrs.kind)
        dom.dataset.chipLabel = String(currentNode.attrs.label ?? '')
        dom.dataset.refId = String(currentNode.attrs.refId ?? '')
        dom.dataset.chipColor = String(currentNode.attrs.color ?? '')
        label.textContent = String(currentNode.attrs.label ?? '')
        const isPlayableCue =
          currentNode.attrs.kind === 'cue' &&
          (currentNode.attrs.color === 'audio' || currentNode.attrs.color === 'music')
        const currentPlayback = (window as CuePlaybackWindow).__STAGEDESK_EDITOR_CUE_STATE__
        const currentId = String(currentNode.attrs.refId ?? '')
        cueState =
          currentPlayback?.id === currentId && currentPlayback.state !== 'stopped'
            ? currentPlayback.state
            : 'idle'
        dom.replaceChildren(...(isPlayableCue ? [playButton, stopButton, label, equalizer] : [label]))
        syncCueState()
      }

      const dispatchCueToggle = () => {
        window.dispatchEvent(new CustomEvent('script-cue-toggle', { detail: { id: currentNode.attrs.refId } }))
      }

      const dispatchCueStop = () => {
        window.dispatchEvent(new CustomEvent('script-cue-stop', { detail: { id: currentNode.attrs.refId } }))
      }

      playButton.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        playHandledOnPointerDown = true
        dispatchCueToggle()
      })

      playButton.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        if (playHandledOnPointerDown) {
          playHandledOnPointerDown = false
          return
        }
        dispatchCueToggle()
      })

      stopButton.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        stopHandledOnPointerDown = true
        dispatchCueStop()
      })

      stopButton.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        if (stopHandledOnPointerDown) {
          stopHandledOnPointerDown = false
          return
        }
        dispatchCueStop()
      })

      const writePointerDragPayload = (event: PointerEvent | MouseEvent) => {
        const target = event.target as HTMLElement | null
        if (target?.closest('button')) return

        const kind = String(currentNode.attrs.kind ?? '')
        const refId = String(currentNode.attrs.refId ?? '')
        if (!refId) return

        if (kind === 'cue') {
          ;(window as CuePlaybackWindow).__STAGEDESK_DRAG_PAYLOAD__ = {
            type: 'application/x-stagedesk-cue-id',
            value: refId,
            startedAt: Date.now(),
            startX: event.clientX,
            startY: event.clientY,
            pointerId: 'pointerId' in event ? event.pointerId : undefined,
            label: String(currentNode.attrs.label ?? 'Cue'),
            tone: 'cue',
          }
          return
        }

        if (kind === 'note') {
          ;(window as CuePlaybackWindow).__STAGEDESK_DRAG_PAYLOAD__ = {
            type: 'application/x-stagedesk-note-id',
            value: refId,
            startedAt: Date.now(),
            startX: event.clientX,
            startY: event.clientY,
            pointerId: 'pointerId' in event ? event.pointerId : undefined,
            label: String(currentNode.attrs.label ?? 'Nota'),
            tone: 'note',
          }
        }
      }

      dom.addEventListener('pointerdown', writePointerDragPayload)
      dom.addEventListener('mousedown', writePointerDragPayload)

      dom.addEventListener('dragstart', (event) => {
        const target = event.target as HTMLElement | null
        if (target?.closest('button')) {
          event.preventDefault()
          return
        }

        const kind = String(currentNode.attrs.kind ?? '')
        const refId = String(currentNode.attrs.refId ?? '')
        if (!refId || !event.dataTransfer) return

        if (kind === 'cue') {
          event.dataTransfer.setData('text/plain', `stagedesk-cue:${refId}`)
          event.dataTransfer.setData('application/x-stagedesk-cue-id', refId)
          ;(window as CuePlaybackWindow).__STAGEDESK_DRAG_PAYLOAD__ = {
            type: 'application/x-stagedesk-cue-id',
            value: refId,
            startedAt: Date.now(),
          }
          event.dataTransfer.effectAllowed = 'move'
          return
        }

        if (kind === 'note') {
          event.dataTransfer.setData('text/plain', `stagedesk-note:${refId}`)
          event.dataTransfer.setData('application/x-stagedesk-note-id', refId)
          ;(window as CuePlaybackWindow).__STAGEDESK_DRAG_PAYLOAD__ = {
            type: 'application/x-stagedesk-note-id',
            value: refId,
            startedAt: Date.now(),
          }
          event.dataTransfer.effectAllowed = 'move'
        }
      })

      dom.addEventListener('dragend', () => {
        delete (window as CuePlaybackWindow).__STAGEDESK_DRAG_PAYLOAD__
      })

      window.addEventListener('script-cue-state', onCueState)
      render()

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== 'scriptChip') return false
          currentNode = updatedNode
          render()
          return true
        },
        stopEvent(event) {
          const target = event.target as HTMLElement | null
          return Boolean(target?.closest('button'))
        },
        destroy() {
          window.removeEventListener('script-cue-state', onCueState)
        },
      }
    }
  },
})
