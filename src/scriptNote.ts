import { mergeAttributes, Node as TiptapNode } from '@tiptap/core'

type ScriptNoteAttrs = {
  type: string
  color: string
  title: string
  content: string
  refId: string
  collapsed: boolean
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

export const ScriptNote = TiptapNode.create({
  name: 'scriptNote',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

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
        draggable: 'true',
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
      const deleteButton = document.createElement('button')
      const body = document.createElement('div')
      const contentTextarea = document.createElement('textarea')
      let typeMenuOpen = false
      const closeTypeMenuOnOutsideClick = (event: PointerEvent) => {
        if (!typeMenuOpen || typeDropdown.contains(event.target as Node)) return
        setTypeMenuOpen(false)
      }

      dom.className = 'script-note-block'
      dom.dataset.noteBlock = 'true'
      dom.contentEditable = 'false'
      dom.draggable = true
      header.className = 'script-note-header'
      header.draggable = true
      collapseButton.type = 'button'
      collapseButton.className = 'script-note-collapse'
      collapseIcon.className = 'script-note-collapse-icon'
      collapseButton.append(collapseIcon)
      titleInput.className = 'script-note-title'
      titleInput.type = 'text'
      titleInput.draggable = true
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
      typeDropdown.append(typeButton, typeMenu)
      deleteButton.type = 'button'
      deleteButton.className = 'script-note-delete'
      deleteButton.title = 'Elimina nota'
      deleteButton.setAttribute('aria-label', 'Elimina nota')
      deleteButton.textContent = '×'
      body.className = 'script-note-body'
      contentTextarea.className = 'script-note-content'
      contentTextarea.rows = 4

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

      const resizeTextarea = () => {
        contentTextarea.style.height = 'auto'
        contentTextarea.style.height = `${Math.max(78, contentTextarea.scrollHeight)}px`
      }

      const setTypeMenuOpen = (open: boolean) => {
        typeMenuOpen = open
        typeDropdown.dataset.open = String(open)
        typeButton.setAttribute('aria-expanded', String(open))
      }

      const render = () => {
        const attrs = currentNode.attrs as ScriptNoteAttrs
        const selectedType = noteTypes.find((item) => item.id === attrs.type) ?? noteTypes[noteTypes.length - 1]
        dom.dataset.noteColor = attrs.color
        dom.dataset.noteCollapsed = String(attrs.collapsed)
        collapseButton.title = attrs.collapsed ? 'Espandi nota' : 'Collassa nota'
        collapseButton.setAttribute('aria-label', collapseButton.title)
        titleInput.value = attrs.title
        typeLabel.textContent = selectedType?.label ?? attrs.type
        for (const option of Array.from(typeMenu.children)) {
          const item = option as HTMLElement
          item.dataset.active = String(item.dataset.noteTypeId === attrs.type)
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
      dom.addEventListener('dragstart', (event) => {
        const target = event.target as HTMLElement | null
        if (target?.closest('button, textarea, .script-note-type-menu')) {
          event.preventDefault()
          return
        }
        event.dataTransfer?.setData('application/x-stagedesk-note-id', String(currentNode.attrs.refId ?? ''))
        event.dataTransfer?.setData('text/plain', `stagedesk-note:${String(currentNode.attrs.refId ?? '')}`)
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
      })
      document.addEventListener('pointerdown', closeTypeMenuOnOutsideClick)
      contentTextarea.addEventListener('input', () => {
        resizeTextarea()
        updateAttrs({ content: contentTextarea.value })
      })

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
        },
      }
    }
  },
})
