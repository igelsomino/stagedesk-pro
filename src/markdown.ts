import type { DirectorNote, MediaCue, ProjectTreeNode, ScriptBlock } from './domain'

export const cleanScriptMarkdown = (markdown: string) =>
  markdown
    .replace(/::regia\{[^}]*\}[\s\S]*?::/g, '')
    .replace(/::media\{[^}]*\}[\s\S]*?::/g, '')
    .replace(/^\[NOTA:[^\]]+\](?:\s+\{[^}]+\})?\s*$/gm, '')
    .replace(/^\[CUE[:\s][^\]]+\](?:\s+\{[^}]+\})?\s*$/gm, '')
    .replace(/\s*\[BOOKMARK:[^\]]+\](?:\s+\{[^}]+\})?/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

export const toEditorMarkdown = (markdown: string) =>
  markdown
    .replace(/::regia\{([^}]*)\}[\s\S]*?::/g, (_, attrs: string) => {
      const type = readAttr(attrs, 'type')?.toUpperCase() ?? 'GENERALE'
      return `[NOTA: ${type}]`
    })
    .replace(/::media\{([^}]*)\}[\s\S]*?::/g, (_, attrs: string) => {
      const type = readAttr(attrs, 'type')?.toUpperCase() ?? 'MEDIA'
      const src = readAttr(attrs, 'src')?.split('/').pop() ?? 'file'
      return `[CUE ${type}: ${src}]`
    })

export const markdownToHtml = (markdown: string) => {
  const lines = toEditorMarkdownWithRefs(markdown).split('\n')
  const html: string[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]

    if (/^-{3,}$/.test(line.trim())) {
      html.push('<hr>')
      continue
    }

    if (/^- /.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^- /.test(lines[index])) {
        items.push(`<li><p>${renderInlineMarkdown(lines[index].replace(/^- /, ''))}</p></li>`)
        index += 1
      }
      index -= 1
      html.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    if (/^\d+\. /.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\d+\. /.test(lines[index])) {
        items.push(`<li><p>${renderInlineMarkdown(lines[index].replace(/^\d+\. /, ''))}</p></li>`)
        index += 1
      }
      index -= 1
      html.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    if (/^> ?/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^> ?/.test(lines[index])) {
        items.push(`<p>${renderInlineMarkdown(lines[index].replace(/^> ?/, ''))}</p>`)
        index += 1
      }
      index -= 1
      html.push(`<blockquote>${items.join('')}</blockquote>`)
      continue
    }

    if (isMarkdownTableStart(lines, index)) {
      const tableRows: string[] = []
      while (index < lines.length && isMarkdownTableRow(lines[index])) {
        tableRows.push(lines[index])
        index += 1
      }
      index -= 1
      html.push(markdownTableToHtml(tableRows))
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`)
      continue
    }

    if (/^\[NOTA:/.test(line)) {
      const chip = parseChipLine(line)
      html.push(noteBlockHtml(chip.label, chip.refId, chip.color, chip.type, chip.content, chip.collapsed))
      continue
    }
    if (/^\[CUE/.test(line)) {
      const chip = parseChipLine(line)
      html.push(chipHtml('cue', chip.label, chip.refId, chip.color))
      continue
    }
    if (/^\[BOOKMARK:/.test(line)) {
      const chip = parseChipLine(line)
      html.push(chipHtml('bookmark', chip.label, chip.refId, 'bookmark'))
      continue
    }
    if (!line.trim()) {
      html.push('<p></p>')
      continue
    }
    html.push(`<p>${renderInlineMarkdown(line)}</p>`)
  }

  return html.join('')
}

const toEditorMarkdownWithRefs = (markdown: string) =>
  markdown
    .replace(/::regia\{([^}]*)\}([\s\S]*?)::/g, (_, attrs: string, content: string) => {
      const type = readAttr(attrs, 'type')?.toUpperCase() ?? 'GENERALE'
      const title = readAttr(attrs, 'title')?.trim()
      const color = readAttr(attrs, 'color')
      const id = readAttr(attrs, 'id')
      const noteType = readAttr(attrs, 'type') ?? 'general'
      const collapsed = readAttr(attrs, 'collapsed') === 'true'
      return noteBlockLine(title || type, id, color, noteType, content.trim(), collapsed)
    })
    .replace(/::media\{([^}]*)\}[\s\S]*?::/g, (_, attrs: string) => {
      const type = readAttr(attrs, 'type')?.toUpperCase() ?? 'MEDIA'
      const src = readAttr(attrs, 'src')?.split('/').pop() ?? 'file'
      const title = readAttr(attrs, 'title')?.trim()
      const id = readAttr(attrs, 'id')
      return cueChipLine(title || src, id, type.toLowerCase())
    })

export const serializeExtendedMarkdown = (
  editorMarkdown: string,
  notes: DirectorNote[],
  cues: MediaCue[],
) => {
  let noteIndex = 0
  let cueIndex = 0

  return editorMarkdown
    .split('\n')
    .map((line) => {
      if (/^\[NOTA:/.test(line.trim())) {
        const refId =
          line.trim().match(/\{#([^\s}]+)/)?.[1] ??
          line.trim().match(/^\[NOTA:\s*([^\]]+)\]/)?.[1]
        const note = notes.find((item) => item.id === refId) ?? notes[noteIndex]
        noteIndex += 1
        if (!note) return line
        return serializeDirectorNote(note)
      }

      if (/^\[CUE/.test(line.trim())) {
        const refId =
          line.trim().match(/\{#([^\s}]+)/)?.[1] ??
          line.trim().match(/^\[CUE(?:\s+|:\s*)([^\]}]+)/)?.[1]?.trim()
        const cue = cues.find((item) => item.id === refId) ?? cues[cueIndex]
        cueIndex += 1
        if (!cue) return line
        return serializeMediaCue(cue)
      }

      if (/^\[BOOKMARK:/.test(line.trim())) return line

      return line
    })
    .join('\n')
}

export const parseScriptBlocks = (markdown: string): ScriptBlock[] => {
  const lines = toEditorMarkdown(markdown).split('\n')
  const blocks: ScriptBlock[] = []
  let sceneId: string | undefined
  let currentCharacter: string | undefined
  let position = 0

  for (let index = 0; index < lines.length; index += 1) {
    const text = stripBookmarkMarkers(lines[index].trim())
    if (!text) continue

    if (text.startsWith('# ')) {
      blocks.push({ id: makeId('title', index), type: 'title', text: text.slice(2), position: position++ })
      continue
    }

    if (text.startsWith('## ') || /^SCENA\b/i.test(text)) {
      sceneId = slug(text.replace(/^##\s*/, ''))
      blocks.push({ id: sceneId, type: 'scene', text: text.replace(/^##\s*/, ''), sceneId, position: position++ })
      continue
    }

    if (/^#{3,6}\s+/.test(text)) {
      const heading = text.match(/^(#{3,6})\s+(.+)$/)
      blocks.push({
        id: makeId('section', index),
        type: 'section',
        text: heading?.[2] ?? text.replace(/^#{3,6}\s+/, ''),
        sceneId,
        headingLevel: heading?.[1].length ?? 3,
        position: position++,
      })
      continue
    }

    if (isMarkdownTableStart(lines, index)) {
      const tableRows: string[] = []
      while (index < lines.length && isMarkdownTableRow(lines[index])) {
        tableRows.push(lines[index])
        index += 1
      }
      index -= 1

      const [headerRow, , ...bodyRows] = tableRows
      const parsedRows = [
        { cells: splitMarkdownTableRow(headerRow), header: true },
        ...bodyRows.map((row) => ({ cells: splitMarkdownTableRow(row) })),
      ]
      const text = parsedRows.map((row) => row.cells.join(' | ')).join('\n')
      blocks.push({ id: makeId('table', index), type: 'table', text, tableRows: parsedRows, sceneId, position: position++ })
      continue
    }

    if (/^> ?/.test(text)) {
      const quoteLines: string[] = []
      while (index < lines.length && /^> ?/.test(stripBookmarkMarkers(lines[index].trim()))) {
        quoteLines.push(stripBookmarkMarkers(lines[index].trim()).replace(/^> ?/, '').trim())
        index += 1
      }
      index -= 1
      blocks.push({ id: makeId('quote', index), type: 'quote', text: quoteLines.join('\n'), sceneId, position: position++ })
      continue
    }

    if (/^\[NOTA:/.test(text)) {
      blocks.push({ id: makeId('note', index), type: 'note', text, sceneId, position: position++ })
      continue
    }

    if (/^\[CUE[:\s]/.test(text)) {
      blocks.push({ id: makeId('cue', index), type: 'media', text, sceneId, position: position++ })
      continue
    }

    const inlineDialogue = text.match(/^\*\*([^*]+)\*\*:\s*(.+)$/)
    if (inlineDialogue) {
      currentCharacter = inlineDialogue[1].trim()
      blocks.push({
        id: makeId('dialogue', index),
        type: 'dialogue',
        text,
        characterId: slug(currentCharacter),
        sceneId,
        position: position++,
      })
      continue
    }

    if (/^[A-Z0-9 '._-]{2,}$/.test(text)) {
      currentCharacter = text
      blocks.push({
        id: makeId('character', index),
        type: 'character',
        text,
        characterId: slug(text),
        sceneId,
        position: position++,
      })
      continue
    }

    blocks.push({
      id: makeId('dialogue', index),
      type: 'dialogue',
      text,
      characterId: currentCharacter ? slug(currentCharacter) : undefined,
      sceneId,
      position: position++,
    })
  }

  return blocks
}

export const cueLabel = (cue: MediaCue) => `[CUE ${cue.type.toUpperCase()}: ${cue.src.split('/').pop()}]`

export const findMarkdownNode = (nodes: ProjectTreeNode[], path: string): ProjectTreeNode | undefined => {
  for (const node of nodes) {
    if (node.path === path) return node
    const found = node.children ? findMarkdownNode(node.children, path) : undefined
    if (found) return found
  }
  return undefined
}

export const updateMarkdownNode = (
  nodes: ProjectTreeNode[],
  path: string,
  updater: (node: ProjectTreeNode) => ProjectTreeNode,
): ProjectTreeNode[] =>
  nodes.map((node) => {
    if (node.path === path) return updater(node)
    if (node.children) return { ...node, children: updateMarkdownNode(node.children, path, updater) }
    return node
  })

export const flattenMarkdownFiles = (nodes: ProjectTreeNode[]): ProjectTreeNode[] =>
  nodes.flatMap((node) => (node.kind === 'markdown' ? [node] : flattenMarkdownFiles(node.children ?? [])))

export const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const makeId = (prefix: string, index: number) => `${prefix}-${index + 1}`

const isMarkdownTableStart = (lines: string[], index: number) =>
  isMarkdownTableRow(lines[index]) && isMarkdownTableSeparator(lines[index + 1] ?? '')

export const hasMarkdownTable = (markdown: string) => {
  const lines = markdown.split('\n')
  return lines.some((_, index) => isMarkdownTableStart(lines, index))
}

const isMarkdownTableRow = (line = '') => {
  const cells = splitMarkdownTableRow(line)
  return cells.length > 1 && cells.some(Boolean)
}

const isMarkdownTableSeparator = (line = '') =>
  /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)

const markdownTableToHtml = (rows: string[]) => {
  const [headerRow, , ...bodyRows] = rows
  const headers = splitMarkdownTableRow(headerRow)
  const body = bodyRows.map(splitMarkdownTableRow)
  return [
    '<table>',
    `<thead><tr>${headers.map((cell) => `<th><p>${renderInlineMarkdown(cell)}</p></th>`).join('')}</tr></thead>`,
    `<tbody>${body.map((row) => `<tr>${row.map((cell) => `<td><p>${renderInlineMarkdown(cell)}</p></td>`).join('')}</tr>`).join('')}</tbody>`,
    '</table>',
  ].join('')
}

const splitMarkdownTableRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())

const readAttr = (attrs: string, name: string) => {
  const match = attrs.match(new RegExp(`${name}="([^"]*)"`, 'i'))
  return match ? decodeAttr(match[1]) : undefined
}

const decodeAttr = (value: string) =>
  value.replace(/&#10;/g, '\n').replace(/&quot;/g, '"').replace(/&amp;/g, '&')

const serializeDirectorNote = (note: DirectorNote) => {
  const attrs = [
    ['id', note.id],
    ['type', note.type],
    ['color', note.color],
    ['title', note.title],
    ['collapsed', note.collapsed ? 'true' : undefined],
    ['sceneId', note.sceneId],
    ['anchorId', note.anchorId],
  ]
    .filter(([, value]) => value)
    .map(([name, value]) => `${name}="${escapeAttr(String(value))}"`)
    .join(' ')

  return `::regia{${attrs}}\n${note.content.trim()}\n::`
}

const serializeMediaCue = (cue: MediaCue) => {
  const attrs = [
    ['id', cue.id],
    ['type', cue.type],
    ['src', cue.src],
    ['title', cue.title],
    ['autoplay', String(cue.autoplay)],
    ['volume', cue.options.volume],
    ['fadeIn', cue.options.fadeIn],
    ['fadeOut', cue.options.fadeOut],
    ['loop', cue.options.loop],
    ['startAt', cue.options.startAt],
    ['endAt', cue.options.endAt],
    ['duration', cue.options.duration],
    ['sceneId', cue.sceneId],
    ['anchorId', cue.anchorId],
  ]
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([name, value]) => `${name}="${escapeAttr(String(value))}"`)
    .join(' ')

  return `::media{${attrs}}\n${(cue.description ?? '').trim()}\n::`
}

const escapeAttr = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/\n/g, '&#10;')

const noteBlockLine = (label: string, refId = '', color = '', type = 'general', content = '', collapsed = false) =>
  `[NOTA: ${label}] {#${refId} .${color} type="${escapeAttr(type)}" content="${escapeAttr(content)}"${collapsed ? ' collapsed="true"' : ''}}`

const cueChipLine = (label: string, refId?: string, color?: string) => {
  const attrs = [refId ? `#${refId}` : '', color ? `.${color}` : ''].filter(Boolean).join(' ')
  return attrs ? `[CUE: ${label}] {${attrs}}` : `[CUE: ${label}]`
}

const parseChipLine = (line: string) => {
  const match = line.match(/^\[NOTA:\s*([^\]]+)\](?:\s+\{#([^\s}]+)(?:\s+\.([^\s}]+))?(?:\s+([^}]+))?\})?$/)
  if (match) {
    const extraAttrs = match[4] ?? ''
    return {
      label: match[1],
      refId: match[2] ?? '',
      color: match[3] ?? '',
      type: readAttr(extraAttrs, 'type') ?? 'general',
      content: readAttr(extraAttrs, 'content') ?? '',
      collapsed: readAttr(extraAttrs, 'collapsed') === 'true',
    }
  }

  const richCueMatch = line.match(/^\[CUE:?\s*([^\]]+)\](?:\s+\{#([^\s}]+)(?:\s+\.([^}]+))?\})?$/)
  if (richCueMatch) return { label: richCueMatch[1], refId: richCueMatch[2] ?? '', color: richCueMatch[3] ?? '', type: '', content: '', collapsed: false }

  const bookmarkMatch = line.match(/^\[BOOKMARK:\s*([^\]]+)\](?:\s+\{#([^\s}]+)[^}]*\})?$/)
  if (bookmarkMatch) return { label: bookmarkMatch[1], refId: bookmarkMatch[2] ?? '', color: 'bookmark', type: '', content: '', collapsed: false }

  const cueMatch = line.match(/^(.*?)(?:\s+\{#([^\s}]+)\})?$/)
  return { label: cueMatch?.[1] ?? line, refId: cueMatch?.[2] ?? '', color: '', type: '', content: '', collapsed: false }
}

const chipHtml = (kind: 'cue' | 'bookmark', label: string, refId = '', color = '') =>
  `<p><span data-chip="${kind}" data-chip-label="${escapeAttr(label)}" data-ref-id="${escapeAttr(refId)}" data-chip-color="${escapeAttr(color)}" contenteditable="false" draggable="true">${escapeHtml(label)}</span></p>`

const noteBlockHtml = (label: string, refId = '', color = '', type = 'general', content = '', collapsed = false) =>
  `<div data-note-block="true" data-note-type="${escapeAttr(type)}" data-note-color="${escapeAttr(color)}" data-note-title="${escapeAttr(label)}" data-note-content="${escapeAttr(content)}" data-ref-id="${escapeAttr(refId)}" data-note-collapsed="${String(collapsed)}">${escapeHtml(label)}</div>`

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const renderInlineMarkdown = (value: string) =>
  escapeHtml(value)
    .replace(/\[BOOKMARK:\s*([^\]]+)\](?:\s+\{#([^\s}]+)[^}]*\})?/g, (_, label: string, refId: string) =>
      `<span data-chip="bookmark" data-chip-label="${escapeAttr(label)}" data-ref-id="${escapeAttr(refId ?? '')}" data-chip-color="bookmark" contenteditable="false" draggable="true">${label}</span>`,
    )
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, label: string, href: string) =>
      `<a href="${escapeAttr(href)}" target="_blank" rel="noreferrer">${label}</a>`,
    )
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')

const stripBookmarkMarkers = (value: string) =>
  value.replace(/\s*\[BOOKMARK:\s*[^\]]+\](?:\s+\{#[^\s}]+[^}]*\})?/g, ' ').trim()
