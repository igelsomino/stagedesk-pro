import { mergeAttributes, Node as TiptapNode } from '@tiptap/core'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'

type ScriptDialogueAttrs = {
  id: string
  characterId: string
  character: string
  text: string
  sceneId: string
}

type CharacterOption = {
  id: string
  name: string
}

type ScriptDialogueWindow = Window & {
  __STAGEDESK_CHARACTER_OPTIONS__?: CharacterOption[]
  __STAGEDESK_DIALOGUE_OPTIONS__?: CharacterOption[]
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

const DIALOGUE_ID_DND_TYPE = 'application/x-stagedesk-dialogue-id'
const DIALOGUE_ID_DND_PREFIX = 'stagedesk-dialogue:'

const characterOptions = (currentId: string, currentName: string) => {
  const options = [...(
    (window as ScriptDialogueWindow).__STAGEDESK_DIALOGUE_OPTIONS__ ??
    (window as ScriptDialogueWindow).__STAGEDESK_CHARACTER_OPTIONS__ ??
    []
  )]
  if (currentId && currentName && !options.some((item) => item.id === currentId)) {
    options.unshift({ id: currentId, name: currentName })
  }
  return options
}

export const ScriptDialogue = TiptapNode.create({
  name: 'scriptDialogue',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      id: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-dialogue-id') ?? '',
      },
      characterId: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-character-id') ?? '',
      },
      character: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-character-name') ?? '',
      },
      text: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-dialogue-text') ?? '',
      },
      sceneId: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-scene-id') ?? '',
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-dialogue-block]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    const attrs = node.attrs as ScriptDialogueAttrs
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-dialogue-block': 'true',
        'data-dialogue-id': attrs.id,
        'data-character-id': attrs.characterId,
        'data-character-name': attrs.character,
        'data-dialogue-text': attrs.text,
        'data-scene-id': attrs.sceneId,
        draggable: 'false',
      }),
      `${attrs.character}: ${attrs.text}`,
    ]
  },

  renderText({ node }) {
    return `**${node.attrs.character}**: ${node.attrs.text}`
  },

  addNodeView() {
    return ({ editor, getPos, node }) => {
      let currentNode = node
      const dom = document.createElement('section')
      const header = document.createElement('div')
      const characterDropdown = document.createElement('div')
      const characterButton = document.createElement('button')
      const characterLabel = document.createElement('span')
      const characterIcon = document.createElement('span')
      const characterMenu = document.createElement('div')
      const body = document.createElement('textarea')
      const closeButton = document.createElement('button')
      let characterMenuOpen = false
      let resizeFrame = 0
      const closeCharacterMenuOnOutsideClick = (event: PointerEvent) => {
        if (!characterMenuOpen || characterDropdown.contains(event.target as Node)) return
        setCharacterMenuOpen(false)
      }

      dom.className = 'script-dialogue-block'
      dom.dataset.dialogueBlock = 'true'
      dom.contentEditable = 'false'
      dom.draggable = false
      header.className = 'script-dialogue-header'
      characterDropdown.className = 'script-note-type script-dialogue-character'
      characterButton.type = 'button'
      characterButton.className = 'script-note-type-trigger'
      characterButton.setAttribute('aria-haspopup', 'menu')
      characterButton.setAttribute('aria-expanded', 'false')
      characterButton.setAttribute('aria-label', 'Personaggio')
      characterLabel.className = 'script-note-type-label'
      characterIcon.className = 'script-note-type-icon'
      characterButton.append(characterLabel, characterIcon)
      characterMenu.className = 'script-note-type-menu'
      characterMenu.setAttribute('role', 'menu')
      characterDropdown.append(characterButton, characterMenu)
      closeButton.type = 'button'
      closeButton.className = 'script-dialogue-close'
      closeButton.title = 'Elimina battuta'
      closeButton.setAttribute('aria-label', 'Elimina battuta')
      closeButton.textContent = '×'
      body.className = 'script-dialogue-text'
      body.rows = 1
      body.placeholder = 'Battuta'
      header.append(characterDropdown, closeButton)
      dom.append(header, body)

      const writePointerDragPayload = (event: PointerEvent | MouseEvent) => {
        const target = event.target as HTMLElement | null
        if (!target?.closest('.script-dialogue-header') || target.closest('button, textarea, .script-note-type-menu')) return
        const id = String(currentNode.attrs.id ?? '')
        if (!id) return
        ;(window as ScriptDialogueWindow).__STAGEDESK_DRAG_PAYLOAD__ = {
          type: DIALOGUE_ID_DND_TYPE,
          value: id,
          startedAt: Date.now(),
          startX: event.clientX,
          startY: event.clientY,
          pointerId: 'pointerId' in event ? event.pointerId : undefined,
          label: String(currentNode.attrs.character || 'Battuta'),
          detail: 'Battuta',
          tone: 'cue',
        }
      }

      const startNativeDrag = (event: Event) => {
        const dragEvent = event as DragEvent
        const target = dragEvent.target as HTMLElement | null
        if (target?.closest('button, textarea, .script-note-type-menu')) {
          dragEvent.preventDefault()
          return
        }
        const id = String(currentNode.attrs.id ?? '')
        if (!id || !dragEvent.dataTransfer) return
        dragEvent.dataTransfer.effectAllowed = 'move'
        dragEvent.dataTransfer.setData('text/plain', `${DIALOGUE_ID_DND_PREFIX}${id}`)
        dragEvent.dataTransfer.setData(DIALOGUE_ID_DND_TYPE, id)
        writePointerDragPayload(dragEvent)
      }

      const clearDialogueDragPayload = () => {
        const payload = (window as ScriptDialogueWindow).__STAGEDESK_DRAG_PAYLOAD__
        if (payload?.type === DIALOGUE_ID_DND_TYPE) delete (window as ScriptDialogueWindow).__STAGEDESK_DRAG_PAYLOAD__
      }

      const updateAttrs = (patch: Partial<ScriptDialogueAttrs>) => {
        const position = typeof getPos === 'function' ? getPos() : undefined
        if (typeof position !== 'number') return
        const attrs = { ...currentNode.attrs, ...patch }
        editor.view.dispatch(editor.state.tr.setNodeMarkup(position, undefined, attrs))
      }

      const resize = () => {
        body.style.height = 'auto'
        body.style.height = `${Math.max(38, body.scrollHeight)}px`
      }

      const scheduleResize = () => {
        if (resizeFrame) window.cancelAnimationFrame(resizeFrame)
        resizeFrame = window.requestAnimationFrame(() => {
          resizeFrame = 0
          resize()
        })
      }

      const selectDialogueNode = () => {
        const position = typeof getPos === 'function' ? getPos() : undefined
        if (typeof position !== 'number') return
        const selection = NodeSelection.create(editor.state.doc, position)
        if (editor.state.selection.eq(selection)) return
        editor.view.dispatch(editor.state.tr.setSelection(selection))
      }

      const insertParagraphAfterDialogue = () => {
        const position = typeof getPos === 'function' ? getPos() : undefined
        const paragraphType = editor.state.schema.nodes.paragraph
        if (typeof position !== 'number' || !paragraphType) return
        const insertPosition = position + currentNode.nodeSize
        const transaction = editor.state.tr.insert(insertPosition, paragraphType.create())
        transaction.setSelection(TextSelection.create(transaction.doc, insertPosition + 1))
        transaction.scrollIntoView()
        editor.view.dispatch(transaction)
        editor.view.focus()
      }

      const setCharacterMenuOpen = (open: boolean) => {
        characterMenuOpen = open
        characterDropdown.dataset.open = String(open)
        characterButton.setAttribute('aria-expanded', String(open))
      }

      const renderOptions = () => {
        const attrs = currentNode.attrs as ScriptDialogueAttrs
        const options = characterOptions(attrs.characterId, attrs.character)
        characterMenu.replaceChildren()
        for (const option of options) {
          const item = document.createElement('button')
          item.type = 'button'
          item.className = 'script-note-type-option script-dialogue-character-option'
          item.dataset.characterId = option.id
          item.dataset.active = String(option.id === attrs.characterId)
          item.setAttribute('role', 'menuitem')
          item.textContent = option.name
          characterMenu.append(item)
        }
      }

      const render = () => {
        const attrs = currentNode.attrs as ScriptDialogueAttrs
        dom.dataset.dialogueId = attrs.id
        dom.dataset.characterId = attrs.characterId
        dom.dataset.characterName = attrs.character
        dom.dataset.dialogueText = attrs.text
        dom.dataset.sceneId = attrs.sceneId
        characterLabel.textContent = attrs.character || 'PERSONAGGIO'
        renderOptions()
        body.value = attrs.text
        scheduleResize()
      }

      characterButton.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        selectDialogueNode()
        setCharacterMenuOpen(!characterMenuOpen)
      })

      closeButton.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        const position = typeof getPos === 'function' ? getPos() : undefined
        if (typeof position !== 'number') return
        editor.view.dispatch(editor.state.tr.delete(position, position + currentNode.nodeSize))
        editor.view.focus()
      })

      header.draggable = true
      header.addEventListener('pointerdown', writePointerDragPayload)
      header.addEventListener('mousedown', writePointerDragPayload)
      header.addEventListener('dragstart', startNativeDrag)
      header.addEventListener('dragend', clearDialogueDragPayload)

      characterMenu.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        const option = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('.script-dialogue-character-option')
        if (!option) return
        const selected = characterOptions('', '').find((item) => item.id === option.dataset.characterId)
        updateAttrs({
          characterId: selected?.id ?? option.dataset.characterId ?? '',
          character: selected?.name ?? option.textContent ?? '',
        })
        setCharacterMenuOpen(false)
      })

      body.addEventListener('input', () => {
        selectDialogueNode()
        scheduleResize()
        updateAttrs({ text: body.value })
      })
      body.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey)) return
        event.preventDefault()
        event.stopPropagation()
        insertParagraphAfterDialogue()
      })
      body.addEventListener('focus', selectDialogueNode)
      body.addEventListener('pointerdown', selectDialogueNode)
      body.addEventListener('click', selectDialogueNode)

      window.addEventListener('stagedesk-characters-updated', render)
      window.addEventListener('pointerdown', closeCharacterMenuOnOutsideClick)
      window.addEventListener('resize', scheduleResize)
      const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(scheduleResize) : undefined
      resizeObserver?.observe(dom)
      render()

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== 'scriptDialogue') return false
          currentNode = updatedNode
          render()
          return true
        },
        stopEvent(event) {
          const target = event.target as HTMLElement | null
          return Boolean(target?.closest('button, textarea, .script-note-type-menu'))
        },
        destroy() {
          if (resizeFrame) window.cancelAnimationFrame(resizeFrame)
          resizeObserver?.disconnect()
          window.removeEventListener('stagedesk-characters-updated', render)
          window.removeEventListener('pointerdown', closeCharacterMenuOnOutsideClick)
          window.removeEventListener('resize', scheduleResize)
          header.removeEventListener('pointerdown', writePointerDragPayload)
          header.removeEventListener('mousedown', writePointerDragPayload)
          header.removeEventListener('dragstart', startNativeDrag)
          header.removeEventListener('dragend', clearDialogueDragPayload)
        },
      }
    }
  },
})
