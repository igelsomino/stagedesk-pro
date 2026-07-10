import { mergeAttributes, Node } from '@tiptap/core'

type CuePlaybackState = {
  id: string
  state: 'playing' | 'paused' | 'stopped'
}

type CuePlaybackWindow = Window & {
  __STAGEDESK_EDITOR_CUE_STATE__?: CuePlaybackState
}

export const ScriptChip = Node.create({
  name: 'scriptChip',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

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
        draggable: 'true',
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

      dom.contentEditable = 'false'
      dom.draggable = true
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

      playButton.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        window.dispatchEvent(new CustomEvent('script-cue-toggle', { detail: { id: currentNode.attrs.refId } }))
      })

      stopButton.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        window.dispatchEvent(new CustomEvent('script-cue-stop', { detail: { id: currentNode.attrs.refId } }))
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
