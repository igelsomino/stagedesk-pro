import { mergeAttributes, Node as TiptapNode } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

type ScriptNoteAttrs = {
  type: string
  color: string
  title: string
  content: string
  refId: string
  collapsed: boolean
}

type ScriptNoteWindow = Window & {
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

const noteTypes = [
  { id: 'movement', label: 'Movimento', color: 'green' },
  { id: 'position', label: 'Posizione', color: 'blue' },
  { id: 'characters', label: 'Personaggi in scena', color: 'blue' },
  { id: 'tone', label: 'Tono', color: 'purple' },
  { id: 'light', label: 'Luce', color: 'yellow' },
  { id: 'audio', label: 'Audio', color: 'orange' },
  { id: 'video', label: 'Video', color: 'red' },
  { id: 'image', label: 'Immagine', color: 'gray' },
  { id: 'prop', label: 'Oggetto di scena', color: 'brown' },
  { id: 'general', label: 'Nota generale', color: 'cyan' },
]

const noteColors = [
  { id: 'cyan', label: 'Ciano' },
  { id: 'blue', label: 'Blu' },
  { id: 'green', label: 'Verde' },
  { id: 'purple', label: 'Viola' },
  { id: 'yellow', label: 'Giallo' },
  { id: 'orange', label: 'Arancio' },
  { id: 'red', label: 'Rosso' },
  { id: 'gray', label: 'Grigio' },
  { id: 'brown', label: 'Marrone' },
]

export const ScriptNote = TiptapNode.create({
  name: 'scriptNote',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      type: {
        default: 'general',
        parseHTML: (element) => element.getAttribute('data-note-type') ?? 'general',
      },
      color: {
        default: 'cyan',
        parseHTML: (element) => element.getAttribute('data-note-color') ?? 'cyan',
      },
      title: {
        default: 'Nota regia',
        parseHTML: (element) => element.getAttribute('data-note-title') ?? 'Nota regia',
      },
      content: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-note-content') ?? '',
      },
      refId: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-ref-id') ?? '',
      },
      collapsed: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-note-collapsed') === 'true',
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-note-block]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    const attrs = node.attrs as ScriptNoteAttrs
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-note-block': 'true',
        'data-note-type': attrs.type,
        'data-note-color': attrs.color,
        'data-note-title': attrs.title,
        'data-note-content': attrs.content,
        'data-ref-id': attrs.refId,
        'data-note-collapsed': String(attrs.collapsed),
        draggable: 'false',
      }),
      attrs.title,
    ]
  },

  renderText({ node }) {
    return `[NOTA: ${node.attrs.refId || node.attrs.title}]`
  },

  addNodeView() {
    return ({ editor, getPos, node }) => {
      let currentNode = node
      const dom = document.createElement('section')
      const header = document.createElement('div')
      const collapseButton = document.createElement('button')
      const collapseIcon = document.createElement('span')
      const titleInput = document.createElement('input')
      const typeDropdown = document.createElement('div')
      const typeButton = document.createElement('button')
      const typeLabel = document.createElement('span')
      const typeIcon = document.createElement('span')
      const typeMenu = document.createElement('div')
      const typeMenuSeparator = document.createElement('div')
      const colorSubmenu = document.createElement('div')
      const colorButton = document.createElement('button')
      const colorLabel = document.createElement('span')
      const colorIcon = document.createElement('span')
      const colorPanel = document.createElement('div')
      const deleteButton = document.createElement('button')
      const body = document.createElement('div')
      const contentTextarea = document.createElement('textarea')
      let typeMenuOpen = false
      let colorMenuOpen = false
      const closeTypeMenuOnOutsideClick = (event: PointerEvent) => {
        if (!typeMenuOpen || typeDropdown.contains(event.target as Node)) return
        setTypeMenuOpen(false)
      }

      dom.className = 'script-note-block'
      dom.dataset.noteBlock = 'true'
      dom.contentEditable = 'false'
      dom.draggable = false
      header.className = 'script-note-header'
      header.draggable = false
      collapseButton.type = 'button'
      collapseButton.className = 'script-note-collapse'
      collapseIcon.className = 'script-note-collapse-icon'
      collapseButton.append(collapseIcon)
      titleInput.className = 'script-note-title'
      titleInput.type = 'text'
      titleInput.draggable = false
      typeDropdown.className = 'script-note-type'
      typeButton.type = 'button'
      typeButton.className = 'script-note-type-trigger'
      typeButton.setAttribute('aria-haspopup', 'menu')
      typeButton.setAttribute('aria-expanded', 'false')
      typeLabel.className = 'script-note-type-label'
      typeIcon.className = 'script-note-type-icon'
      typeButton.append(typeLabel, typeIcon)
      typeMenu.className = 'script-note-type-menu'
      typeMenu.setAttribute('role', 'menu')
      for (const noteType of noteTypes) {
        const option = document.createElement('button')
        option.type = 'button'
        option.className = 'script-note-type-option'
        option.dataset.noteTypeId = noteType.id
        option.dataset.noteColor = noteType.color
        option.setAttribute('role', 'menuitem')
        option.textContent = noteType.label
        typeMenu.append(option)
      }
      typeMenuSeparator.className = 'script-note-type-separator'
      typeMenuSeparator.setAttribute('role', 'separator')
      colorSubmenu.className = 'script-note-color-submenu'
      colorButton.type = 'button'
      colorButton.className = 'script-note-color-trigger'
      colorButton.setAttribute('role', 'menuitem')
      colorButton.setAttribute('aria-haspopup', 'menu')
      colorButton.setAttribute('aria-expanded', 'false')
      colorLabel.textContent = 'Colore'
      colorIcon.className = 'script-note-color-icon'
      colorButton.append(colorLabel, colorIcon)
      colorPanel.className = 'script-note-color-panel'
      colorPanel.setAttribute('role', 'menu')
      for (const noteColor of noteColors) {
        const option = document.createElement('button')
        const swatch = document.createElement('span')
        const label = document.createElement('span')
        option.type = 'button'
        option.className = 'script-note-color-option'
        option.dataset.noteColor = noteColor.id
        option.setAttribute('role', 'menuitem')
        option.setAttribute('aria-label', `Colore ${noteColor.label}`)
        option.title = noteColor.label
        swatch.className = `script-note-color-swatch ${noteColor.id}`
        label.textContent = noteColor.label
        option.append(swatch, label)
        colorPanel.append(option)
      }
      colorSubmenu.append(colorButton, colorPanel)
      typeMenu.append(typeMenuSeparator, colorSubmenu)
      typeDropdown.append(typeButton, typeMenu)
      deleteButton.type = 'button'
      deleteButton.className = 'script-note-delete'
      deleteButton.title = 'Elimina nota'
      deleteButton.setAttribute('aria-label', 'Elimina nota')
      deleteButton.textContent = '×'
      body.className = 'script-note-body'
      contentTextarea.className = 'script-note-content'
      contentTextarea.rows = 4
      contentTextarea.draggable = false

      header.append(collapseButton, titleInput, typeDropdown, deleteButton)
      body.append(contentTextarea)
      dom.append(header, body)

      const dispatchNoteEvent = (name: 'script-note-update' | 'script-note-delete', attrs = currentNode.attrs) => {
        window.dispatchEvent(new CustomEvent(name, { detail: { id: attrs.refId, attrs } }))
      }

      const updateAttrs = (patch: Partial<ScriptNoteAttrs>) => {
        const position = typeof getPos === 'function' ? getPos() : undefined
        if (typeof position !== 'number') return
        const attrs = { ...currentNode.attrs, ...patch }
        editor.view.dispatch(editor.state.tr.setNodeMarkup(position, undefined, attrs))
        dispatchNoteEvent('script-note-update', attrs)
      }

      const insertParagraphAfterNote = () => {
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

      const focusAdjacentScriptBlock = (direction: 'next' | 'previous') => {
        const blocks = Array.from(document.querySelectorAll<HTMLElement>('[data-ref-id], [data-dialogue-id]'))
        const currentIndex = blocks.indexOf(dom)
        const targetIndex = currentIndex + (direction === 'next' ? 1 : -1)
        const targetElement = currentIndex < 0 ? undefined : blocks[targetIndex]
        const targetTextarea = targetElement?.querySelector<HTMLTextAreaElement>('textarea')
        if (!targetTextarea) return false
        window.requestAnimationFrame(() => {
          targetTextarea.focus({ preventScroll: true })
          const caret = direction === 'next' ? 0 : targetTextarea.value.length
          targetTextarea.setSelectionRange(caret, caret)
          targetTextarea.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        })
        return true
      }

      const resizeTextarea = () => {
        contentTextarea.style.height = 'auto'
        contentTextarea.style.height = `${Math.max(78, contentTextarea.scrollHeight)}px`
      }

      const setTypeMenuOpen = (open: boolean) => {
        typeMenuOpen = open
        typeDropdown.dataset.open = String(open)
        typeButton.setAttribute('aria-expanded', String(open))
        if (!open) setColorMenuOpen(false)
      }

      const setColorMenuOpen = (open: boolean) => {
        colorMenuOpen = open
        colorSubmenu.dataset.open = String(open)
        colorButton.setAttribute('aria-expanded', String(open))
      }

      const render = () => {
        const attrs = currentNode.attrs as ScriptNoteAttrs
        const selectedType = noteTypes.find((item) => item.id === attrs.type) ?? noteTypes[noteTypes.length - 1]
        dom.dataset.refId = attrs.refId
        dom.dataset.noteColor = attrs.color
        dom.dataset.noteCollapsed = String(attrs.collapsed)
        collapseButton.title = attrs.collapsed ? 'Espandi nota' : 'Collassa nota'
        collapseButton.setAttribute('aria-label', collapseButton.title)
        titleInput.value = attrs.title
        typeLabel.textContent = selectedType?.label ?? attrs.type
        for (const option of Array.from(typeMenu.querySelectorAll<HTMLElement>('.script-note-type-option'))) {
          const item = option as HTMLElement
          item.dataset.active = String(item.dataset.noteTypeId === attrs.type)
        }
        for (const option of Array.from(colorPanel.querySelectorAll<HTMLElement>('.script-note-color-option'))) {
          option.dataset.active = String(option.dataset.noteColor === attrs.color)
        }
        contentTextarea.value = attrs.content
        resizeTextarea()
      }

      collapseButton.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        updateAttrs({ collapsed: !currentNode.attrs.collapsed })
      })

      deleteButton.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        const position = typeof getPos === 'function' ? getPos() : undefined
        if (typeof position !== 'number') return
        const id = currentNode.attrs.refId
        editor.view.dispatch(editor.state.tr.delete(position, position + currentNode.nodeSize))
        window.dispatchEvent(new CustomEvent('script-note-delete', { detail: { id } }))
      })

      titleInput.addEventListener('input', () => updateAttrs({ title: titleInput.value }))
      typeButton.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        setTypeMenuOpen(!typeMenuOpen)
      })
      colorButton.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        setColorMenuOpen(!colorMenuOpen)
      })
      typeMenu.addEventListener('click', (event) => {
        const option = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('.script-note-type-option')
        if (!option) return
        event.preventDefault()
        event.stopPropagation()
        const noteType = noteTypes.find((item) => item.id === option.dataset.noteTypeId)
        if (!noteType) return
        setTypeMenuOpen(false)
        updateAttrs({ type: noteType.id, color: noteType.color })
      })
      colorPanel.addEventListener('click', (event) => {
        const option = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('.script-note-color-option')
        if (!option?.dataset.noteColor) return
        event.preventDefault()
        event.stopPropagation()
        setTypeMenuOpen(false)
        updateAttrs({ color: option.dataset.noteColor })
      })
      const writePointerDragPayload = (event: PointerEvent | MouseEvent) => {
        const target = event.target as HTMLElement | null
        if (!target?.closest('.script-note-header') || target.closest('button, textarea, .script-note-type-menu')) {
          return
        }
        const refId = String(currentNode.attrs.refId ?? '')
        if (!refId) return
        ;(window as ScriptNoteWindow).__STAGEDESK_DRAG_PAYLOAD__ = {
          type: 'application/x-stagedesk-note-id',
          value: refId,
          startedAt: Date.now(),
          startX: event.clientX,
          startY: event.clientY,
          pointerId: 'pointerId' in event ? event.pointerId : undefined,
          label: String(currentNode.attrs.title ?? 'Nota regia'),
          detail: noteTypes.find((item) => item.id === currentNode.attrs.type)?.label ?? 'Nota regia',
          tone: 'note',
        }
      }
      dom.addEventListener('pointerdown', writePointerDragPayload)
      dom.addEventListener('mousedown', writePointerDragPayload)
      dom.addEventListener('dragstart', (event) => {
        event.preventDefault()
      })
      dom.addEventListener('dragend', () => {
        delete (window as ScriptNoteWindow).__STAGEDESK_DRAG_PAYLOAD__
      })
      document.addEventListener('pointerdown', closeTypeMenuOnOutsideClick)
      contentTextarea.addEventListener('input', () => {
        resizeTextarea()
        updateAttrs({ content: contentTextarea.value })
      })
      contentTextarea.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          const atBoundary = event.key === 'ArrowDown'
            ? contentTextarea.selectionStart === contentTextarea.value.length && contentTextarea.selectionEnd === contentTextarea.value.length
            : contentTextarea.selectionStart === 0 && contentTextarea.selectionEnd === 0
          if (atBoundary && !event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey && focusAdjacentScriptBlock(event.key === 'ArrowDown' ? 'next' : 'previous')) {
            event.preventDefault()
            event.stopPropagation()
            return
          }
        }
        if (event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey)) return
        event.preventDefault()
        event.stopPropagation()
        insertParagraphAfterNote()
      })
      const preventTextDrag = (event: DragEvent) => event.preventDefault()
      contentTextarea.addEventListener('dragstart', preventTextDrag)

      render()

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== 'scriptNote') return false
          currentNode = updatedNode
          render()
          return true
        },
        stopEvent(event) {
          const target = event.target as HTMLElement | null
          return Boolean(target?.closest('button, input, textarea, .script-note-type-menu'))
        },
        destroy() {
          document.removeEventListener('pointerdown', closeTypeMenuOnOutsideClick)
          contentTextarea.removeEventListener('dragstart', preventTextDrag)
        },
      }
    }
  },
})
