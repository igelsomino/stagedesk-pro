import type { Editor } from '@tiptap/core'
import { DOMParser as ProseMirrorDOMParser, type Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { TableKit } from '@tiptap/extension-table'
import type { jsPDF as JsPDF } from 'jspdf'
import {
  BookOpen,
  Bookmark,
  Bold,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Eraser,
  FileAudio,
  FileImage,
  FilePlus2,
  FileText,
  FileVideo,
  Folder,
  FolderOpen,
  FolderPlus,
  Heading1,
  Heading2,
  Heading3,
  History,
  Images,
  Italic,
  List,
  ListOrdered,
  ListTree,
  Minus,
  MoreVertical,
  PanelLeft,
  PanelRight,
  Pencil,
  Play,
  Quote,
  Redo2,
  RefreshCw,
  Grid2X2X,
  PanelTopClose,
  Search,
  Trash2,
  Type,
  Undo2,
  Upload,
  User,
  LogOut,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ChangeEvent, Dispatch, DragEvent as ReactDragEvent, KeyboardEvent as ReactKeyboardEvent, MutableRefObject, SetStateAction } from 'react'
import './App.css'
import { appDocumentContent, fetchAppDocumentContent, getAppDocument, isAppDocumentPath } from './appDocs'
import { useAuth } from './authContext'
import type { DirectorNote, MediaAsset, MediaCue, NotePanelMode, NoteType, Project, ProjectTreeNode } from './domain'
import { blankProject } from './defaultProject'
import {
  cleanScriptMarkdown,
  cueLabel,
  findMarkdownNode,
  flattenMarkdownFiles,
  hasMarkdownTable,
  markdownToHtml,
  parseScriptBlocks,
  serializeExtendedMarkdown,
  slug,
} from './markdown'
import { ScriptChip } from './scriptChip'
import { ScriptNote } from './scriptNote'
import { browserProjectStorage } from './storage'
import type { ProjectEntry } from './storage'

const storage = browserProjectStorage
const MEDIA_PATH_DND_TYPE = 'application/x-stagedesk-media-path'
const CUE_ID_DND_TYPE = 'application/x-stagedesk-cue-id'
const NOTE_ID_DND_TYPE = 'application/x-stagedesk-note-id'
const MEDIA_PATH_DND_PREFIX = 'stagedesk-media:'
const CUE_ID_DND_PREFIX = 'stagedesk-cue:'
const NOTE_ID_DND_PREFIX = 'stagedesk-note:'
const INSTALLED_UPDATE_VERSION_KEY = 'stagedesk-installed-update-version'
const STAGEDESK_SITE_URL = 'https://stagedesk-pro.aigconsulting.it'
type EditorCueState = 'playing' | 'paused' | 'stopped'
type EditorCueStateWindow = Window & {
  __STAGEDESK_EDITOR_CUE_STATE__?: { id: string; state: EditorCueState }
}
type ExportResult = {
  fileName: string
  location: string
  objectUrl?: string
  filePath?: string
}
const tableExtensions = TableKit.configure({
  table: {
    resizable: false,
  },
})
const linkExtension = Link.configure({
  autolink: true,
  openOnClick: false,
  linkOnPaste: true,
  HTMLAttributes: {
    rel: 'noreferrer',
    target: '_blank',
  },
})

function App() {
  const { user, signOut } = useAuth()
  const [project, setProject] = useState(() => normalizeProject(storage.load()))
  const initialPath = flattenMarkdownFiles(project.scripts)[0]?.path ?? ''
  const initialNoteTypeId = defaultNoteType(project.noteTypes)?.id ?? ''
  const [activePath, setActivePath] = useState(initialPath)
  const [openTabs, setOpenTabs] = useState<string[]>(initialPath ? [initialPath] : [])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [selectedScriptPath, setSelectedScriptPath] = useState(activePath)
  const [selectedMediaPath, setSelectedMediaPath] = useState(project.media[0]?.path ?? '/media')
  const [expandedPaths, setExpandedPaths] = useState<string[]>([
    '/copione',
    '/media',
    ...project.media.map((asset) => asset.path),
  ])
  const [leftTab, setLeftTab] = useState<'outline' | 'script' | 'media' | 'bookmarks'>('outline')
  const [noteMode, setNoteMode] = useState<NotePanelMode>('context')
  const [, setSelectedNoteId] = useState(project.notes[0]?.id ?? '')
  const [selectedNoteTypeId, setSelectedNoteTypeId] = useState(initialNoteTypeId)
  const [selectedCueId, setSelectedCueId] = useState(project.cues[0]?.id ?? '')
  const [search, setSearch] = useState('')
  const [isFullscreen, setFullscreen] = useState(false)
  const [fullscreenIndex, setFullscreenIndex] = useState(0)
  const [executedCueIds, setExecutedCueIds] = useState<string[]>([])
  const [storageStatus, setStorageStatus] = useState('Storage locale browser')
  const [toastMessage, setToastMessage] = useState('')
  const [exportResult, setExportResult] = useState<ExportResult | undefined>()
  const [installedUpdateVersion, setInstalledUpdateVersion] = useState('')
  const [remoteAppDocuments, setRemoteAppDocuments] = useState<Record<string, string>>({})
  const [desktopStorageReady, setDesktopStorageReady] = useState(false)
  const updateCheckStartedRef = useRef(false)
  const updateInstallInProgressRef = useRef(false)
  const toastTimeoutRef = useRef<number | undefined>(undefined)
  const [scriptDialog, setScriptDialog] = useState<ScriptActionDialog | undefined>()
  const [noteMenuOpen, setNoteMenuOpen] = useState(false)
  const [noteMenuPosition, setNoteMenuPosition] = useState<{ top: number; left: number } | undefined>()
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [exportMenuPosition, setExportMenuPosition] = useState<{ top: number; left: number } | undefined>()
  const [appMenuOpen, setAppMenuOpen] = useState(false)
  const [appMenuPosition, setAppMenuPosition] = useState<{ top: number; left: number } | undefined>()
  const [projectPickerEntries, setProjectPickerEntries] = useState<ProjectEntry[]>([])
  const [toolbarState, setToolbarState] = useState<ToolbarState>(emptyToolbarState)
  const [activeEditorSceneId, setActiveEditorSceneId] = useState('')
  const [activeOutline, setActiveOutline] = useState<OutlineItem[]>(() =>
    markdownOutlineItems(findMarkdownNode(project.scripts, initialPath)?.content ?? ''),
  )
  const [activeOutlineId, setActiveOutlineId] = useState('')
  const [activeBookmarks, setActiveBookmarks] = useState<BookmarkItem[]>(() =>
    markdownBookmarkItems(findMarkdownNode(project.scripts, initialPath)?.content ?? ''),
  )
  const [activeBookmarkId, setActiveBookmarkId] = useState('')
  const [editorCueRefIds, setEditorCueRefIds] = useState<string[]>([])

  const markdownFiles = useMemo(() => flattenMarkdownFiles(project.scripts), [project.scripts])
  const activeFile = useMemo(() => findMarkdownNode(project.scripts, activePath), [activePath, project.scripts])
  const activeAppDocument = useMemo(() => getAppDocument(activePath), [activePath])
  const selectedScriptNode = useMemo(
    () => findTreeNode(project.scripts, selectedScriptPath),
    [project.scripts, selectedScriptPath],
  )
  const selectedMediaNode = useMemo(
    () => findTreeNode(project.media, selectedMediaPath),
    [project.media, selectedMediaPath],
  )
  const activeAppDocumentMarkdown = activeAppDocument
    ? appDocumentContent(activeAppDocument, installedUpdateVersion, remoteAppDocuments[activeAppDocument.path])
    : ''
  const activeMarkdown = activeAppDocument
    ? activeAppDocumentMarkdown
    : drafts[activePath] ?? activeFile?.content ?? ''
  const activeCueRefIds = useMemo(
    () => uniqueValues([...markerRefIdsFromMarkdown(activeMarkdown, 'cue'), ...editorCueRefIds]),
    [activeMarkdown, editorCueRefIds],
  )
  const blocks = useMemo(() => parseScriptBlocks(activeMarkdown), [activeMarkdown])
  const performanceBlocks = useMemo(
    () => assignCueBlocks(blocks.filter((block) => isFullscreenBlock(block.type)), project.cues, activePath, activeCueRefIds),
    [activeCueRefIds, activePath, blocks, project.cues],
  )
  const currentBlock = performanceBlocks[fullscreenIndex] ?? performanceBlocks[0]
  const currentScene = activeEditorSceneId || currentBlock?.sceneId
  const selectedNoteType =
    project.noteTypes.find((noteType) => noteType.id === selectedNoteTypeId) ?? defaultNoteType(project.noteTypes)
  const selectedMediaIsProtectedRoot = selectedMediaNode ? isProtectedMediaRoot(selectedMediaNode) : false
  const activeFilePath = activeFile?.path ?? ''
  const userEmail = user?.email ?? 'Utente autenticato'
  const draftsRef = useRef(drafts)
  const projectRef = useRef(project)
  const projectScriptsRef = useRef(project.scripts)
  const activeFilePathRef = useRef(activeFilePath)
  const cueDropActionsRef = useRef({
    insertExistingCue: (_cue: MediaCue, _position: number) => {},
    createCueFromAsset: (_asset: MediaAsset, _position: number) => {},
  })
  projectScriptsRef.current = project.scripts
  projectRef.current = project
  activeFilePathRef.current = activeFilePath
  const lastEditorSelectionRef = useRef<number | undefined>(undefined)
  const editorAudioRef = useRef<HTMLAudioElement | null>(null)
  const editorAudioTimersRef = useRef<number[]>([])
  const editorPlayingCueRef = useRef<{ id: string; state: 'playing' | 'paused' } | undefined>(undefined)
  const noteMenuRef = useRef<HTMLDivElement>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const appMenuRef = useRef<HTMLDivElement>(null)
  const fileNotes = useMemo(
    () => project.notes.filter((note) => note.filePath === activePath),
    [activePath, project.notes],
  )
  const fileCues = useMemo(
    () => project.cues.filter((cue) => cue.filePath === activePath && activeCueRefIds.includes(cue.id)),
    [activeCueRefIds, activePath, project.cues],
  )
  const chipInspectorRef = useRef({ notes: fileNotes, cues: fileCues })

  const showStatus = useCallback((message: string, duration = 3600) => {
    setStorageStatus(message)
    setToastMessage(message)
    setExportResult(undefined)
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current)
    if (duration > 0) {
      toastTimeoutRef.current = window.setTimeout(() => setToastMessage(''), duration)
    }
  }, [])

  useEffect(() => {
    chipInspectorRef.current = { notes: fileNotes, cues: fileCues }
  }, [fileCues, fileNotes])

  useEffect(() => {
    const installedVersion = window.localStorage.getItem(INSTALLED_UPDATE_VERSION_KEY)
    if (!installedVersion) return
    window.localStorage.removeItem(INSTALLED_UPDATE_VERSION_KEY)
    setInstalledUpdateVersion(installedVersion)
    setOpenTabs((current) => (current.includes('app://version-history') ? current : [...current, 'app://version-history']))
    setActivePath('app://version-history')
    showStatus(`Aggiornamento installato: StageDesk Pro ${installedVersion}`)
  }, [showStatus])

  useEffect(() => {
    if (!activeAppDocument) return
    let active = true

    fetchAppDocumentContent(activeAppDocument)
      .then((content) => {
        if (!active) return
        setRemoteAppDocuments((current) =>
          current[activeAppDocument.path] === content ? current : { ...current, [activeAppDocument.path]: content },
        )
      })
      .catch(() => {
        if (active) showStatus(`${activeAppDocument.title} non aggiornato: uso copia locale`)
      })

    return () => {
      active = false
    }
  }, [activeAppDocument, showStatus])

  useEffect(() => () => {
    if (exportResult?.objectUrl) URL.revokeObjectURL(exportResult.objectUrl)
  }, [exportResult])

  useEffect(() => {
    if (fileCues.some((cue) => cue.id === selectedCueId)) return
    setSelectedCueId(fileCues[0]?.id ?? '')
  }, [fileCues, selectedCueId])

  useEffect(() => {
    draftsRef.current = drafts
  }, [drafts])

  useEffect(() => {
    const updateNoteFromEditor = (event: Event) => {
      const { id, attrs } = (event as CustomEvent<{ id?: string; attrs?: Record<string, unknown> }>).detail ?? {}
      if (!id || !attrs) return
      setSelectedNoteId(id)
      setSelectedNoteTypeId(String(attrs.type ?? 'general'))
      setProject((current) => ({
        ...current,
        notes: current.notes.map((note) =>
          note.id === id
            ? {
                ...note,
                title: String(attrs.title ?? note.title ?? ''),
                content: String(attrs.content ?? note.content),
                type: String(attrs.type ?? note.type),
                color: String(attrs.color ?? note.color),
                collapsed: Boolean(attrs.collapsed),
                updatedAt: new Date().toISOString(),
              }
            : note,
        ),
      }))
    }

    const deleteNoteFromEditor = (event: Event) => {
      const { id } = (event as CustomEvent<{ id?: string }>).detail ?? {}
      if (!id) return
      setProject((current) => ({
        ...current,
        notes: current.notes.filter((note) => note.id !== id),
      }))
      setSelectedNoteId((current) => (current === id ? '' : current))
    }

    const dispatchEditorCueState = (id: string, state: EditorCueState) => {
      ;(window as EditorCueStateWindow).__STAGEDESK_EDITOR_CUE_STATE__ = { id, state }
      window.dispatchEvent(new CustomEvent('script-cue-state', { detail: { id, state } }))
    }

    const startEditorCue = async (cue: MediaCue, audio: HTMLAudioElement, assetUrl: string) => {
      if (editorPlayingCueRef.current?.id) dispatchEditorCueState(editorPlayingCueRef.current.id, 'stopped')
      clearAudioTimers(editorAudioTimersRef)
      audio.pause()
      setSelectedCueId(cue.id)
      const preparedSrc = await prepareMediaForCue(audio, cue, assetUrl)
      if (audio.src !== preparedSrc) return
      audio.loop = Boolean(cue.options.loop)
      const targetVolume = cueTargetVolume(cue)
      if ((cue.options.fadeIn ?? 0) > 0) {
        audio.volume = 0
        fadeAudioVolume(audio, targetVolume, cue.options.fadeIn ?? 0, editorAudioTimersRef)
      } else {
        audio.volume = targetVolume
      }
      scheduleCueEnd(audio, cue, editorAudioTimersRef, () => {
        editorPlayingCueRef.current = undefined
        dispatchEditorCueState(cue.id, 'stopped')
      })
      audio.onended = () => {
        editorPlayingCueRef.current = undefined
        dispatchEditorCueState(cue.id, 'stopped')
      }
      try {
        await audio.play()
        editorPlayingCueRef.current = { id: cue.id, state: 'playing' }
        dispatchEditorCueState(cue.id, 'playing')
        setStorageStatus(`Cue avviato: ${cue.title || cue.src}`)
      } catch {
        editorPlayingCueRef.current = { id: cue.id, state: 'paused' }
        dispatchEditorCueState(cue.id, 'paused')
        setStorageStatus(`Cue pronto, avvio bloccato dal browser: ${cue.title || cue.src}`)
      }
    }

    const stopEditorAudioImmediately = (cue: MediaCue) => {
      const audio = editorAudioRef.current
      if (!audio) return
      clearAudioTimers(editorAudioTimersRef)
      audio.onended = null
      audio.pause()
      audio.currentTime = cue.options.startAt ?? 0
      audio.volume = cueTargetVolume(cue)
      audio.removeAttribute('src')
      audio.load()
      editorPlayingCueRef.current = undefined
      dispatchEditorCueState(cue.id, 'stopped')
      setStorageStatus(`Cue fermato: ${cue.title || cue.src}`)
    }

    const toggleCueFromEditor = (event: Event) => {
      const { id } = (event as CustomEvent<{ id?: string }>).detail ?? {}
      if (!id) return
      const cue = projectRef.current.cues.find((item) => item.id === id)
      const audio = editorAudioRef.current
      if (!cue || !audio || (cue.type !== 'audio' && cue.type !== 'music')) return

      if (editorPlayingCueRef.current?.id === cue.id && editorPlayingCueRef.current.state === 'playing') {
        clearAudioTimers(editorAudioTimersRef)
        audio.pause()
        editorPlayingCueRef.current = { id: cue.id, state: 'paused' }
        dispatchEditorCueState(cue.id, 'paused')
        setStorageStatus(`Cue in pausa: ${cue.title || cue.src}`)
        return
      }

      if (editorPlayingCueRef.current?.id === cue.id && editorPlayingCueRef.current.state === 'paused') {
        clearAudioTimers(editorAudioTimersRef)
        scheduleCueEnd(audio, cue, editorAudioTimersRef, () => {
          editorPlayingCueRef.current = undefined
          dispatchEditorCueState(cue.id, 'stopped')
        })
        audio.play()
          .then(() => {
            editorPlayingCueRef.current = { id: cue.id, state: 'playing' }
            dispatchEditorCueState(cue.id, 'playing')
            setStorageStatus(`Cue ripreso: ${cue.title || cue.src}`)
          })
          .catch(() => setStorageStatus(`Cue pronto, avvio bloccato dal browser: ${cue.title || cue.src}`))
        return
      }

      const asset = findTreeNode(projectRef.current.media, cue.src)
      const assetUrl = asset ? mediaAssetUrl(asset, projectRef.current.rootPath) : undefined
      if (!assetUrl) {
        setStorageStatus(`Cue non disponibile: importa di nuovo il file ${cue.src.split('/').pop()}`)
        return
      }

      void startEditorCue(cue, audio, assetUrl)
    }

    const stopCueFromEditor = (event: Event) => {
      const { id } = (event as CustomEvent<{ id?: string }>).detail ?? {}
      const current = editorPlayingCueRef.current
      if (!id || (current?.id && current.id !== id)) return
      const cue = projectRef.current.cues.find((item) => item.id === id)
      if (!cue) return
      stopEditorAudioImmediately(cue)
    }

    const deleteCueFromEditor = (event: Event) => {
      const { id } = (event as CustomEvent<{ id?: string }>).detail ?? {}
      if (!id) return
      const cue = projectRef.current.cues.find((item) => item.id === id)
      if (!cue) return
      if (editorPlayingCueRef.current?.id === id) {
        stopEditorAudioImmediately(cue)
      }
      const cues = projectRef.current.cues.filter((item) => item.id !== id)
      setProject({ ...projectRef.current, cues })
      setSelectedCueId(cues.find((item) => item.filePath === cue.filePath)?.id ?? '')
      setStorageStatus(`Cue eliminato: ${cue.title || cue.src}`)
    }

    window.addEventListener('script-note-update', updateNoteFromEditor)
    window.addEventListener('script-note-delete', deleteNoteFromEditor)
    window.addEventListener('script-cue-toggle', toggleCueFromEditor)
    window.addEventListener('script-cue-stop', stopCueFromEditor)
    window.addEventListener('script-cue-delete', deleteCueFromEditor)

    return () => {
      window.removeEventListener('script-note-update', updateNoteFromEditor)
      window.removeEventListener('script-note-delete', deleteNoteFromEditor)
      window.removeEventListener('script-cue-toggle', toggleCueFromEditor)
      window.removeEventListener('script-cue-stop', stopCueFromEditor)
      window.removeEventListener('script-cue-delete', deleteCueFromEditor)
      clearAudioTimers(editorAudioTimersRef)
    }
  }, [])

  useEffect(() => {
    if (!noteMenuOpen && !exportMenuOpen && !appMenuOpen) return

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (noteMenuOpen && !noteMenuRef.current?.contains(event.target as Node)) {
        setNoteMenuOpen(false)
        setNoteMenuPosition(undefined)
      }
      if (exportMenuOpen && !exportMenuRef.current?.contains(event.target as Node)) {
        setExportMenuOpen(false)
        setExportMenuPosition(undefined)
      }
      if (appMenuOpen && !appMenuRef.current?.contains(event.target as Node)) {
        setAppMenuOpen(false)
        setAppMenuPosition(undefined)
      }
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNoteMenuOpen(false)
        setNoteMenuPosition(undefined)
        setExportMenuOpen(false)
        setExportMenuPosition(undefined)
        setAppMenuOpen(false)
        setAppMenuPosition(undefined)
      }
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [appMenuOpen, exportMenuOpen, noteMenuOpen])

  useEffect(() => {
    let cancelled = false

    const initializeProjectStorage = async () => {
      try {
        const path = await storage.projectFolderPath()
        if (!cancelled) {
          setStorageStatus(path ? `Cartella progetto: ${compactPath(path)}` : 'Nessuna cartella progetto aperta')
        }
      } catch (error) {
        if (!cancelled) setStorageStatus(`Storage progetto non disponibile: ${String(error)}`)
      } finally {
        if (!cancelled) setDesktopStorageReady(true)
      }
    }

    void initializeProjectStorage()

    return () => {
      cancelled = true
    }
  }, [])

  const editor = useEditor({
    extensions: [StarterKit, linkExtension, tableExtensions, ScriptNote, ScriptChip],
    content: markdownToHtml(activeMarkdown),
    onCreate({ editor: currentEditor }) {
      syncToolbarState(currentEditor, setToolbarState)
      syncOutlineState(currentEditor, setActiveOutline, setActiveOutlineId)
      syncBookmarkState(currentEditor, setActiveBookmarks, setActiveBookmarkId)
      syncEditorSceneState(currentEditor, setActiveEditorSceneId)
      syncEditorCueRefs(currentEditor, setEditorCueRefIds)
    },
    onSelectionUpdate({ editor: currentEditor }) {
      lastEditorSelectionRef.current = currentEditor.state.selection.from
      syncToolbarState(currentEditor, setToolbarState)
      syncOutlineState(currentEditor, setActiveOutline, setActiveOutlineId)
      syncBookmarkState(currentEditor, setActiveBookmarks, setActiveBookmarkId)
      syncEditorSceneState(currentEditor, setActiveEditorSceneId)
      syncEditorCueRefs(currentEditor, setEditorCueRefIds)
    },
    onTransaction({ editor: currentEditor }) {
      syncToolbarState(currentEditor, setToolbarState)
      syncOutlineState(currentEditor, setActiveOutline, setActiveOutlineId)
      syncBookmarkState(currentEditor, setActiveBookmarks, setActiveBookmarkId)
      syncEditorSceneState(currentEditor, setActiveEditorSceneId)
      syncEditorCueRefs(currentEditor, setEditorCueRefIds)
    },
    editorProps: {
      attributes: {
        class: 'script-editor',
        'aria-label': 'Editor WYSIWYG del copione',
      },
      handlePaste(view, event) {
        const markdown = event.clipboardData?.getData('text/plain') ?? ''
        if (!markdown || !hasMarkdownTable(markdown)) return false

        event.preventDefault()
        insertMarkdownAtSelection(view, markdown)
        return true
      },
      handleKeyDown(view, event) {
        if (event.key === 'Enter' && !event.shiftKey && convertMarkdownTableAroundSelection(view)) {
          event.preventDefault()
          return true
        }

        if (event.key !== 'Backspace' && event.key !== 'Delete') return false

        const selection = view.state.selection
        const selectedNode = 'node' in selection ? (selection.node as EditorKeyboardNode) : undefined
        const adjacentNode = event.key === 'Backspace' ? selection.$from.nodeBefore : selection.$from.nodeAfter
        const cueNode = [selectedNode, adjacentNode as EditorKeyboardNode | undefined].find(
          (node) => node?.type?.name === 'scriptChip' && node.attrs?.kind === 'cue',
        )
        if (cueNode) {
          window.dispatchEvent(new CustomEvent('script-cue-delete', { detail: { id: String(cueNode.attrs?.refId ?? '') } }))
          return false
        }

        return false
      },
      handleDrop(view, event) {
        const dataTransfer = event.dataTransfer
        if (!dataTransfer) return false

        const dropPosition = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
        if (dropPosition === undefined) return false

        const noteId = readDragPayload(dataTransfer, NOTE_ID_DND_TYPE, NOTE_ID_DND_PREFIX)
        if (noteId) {
          const note = projectRef.current.notes.find((item) => item.id === noteId && item.filePath === activeFilePathRef.current)
          const match = nodeMatchByRef(view.state.doc, 'scriptNote', noteId)
          if (!note || !match) return false
          if (dropPosition >= match.position && dropPosition <= match.position + match.nodeSize) return true

          event.preventDefault()
          const insertPosition = match.position < dropPosition ? dropPosition - match.nodeSize : dropPosition
          const transaction = view.state.tr
            .delete(match.position, match.position + match.nodeSize)
            .insert(Math.max(0, insertPosition), match.node)
          view.dispatch(transaction.scrollIntoView())
          setSelectedNoteId(note.id)
          showStatus(`Nota spostata: ${note.title}`)
          return true
        }

        const cueId = readDragPayload(dataTransfer, CUE_ID_DND_TYPE, CUE_ID_DND_PREFIX)
        if (cueId) {
          const cue = projectRef.current.cues.find((item) => item.id === cueId && item.filePath === activeFilePathRef.current)
          if (!cue) return false
          event.preventDefault()
          cueDropActionsRef.current.insertExistingCue(cue, dropPosition)
          setSelectedCueId(cue.id)
          showStatus(`Cue spostato: ${cue.title || cue.src}`)
          return true
        }

        const mediaPath = readDragPayload(dataTransfer, MEDIA_PATH_DND_TYPE, MEDIA_PATH_DND_PREFIX)
        if (mediaPath) {
          const asset = findTreeNode(projectRef.current.media, mediaPath)
          if (!asset || asset.kind === 'folder') return false
          event.preventDefault()
          cueDropActionsRef.current.createCueFromAsset(asset, dropPosition)
          return true
        }

        return false
      },
      handleClick(_view, pos, event) {
        const link = linkFromClickTarget(event.target)
        if (link) {
          event.preventDefault()
          void openExternalLink(link).catch((error: Error) => {
            showStatus(`Apertura collegamento non riuscita: ${error.message}`)
          })
          return true
        }
        lastEditorSelectionRef.current = pos
        return false
      },
      handleClickOn(view, pos, node) {
        if (node.type.name !== 'scriptChip') return false

        const kind = String(node.attrs.kind)
        const refId = String(node.attrs.refId ?? '')
        const index = chipIndexBeforePosition(view.state.doc, pos, kind)
        if (kind === 'cue') {
          const cue = chipInspectorRef.current.cues.find((item) => item.id === refId) ?? chipInspectorRef.current.cues[index]
          if (cue) {
            setSelectedCueId(cue.id)
          }
          return false
        }

        const note = chipInspectorRef.current.notes.find((item) => item.id === refId) ?? chipInspectorRef.current.notes[index]
        if (note) {
          setSelectedNoteId(note.id)
          setSelectedNoteTypeId(note.type)
        }

        return false
      },
    },
    immediatelyRender: false,
  })
  const editorEditingDisabled = !editor || Boolean(activeAppDocument)
  const activeDocumentTitle = activeFile?.name ?? activeAppDocument?.title

  const draftsWithCurrentEditorContent = useCallback(() => {
    const currentDrafts = { ...draftsRef.current }
    if (editor && activeFilePathRef.current && !activeAppDocument) {
      currentDrafts[activeFilePathRef.current] = editorJsonToMarkdown(editor.getJSON())
    }
    return currentDrafts
  }, [activeAppDocument, editor])

  const persistDraftsNow = useCallback(async () => {
    const currentDrafts = draftsWithCurrentEditorContent()
    if (Object.keys(currentDrafts).length === 0) return projectRef.current

    const nextProject = applyDraftsToProject(projectRef.current, currentDrafts)
    projectRef.current = nextProject
    projectScriptsRef.current = nextProject.scripts
    setProject(nextProject)
    setDrafts({})
    storage.save(nextProject)

    if (desktopStorageReady) {
      try {
        const path = await storage.saveProjectFolder(nextProject)
        if (path) setStorageStatus(`Cartella progetto salvata: ${compactPath(path)}`)
      } catch (error) {
        setStorageStatus(`Salvataggio progetto non riuscito: ${String(error)}`)
      }
    }

    return nextProject
  }, [desktopStorageReady, draftsWithCurrentEditorContent])

  const setCurrentBlockAsParagraph = () => {
    if (!editor) return
    const position = lastEditorSelectionRef.current
    const chain = editor.chain()
    if (position !== undefined) {
      chain.focus(position).clearNodes().setParagraph().run()
      return
    }
    chain.focus().clearNodes().setParagraph().run()
  }

  const focusOutlineItem = (item: OutlineItem) => {
    if (!editor || item.position === undefined) return
    const position = item.position + 1
    setActiveOutlineId(item.id)
    editor.chain().focus(position).setTextSelection(position).scrollIntoView().run()
  }

  const focusBookmarkItem = (item: BookmarkItem) => {
    if (!editor || item.position === undefined) return
    setActiveBookmarkId(item.id)
    editor.chain().focus().setNodeSelection(item.position).scrollIntoView().run()
  }

  useEffect(() => {
    if (!editor) return

    const syncAfterEditorEvent = () => {
      window.requestAnimationFrame(() => {
        syncToolbarState(editor, setToolbarState)
        syncOutlineState(editor, setActiveOutline, setActiveOutlineId)
        syncBookmarkState(editor, setActiveBookmarks, setActiveBookmarkId)
        syncEditorSceneState(editor, setActiveEditorSceneId)
      })
    }

    const editorElement = editor.view.dom
    editorElement.addEventListener('click', syncAfterEditorEvent)
    editorElement.addEventListener('mouseup', syncAfterEditorEvent)
    editorElement.addEventListener('keyup', syncAfterEditorEvent)
    editorElement.addEventListener('focus', syncAfterEditorEvent)

    return () => {
      editorElement.removeEventListener('click', syncAfterEditorEvent)
      editorElement.removeEventListener('mouseup', syncAfterEditorEvent)
      editorElement.removeEventListener('keyup', syncAfterEditorEvent)
      editorElement.removeEventListener('focus', syncAfterEditorEvent)
    }
  }, [editor])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!activeAppDocument)
  }, [activeAppDocument, editor])

  useEffect(() => {
    if (!editor) return

    if (activeAppDocument) {
      editor.commands.setContent(markdownToHtml(activeAppDocumentMarkdown), { emitUpdate: false })
      syncToolbarState(editor, setToolbarState)
      syncOutlineState(editor, setActiveOutline, setActiveOutlineId)
      syncBookmarkState(editor, setActiveBookmarks, setActiveBookmarkId)
      syncEditorCueRefs(editor, setEditorCueRefIds)
      return
    }

    if (!activeFilePath) {
      editor.commands.setContent('', { emitUpdate: false })
      setActiveOutline([])
      setActiveOutlineId('')
      setActiveBookmarks([])
      setActiveBookmarkId('')
      setEditorCueRefIds([])
      return
    }

    const content =
      draftsRef.current[activeFilePath] ??
      findMarkdownNode(projectScriptsRef.current, activeFilePath)?.content ??
      ''
    editor.commands.setContent(markdownToHtml(content), { emitUpdate: false })
    syncToolbarState(editor, setToolbarState)
    syncOutlineState(editor, setActiveOutline, setActiveOutlineId)
    syncBookmarkState(editor, setActiveBookmarks, setActiveBookmarkId)
    syncEditorCueRefs(editor, setEditorCueRefIds)
  }, [activeAppDocument, activeAppDocumentMarkdown, activeFilePath, editor, project.id])

  useEffect(() => {
    if (!editor || !activeFilePath) return

    const markActiveFileDirty = () => {
      const draft = editorJsonToMarkdown(editor.getJSON())
      const cueIds = markerRefIdsFromMarkdown(draft, 'cue')
      const noteIds = markerRefIdsFromMarkdown(draft, 'note')
      setDrafts((current) => (current[activeFilePath] === draft ? current : { ...current, [activeFilePath]: draft }))
      setProject((current) => {
        const cues = current.cues.filter((cue) => cue.filePath !== activeFilePath || cueIds.includes(cue.id))
        const notes = current.notes.filter((note) => note.filePath !== activeFilePath || noteIds.includes(note.id))
        const activeNode = findMarkdownNode(current.scripts, activeFilePath)
        const scripts = activeNode?.dirty
          ? current.scripts
          : updateTreeNode(current.scripts, activeFilePath, (node) => ({ ...node, dirty: true }))
        const unchanged =
          cues.length === current.cues.length &&
          notes.length === current.notes.length &&
          scripts === current.scripts
        return unchanged ? current : { ...current, cues, notes, scripts }
      })
    }

    editor.on('update', markActiveFileDirty)
    return () => {
      editor.off('update', markActiveFileDirty)
    }
  }, [activeFilePath, editor])

  useEffect(() => {
    if (!project.settings.autosave) return
    const projectToSave = applyDraftsToProject(project, drafts)
    storage.save(projectToSave)
    if (!desktopStorageReady) return
    storage.saveProjectFolder(projectToSave)
      .then((path) => {
        if (path) setStorageStatus(`Cartella progetto salvata: ${compactPath(path)}`)
      })
      .catch((error) => setStorageStatus(`Salvataggio progetto non riuscito: ${String(error)}`))
  }, [desktopStorageReady, drafts, project])

  useEffect(() => {
    if (!project.settings.autosave) return

    const flushDrafts = () => {
      void persistDraftsNow()
    }

    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') flushDrafts()
    }

    window.addEventListener('blur', flushDrafts)
    window.addEventListener('pagehide', flushDrafts)
    window.addEventListener('beforeunload', flushDrafts)
    document.addEventListener('visibilitychange', flushWhenHidden)
    return () => {
      window.removeEventListener('blur', flushDrafts)
      window.removeEventListener('pagehide', flushDrafts)
      window.removeEventListener('beforeunload', flushDrafts)
      document.removeEventListener('visibilitychange', flushWhenHidden)
    }
  }, [persistDraftsNow, project.settings.autosave])

  useEffect(() => {
    if (!project.settings.autosave) return
    const entries = Object.entries(drafts)
    if (entries.length === 0) return

    const timeout = window.setTimeout(() => {
      setProject((current) => {
        const nextProject = applyDraftsToProject(current, Object.fromEntries(entries))
        storage.save(nextProject)
        storage.saveProjectFolder(nextProject)
          .then((path) => {
            if (path) setStorageStatus(`Cartella progetto salvata: ${compactPath(path)}`)
          })
          .catch((error) => setStorageStatus(`Salvataggio progetto non riuscito: ${String(error)}`))
        return nextProject
      })

      setDrafts((current) => {
        let nextDrafts = current
        for (const [path, draft] of entries) {
          if (nextDrafts[path] === draft) nextDrafts = removeDraftPath(nextDrafts, path)
        }
        return nextDrafts
      })
    }, 700)

    return () => window.clearTimeout(timeout)
  }, [drafts, project.settings.autosave])

  const checkForAppUpdates = useCallback(async (silent = false) => {
    if (!isTauriRuntime()) {
      if (!silent) showStatus('Aggiornamenti disponibili solo nella versione desktop')
      return
    }
    if (updateInstallInProgressRef.current) {
      if (!silent) showStatus('Aggiornamento già in corso...', 0)
      return
    }

    let installStarted = false
    let updateVersion = ''
    try {
      if (!silent) showStatus('Controllo aggiornamenti in corso...')
      const [{ check }, { relaunch }] = await Promise.all([
        import('@tauri-apps/plugin-updater'),
        import('@tauri-apps/plugin-process'),
      ])
      const update = await check()

      if (!update) {
        if (!silent) showStatus('StageDesk Pro è aggiornato')
        return
      }

      updateVersion = update.version
      updateInstallInProgressRef.current = true
      installStarted = true
      showStatus(`Aggiornamento ${update.version} disponibile. Preparazione installazione...`, 0)
      await persistDraftsNow()

      let downloaded = 0
      let contentLength = 0
      await update.download((event) => {
        if (event.event === 'Started') {
          contentLength = event.data.contentLength ?? 0
          showStatus(`Download aggiornamento ${update.version} avviato`, 0)
        }
        if (event.event === 'Progress') {
          downloaded += event.data.chunkLength
          const percent = contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : undefined
          showStatus(percent ? `Download aggiornamento ${percent}%` : 'Download aggiornamento in corso...', 0)
        }
        if (event.event === 'Finished') {
          showStatus('Download completato. Installazione aggiornamento in corso...', 0)
        }
      })
      await update.install()
      showStatus('Aggiornamento installato, riavvio in corso...', 0)
      window.localStorage.setItem(INSTALLED_UPDATE_VERSION_KEY, update.version)
      await relaunch()
    } catch (error) {
      const message = updateInstallErrorMessage(error)
      if (installStarted) {
        showStatus(`Aggiornamento ${updateVersion || ''} non installato: ${message}`, 16000)
        alert(`Aggiornamento non installato.\n\n${message}`)
      } else if (!silent) {
        showStatus(`Controllo aggiornamenti non riuscito: ${message}`)
      }
    } finally {
      if (installStarted) updateInstallInProgressRef.current = false
    }
  }, [persistDraftsNow, showStatus])

  useEffect(() => {
    if (updateCheckStartedRef.current || !isTauriRuntime()) return
    updateCheckStartedRef.current = true
    const timeout = window.setTimeout(() => {
      void checkForAppUpdates(true)
    }, 1200)
    return () => window.clearTimeout(timeout)
  }, [checkForAppUpdates])

  const persistProject = (nextProject: typeof project) => {
    setProject(nextProject)
    storage.save(nextProject)
    if (!desktopStorageReady) return
    storage.saveProjectFolder(nextProject)
      .then((path) => {
        if (path) setStorageStatus(`Cartella progetto salvata: ${compactPath(path)}`)
      })
      .catch((error) => setStorageStatus(`Salvataggio progetto non riuscito: ${String(error)}`))
  }

  const activateProject = (nextProject: typeof project) => {
    nextProject = normalizeProject(nextProject)
    const nextPath = flattenMarkdownFiles(nextProject.scripts)[0]?.path ?? ''
    setProject(nextProject)
    setDrafts({})
    setActivePath(nextPath)
    setOpenTabs(nextPath ? [nextPath] : [])
    setSelectedScriptPath(nextPath || '/copione')
    setSelectedMediaPath(nextProject.media[0]?.path ?? '/media')
    setExpandedPaths(['/copione', '/media', ...nextProject.media.map((asset) => asset.path)])
    setSelectedNoteId(nextProject.notes[0]?.id ?? '')
    setSelectedNoteTypeId(defaultNoteType(nextProject.noteTypes)?.id ?? '')
    setSelectedCueId(nextProject.cues[0]?.id ?? '')
    setSearch('')
    setFullscreenIndex(0)
    setExecutedCueIds([])
  }

  const scriptPathHasUnsavedChanges = (path: string) =>
    markdownFiles.some((file) => isPathInside(file.path, path) && file.dirty) ||
    Object.keys(drafts).some((draftPath) => isPathInside(draftPath, path))

  const projectHasUnsavedChanges = () =>
    markdownFiles.some((file) => file.dirty) || Object.keys(drafts).length > 0

  const discardUnsavedPath = (path: string) => {
    persistProject({ ...project, scripts: clearDirtyPath(project.scripts, path) })
    setDrafts((current) => removeDraftPath(current, path))
  }

  const showNewProjectDialog = () => {
    setScriptDialog({
      kind: 'new-project',
      title: 'Nuovo progetto',
      label: 'Nome progetto',
      value: 'La locandiera',
      message: projectHasUnsavedChanges()
        ? 'Le modifiche non salvate saranno perse. Il nuovo progetto includerà un file di esempio con note e cue dimostrativi.'
        : 'Il nuovo progetto includerà un file di esempio con note e cue dimostrativi.',
      confirmLabel: 'Crea progetto',
    })
  }

  const resetProject = () => {
    if (!storage.requiresDirectFolderPicker()) {
      showNewProjectDialog()
      return
    }

    storage.prepareProjectFolderCreation()
      .then((prepared) => {
        if (!prepared) {
          setStorageStatus('Creazione progetto annullata')
          return
        }

        showNewProjectDialog()
      })
      .catch((error) => setStorageStatus(`Creazione progetto non riuscita: ${String(error)}`))
  }

  const createProjectWithName = (name: string) => {
    const nextProject = blankProject(name)
    storage.createProjectFolder(nextProject)
      .then((path) => {
        if (!path) {
          setStorageStatus('Creazione progetto annullata')
          return
        }

        const projectInFolder = { ...nextProject, rootPath: path }
        activateProject(projectInFolder)
        persistProject(projectInFolder)
        setStorageStatus(`Cartella progetto creata: ${compactPath(path)}`)
      })
      .catch((error) => setStorageStatus(`Creazione progetto non riuscita: ${String(error)}`))
  }

  const openProjectFile = () => {
    if (storage.requiresDirectFolderPicker()) {
      void openProjectFolder()
      return
    }

    storage.listProjectFolders()
      .then((entries) => {
        if (entries.length > 0) {
          setProjectPickerEntries(entries)
          return
        }

        return openProjectFolder()
      })
      .catch((error) => setStorageStatus(`Apertura progetto non riuscita: ${String(error)}`))
  }

  const openProjectFolder = (path?: string) =>
    storage.openProjectFolder(path)
      .then((opened) => {
        if (!opened) {
          setStorageStatus('Apertura progetto annullata')
          return
        }

        if (!isProject(opened.project)) {
          setStorageStatus('Cartella progetto non valida')
          return
        }

        activateProject(opened.project)
        persistProject(opened.project)
        setStorageStatus(`Cartella progetto aperta: ${compactPath(opened.path)}`)
      })
      .catch((error) => setStorageStatus(`Apertura progetto non riuscita: ${String(error)}`))

  const openMarkdownTab = (path: string) => {
    setOpenTabs((current) => (current.includes(path) ? current : [...current, path]))
    setActivePath(path)
    setSelectedScriptPath(path)
  }

  const openAppDocumentTab = (path: string) => {
    if (!isAppDocumentPath(path)) return
    setOpenTabs((current) => (current.includes(path) ? current : [...current, path]))
    setActivePath(path)
  }

  const closeMarkdownTab = (path: string) => {
    const tabFile = findMarkdownNode(project.scripts, path)
    if (
      scriptPathHasUnsavedChanges(path) &&
      !confirm(`Chiudere ${tabFile?.name ?? path} senza salvare le modifiche?`)
    ) {
      return
    }

    if (scriptPathHasUnsavedChanges(path)) discardUnsavedPath(path)

    setOpenTabs((current) => {
      const nextTabs = current.filter((item) => item !== path)
      if (activePath === path) {
        const closedIndex = current.indexOf(path)
        const fallbackPath = nextTabs[Math.max(0, closedIndex - 1)] ?? nextTabs[0] ?? ''
        setActivePath(fallbackPath)
        if (fallbackPath && !isAppDocumentPath(fallbackPath)) setSelectedScriptPath(fallbackPath)
      }
      return nextTabs
    })
  }

  const buildActiveExtendedMarkdown = () => {
    if (!editor || !activeFile) return
    const editorText = editorJsonToMarkdown(editor.getJSON())
    return serializeExtendedMarkdown(
      editorText,
      project.notes.filter((note) => note.filePath === activeFile.path),
      project.cues.filter((cue) => cue.filePath === activeFile.path),
    )
  }

  const createFile = () => {
    setScriptDialog({
      kind: 'create-file',
      title: 'Nuovo file Markdown',
      label: 'Nome file',
      value: 'nuova-scena.md',
      confirmLabel: 'Crea file',
    })
  }

  const createFileWithName = (name: string) => {
    const safeName = name.endsWith('.md') ? name : `${name}.md`
    const folderPath = selectedScriptNode?.kind === 'folder' ? selectedScriptNode.path : parentPath(selectedScriptPath) || '/copione'
    const path = childPath(folderPath, safeName)
    const file: ProjectTreeNode = {
      id: crypto.randomUUID(),
      name: safeName,
      path,
      kind: 'markdown',
      content: `## NUOVA SCENA\n\nPERSONAGGIO\nNuova battuta.\n`,
      dirty: false,
    }
    const scripts = insertTreeChild(project.scripts, folderPath, file)
    persistProject({ ...project, scripts })
    openMarkdownTab(path)
    setSelectedScriptPath(path)
    expandPath(folderPath)
  }

  const createFolder = () => {
    setScriptDialog({
      kind: 'create-folder',
      title: 'Nuova cartella',
      label: 'Nome cartella',
      value: 'atto-2',
      confirmLabel: 'Crea cartella',
    })
  }

  const createFolderWithName = (name: string) => {
    const folderPath = selectedScriptNode?.kind === 'folder' ? selectedScriptNode.path : parentPath(selectedScriptPath) || '/copione'
    const folder: ProjectTreeNode = {
      id: crypto.randomUUID(),
      name,
      path: childPath(folderPath, name),
      kind: 'folder',
      children: [],
    }
    const scripts = insertTreeChild(project.scripts, folderPath, folder)
    persistProject({ ...project, scripts })
    setSelectedScriptPath(folder.path)
    expandPath(folderPath)
  }

  const renameSelectedScriptNode = () => {
    if (!selectedScriptNode || selectedScriptNode.path === '/copione') return
    setScriptDialog({
      kind: 'rename',
      title: 'Rinomina selezione',
      label: 'Nuovo nome',
      targetPath: selectedScriptNode.path,
      value: selectedScriptNode.name,
      confirmLabel: 'Rinomina',
    })
  }

  const renameScriptNodeWithName = (targetPath: string, name: string) => {
    const nodeToRename = findTreeNode(project.scripts, targetPath)
    if (!nodeToRename || nodeToRename.path === '/copione') return
    const nextPath = childPath(parentPath(nodeToRename.path) || '/copione', name)
    persistProject({
      ...project,
      scripts: updateTreeNode(project.scripts, nodeToRename.path, (node) =>
        renameTreeNode(node, name, nextPath),
      ),
    })
    setSelectedScriptPath(nextPath)
    if (activePath === nodeToRename.path || activePath.startsWith(`${nodeToRename.path}/`)) {
      setActivePath(activePath.replace(nodeToRename.path, nextPath))
    }
    setOpenTabs((current) =>
      current.map((path) =>
        path === nodeToRename.path || path.startsWith(`${nodeToRename.path}/`)
          ? path.replace(nodeToRename.path, nextPath)
          : path,
      ),
    )
    setDrafts((current) => renameDraftPaths(current, nodeToRename.path, nextPath))
  }

  const deleteSelectedScriptNode = () => {
    if (!selectedScriptNode || selectedScriptNode.path === '/copione') {
      return
    }

    const hasUnsavedChanges = scriptPathHasUnsavedChanges(selectedScriptNode.path)
    setScriptDialog({
      kind: 'delete',
      title: 'Elimina selezione',
      message: hasUnsavedChanges
        ? `Eliminare ${selectedScriptNode.name}? Le modifiche non salvate nella selezione saranno perse.`
        : `Eliminare ${selectedScriptNode.name}?`,
      targetPath: selectedScriptNode.path,
      confirmLabel: 'Elimina',
      danger: true,
    })
  }

  const deleteScriptNodeConfirmed = (targetPath: string) => {
    const nodeToDelete = findTreeNode(project.scripts, targetPath)
    if (!nodeToDelete || nodeToDelete.path === '/copione') {
      return
    }

    const scripts = removeTreeNode(project.scripts, nodeToDelete.path)
    const nextPath =
      activePath === nodeToDelete.path || activePath.startsWith(`${nodeToDelete.path}/`)
        ? flattenMarkdownFiles(scripts)[0]?.path ?? ''
        : activePath
    persistProject({ ...project, scripts })
    setActivePath(nextPath)
    setSelectedScriptPath(nextPath || '/copione')
    setOpenTabs((current) => {
      const nextTabs = current.filter((path) => path !== nodeToDelete.path && !path.startsWith(`${nodeToDelete.path}/`))
      return nextPath && !nextTabs.includes(nextPath) ? [nextPath, ...nextTabs] : nextTabs
    })
    setDrafts((current) => removeDraftPath(current, nodeToDelete.path))
  }

  const duplicateSelectedScriptNode = () => {
    if (!selectedScriptNode || selectedScriptNode.path === '/copione') return
    const parent = parentPath(selectedScriptNode.path) || '/copione'
    const copyName = duplicateName(selectedScriptNode.name)
    const copy = cloneTreeNode(selectedScriptNode, childPath(parent, copyName), copyName)
    const scripts = insertTreeChild(project.scripts, parent, copy)
    persistProject({ ...project, scripts })
    setSelectedScriptPath(copy.path)
    if (copy.kind === 'markdown') openMarkdownTab(copy.path)
    expandPath(parent)
  }

  const createMediaFolder = () => {
    setScriptDialog({
      kind: 'create-media-folder',
      title: 'Nuova cartella media',
      label: 'Nome cartella',
      value: 'nuova-cartella',
      confirmLabel: 'Crea cartella',
    })
  }

  const createMediaFolderWithName = (name: string) => {
    const folderPath =
      selectedMediaPath === '/media' || selectedMediaNode?.kind === 'folder'
        ? selectedMediaPath
        : parentPath(selectedMediaPath) || '/media'
    const folder: MediaAsset = {
      id: crypto.randomUUID(),
      name,
      path: childPath(folderPath, name),
      kind: 'folder',
      children: [],
    }
    persistProject({ ...project, media: insertTreeChild(project.media, folderPath, folder) })
    setSelectedMediaPath(folder.path)
    expandPath(folderPath)
  }

  const renameSelectedMediaNode = () => {
    if (!selectedMediaNode) return
    setScriptDialog({
      kind: 'rename-media',
      title: 'Rinomina media',
      label: 'Nuovo nome',
      targetPath: selectedMediaNode.path,
      value: selectedMediaNode.name,
      confirmLabel: 'Rinomina',
    })
  }

  const renameMediaNodeWithName = (targetPath: string, name: string) => {
    const nodeToRename = findTreeNode(project.media, targetPath)
    if (!nodeToRename) return

    const nextPath = childPath(parentPath(nodeToRename.path) || '/media', name)
    const media = updateTreeNode(project.media, nodeToRename.path, (node) => renameTreeNode(node, name, nextPath))
    const cues = project.cues.map((cue) => {
      if (!isPathInside(cue.src, nodeToRename.path)) return cue
      const nextSrc = cue.src.replace(nodeToRename.path, nextPath)
      return {
        ...cue,
        src: nextSrc,
        title: cue.title === nodeToRename.name ? name : cue.title,
        updatedAt: new Date().toISOString(),
      }
    })
    persistProject({ ...project, media, cues })
    setSelectedMediaPath(nextPath)
  }

  const deleteSelectedMediaNode = () => {
    if (!selectedMediaNode || isProtectedMediaRoot(selectedMediaNode)) return
    setScriptDialog({
      kind: 'delete-media',
      title: 'Elimina media',
      message: `Eliminare ${selectedMediaNode.name}? I cue collegati a questo elemento verranno rimossi.`,
      targetPath: selectedMediaNode.path,
      confirmLabel: 'Elimina',
      danger: true,
    })
  }

  const deleteMediaNodeConfirmed = (targetPath: string) => {
    const nodeToDelete = findTreeNode(project.media, targetPath)
    if (!nodeToDelete || isProtectedMediaRoot(nodeToDelete)) return

    const media = removeTreeNode(project.media, nodeToDelete.path)
    const cues = project.cues.filter((cue) => !isPathInside(cue.src, nodeToDelete.path))
    persistProject({ ...project, media, cues })
    setSelectedMediaPath(parentPath(nodeToDelete.path) || '/media')
    if (selectedCueId && !cues.some((cue) => cue.id === selectedCueId)) {
      setSelectedCueId(cues[0]?.id ?? '')
    }
  }

  const moveMediaNode = async (sourcePath: string, targetFolderPath: string) => {
    const sourceNode = findTreeNode(project.media, sourcePath)
    const targetFolder = targetFolderPath === '/media' ? undefined : findTreeNode(project.media, targetFolderPath)
    if (!sourceNode || sourceNode.kind === 'folder') return
    if (targetFolderPath !== '/media' && targetFolder?.kind !== 'folder') return
    if (parentPath(sourceNode.path) === targetFolderPath) return

    const nextPath = childPath(targetFolderPath, sourceNode.name)
    if (findTreeNode(project.media, nextPath)) {
      showStatus(`Spostamento non riuscito: ${sourceNode.name} esiste già nella cartella destinazione`)
      return
    }

    const movedNode = { ...sourceNode, path: nextPath }
    const media = insertTreeChild(removeTreeNode(project.media, sourceNode.path), targetFolderPath, movedNode)
    const cues = project.cues.map((cue) =>
      cue.src === sourceNode.path
        ? { ...cue, src: nextPath, updatedAt: new Date().toISOString() }
        : cue,
    )
    const nextProject = { ...project, media, cues }

    if (hasProjectStorageRoot(project.rootPath)) {
      try {
        await storage.moveMediaAsset(sourceNode.path, nextPath)
      } catch (error) {
        showStatus(`Spostamento non riuscito: ${String(error)}`)
        return
      }
    }

    persistProject(nextProject)
    setSelectedMediaPath(nextPath)
    setSelectedCueId((current) => cues.some((cue) => cue.id === current) ? current : cues[0]?.id ?? '')
    expandPath(targetFolderPath)
    showStatus(`Media spostato in ${targetFolder?.name ?? 'media'}: ${sourceNode.name}`)
  }

  const toggleExpanded = (path: string) => {
    setExpandedPaths((current) =>
      current.includes(path) ? current.filter((item) => item !== path) : [...current, path],
    )
  }

  const expandPath = (path: string) => {
    setExpandedPaths((current) => (current.includes(path) ? current : [...current, path]))
  }

  const insertNote = (noteType = selectedNoteType) => {
    if (!editor || !activeFile || !noteType) return
    const note: DirectorNote = {
      id: `note-${crypto.randomUUID().slice(0, 8)}`,
      type: noteType.id,
      color: noteType.color,
      title: 'Nuova nota',
      content: 'Inserire contenuto della nota di regia.',
      collapsed: false,
      filePath: activeFile.path,
      anchorId: crypto.randomUUID(),
      sceneId: currentScene,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'scriptNote',
        attrs: {
          type: note.type,
          color: note.color,
          title: noteChipLabel(note, project.noteTypes),
          content: note.content,
          refId: note.id,
          collapsed: false,
        },
      })
      .run()
    persistProject({ ...project, notes: [...project.notes, note] })
    setSelectedNoteId(note.id)
    setSelectedNoteTypeId(noteType.id)
  }

  const insertCharactersSection = () => {
    if (!editor || !activeFile) return
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'Personaggi' }],
        },
        {
          type: 'table',
          content: [
            charactersTableRow(['Personaggio', 'Attore', 'Presenza', 'Note'], true),
            charactersTableRow(['REGISTA', 'Mario Rossi', 'In scena', 'Apre la scena e guida il ritmo.']),
            charactersTableRow(['ATTORE', 'Laura Bianchi', 'In scena', 'Ingresso dopo il primo cue audio.']),
            charactersTableRow(['TECNICO', 'Gianni Verdi', 'Fuori scena', 'Intervento tecnico durante il cambio scena.']),
          ],
        },
        { type: 'paragraph' },
      ])
      .run()
  }

  const showBookmarkDialog = () => {
    if (!editor || !activeFile) return
    setScriptDialog({
      kind: 'bookmark',
      title: 'Nuovo bookmark',
      label: 'Nome bookmark',
      value: bookmarkTitleFromSelection(editor) || 'Bookmark',
      confirmLabel: 'Inserisci',
    })
  }

  const insertBookmarkWithTitle = (title: string) => {
    if (!editor || !activeFile) return
    const bookmarkId = `bookmark-${crypto.randomUUID().slice(0, 8)}`
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: 'scriptChip',
          attrs: {
            kind: 'bookmark',
            label: title,
            refId: bookmarkId,
            color: 'bookmark',
          },
        },
        { type: 'text', text: ' ' },
      ])
      .run()
    setActiveBookmarkId(bookmarkId)
    showStatus(`Bookmark inserito: ${title}`)
  }

  const deleteCurrentTableRow = () => {
    if (!editor || !editor.isActive('table')) {
      showStatus('Posiziona il cursore nella tabella personaggi')
      return
    }
    editor.chain().focus().deleteRow().run()
    showStatus('Riga tabella eliminata')
  }

  const deleteCurrentTable = () => {
    if (!editor || !editor.isActive('table')) {
      showStatus('Posiziona il cursore nella tabella personaggi')
      return
    }
    editor.chain().focus().deleteTable().run()
    showStatus('Tabella eliminata')
  }

  const selectCueFromInspector = (cue: MediaCue) => {
    setSelectedCueId(cue.id)
    focusScriptChip('cue', cue.id)
  }

  const focusScriptChip = (kind: 'note' | 'cue', id: string) => {
    if (!editor) return
    const items = kind === 'note' ? fileNotes : fileCues
    const itemIndex = items.findIndex((item) => item.id === id)
    if (itemIndex < 0) return

    const position =
      chipMatchByRef(editor.state.doc, kind, id)?.position ??
      (!chipKindHasRefs(editor.state.doc, kind) ? chipPositionByIndex(editor.state.doc, kind, itemIndex) : undefined)
    if (position === undefined) return
    editor.chain().focus().setNodeSelection(position).scrollIntoView().run()
  }

  const updateSelectedCue = (patch: Partial<MediaCue>) => {
    if (!visibleSelectedCue) return
    const nextCue = { ...visibleSelectedCue, ...patch, updatedAt: new Date().toISOString() }
    persistProject({
      ...project,
      cues: project.cues.map((cue) =>
        cue.id === visibleSelectedCue.id ? nextCue : cue,
      ),
    })
    if ('title' in patch || 'type' in patch || 'src' in patch) updateCueChip(nextCue)
  }

  const updateSelectedCueOptions = (patch: Partial<MediaCue['options']>) => {
    if (!visibleSelectedCue) return
    updateSelectedCue({ options: { ...visibleSelectedCue.options, ...patch } })
  }

  const updateCueChip = (cue: MediaCue) => {
    if (!editor) return
    const cueIndex = fileCues.findIndex((item) => item.id === cue.id)
    if (cueIndex < 0) return

    const target =
      chipMatchByRef(editor.state.doc, 'cue', cue.id) ??
      (!chipKindHasRefs(editor.state.doc, 'cue') ? chipMatchByIndex(editor.state.doc, 'cue', cueIndex) : undefined)
    if (!target) return
    editor.view.dispatch(editor.state.tr.setNodeMarkup(target.position, undefined, {
      ...target.attrs,
      label: cueChipLabel(cue),
      refId: cue.id,
      color: cue.type,
    }))
  }

  const removeCueChipFromEditor = (cue: MediaCue) => {
    if (!editor || cue.filePath !== activePath) return
    const cueIndex = fileCues.findIndex((item) => item.id === cue.id)
    if (cueIndex < 0) return

    const target =
      chipMatchByRef(editor.state.doc, 'cue', cue.id) ??
      (!chipKindHasRefs(editor.state.doc, 'cue') ? chipMatchByIndex(editor.state.doc, 'cue', cueIndex) : undefined)
    if (!target) return
    editor.view.dispatch(editor.state.tr.delete(target.position, target.position + target.nodeSize))
  }

  const stopEditorCueIfActive = (cueId: string) => {
    if (editorPlayingCueRef.current?.id !== cueId) return
    const cue = project.cues.find((item) => item.id === cueId)
    clearAudioTimers(editorAudioTimersRef)
    if (editorAudioRef.current) {
      editorAudioRef.current.onended = null
      editorAudioRef.current.pause()
      editorAudioRef.current.currentTime = cue?.options.startAt ?? 0
      if (cue) editorAudioRef.current.volume = cueTargetVolume(cue)
      editorAudioRef.current.removeAttribute('src')
      editorAudioRef.current.load()
    }
    editorPlayingCueRef.current = undefined
    window.dispatchEvent(new CustomEvent('script-cue-state', { detail: { id: cueId, state: 'stopped' } }))
  }

  const deleteSelectedCue = () => {
    if (!visibleSelectedCue || !confirm(`Eliminare il cue ${visibleSelectedCue.title || visibleSelectedCue.id}?`)) return
    removeCueChipFromEditor(visibleSelectedCue)
    stopEditorCueIfActive(visibleSelectedCue.id)
    const cues = project.cues.filter((cue) => cue.id !== visibleSelectedCue.id)
    persistProject({ ...project, cues })
    setSelectedCueId(cues.find((cue) => cue.filePath === activePath)?.id ?? cues[0]?.id ?? '')
    setStorageStatus(`Cue eliminato: ${visibleSelectedCue.title || visibleSelectedCue.src}`)
  }

  const importMedia = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    const folderPath =
      selectedMediaPath === '/media' || selectedMediaNode?.kind === 'folder'
        ? selectedMediaPath
        : parentPath(selectedMediaPath) || '/media'
    const assets: MediaAsset[] = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      path: childPath(folderPath, file.name),
      kind: mediaKind(file.type, file.name),
      size: file.size,
      objectUrl: URL.createObjectURL(file),
    }))
    persistProject({ ...project, media: insertTreeChildren(project.media, folderPath, assets) })
    if (assets[0]) setSelectedMediaPath(assets[0].path)
    expandPath(folderPath)
    event.target.value = ''
  }

  const insertCueChip = (cue: MediaCue, position?: number, removeExisting = false) => {
    if (!editor) return
    let insertPosition = position

    if (removeExisting) {
      const existing = chipMatchByRef(editor.state.doc, 'cue', cue.id)
      if (existing) {
        const transaction = editor.state.tr.delete(existing.position, existing.position + existing.nodeSize)
        editor.view.dispatch(transaction)
        if (insertPosition !== undefined && existing.position < insertPosition) {
          insertPosition = Math.max(0, insertPosition - existing.nodeSize)
        }
      }
    }

    const content = {
      type: 'paragraph',
      content: [{ type: 'scriptChip', attrs: { kind: 'cue', label: cueChipLabel(cue), refId: cue.id, color: cue.type } }],
    }
    const chain = editor.chain().focus()
    if (insertPosition !== undefined) {
      chain.insertContentAt(insertPosition, content).run()
      return
    }
    chain.insertContent(content).run()
  }

  const insertCue = (asset?: MediaAsset, position?: number) => {
    if (!editor || !activeFile) return
    const selectedAsset = asset ?? flattenTree(project.media).find((item) => item.kind === 'audio' || item.kind === 'music')
    const cueType = selectedAsset && selectedAsset.kind !== 'folder' ? selectedAsset.kind : 'audio'
    const sceneId = position !== undefined ? editorSceneIdAtPosition(editor.state.doc, position) : currentScene
    const cue: MediaCue = {
      id: `cue-${crypto.randomUUID().slice(0, 8)}`,
      type: cueType,
      src: selectedAsset?.path ?? 'media/musiche/blues-intro.mp3',
      title: selectedAsset?.name ?? 'Nuovo cue audio',
      description: '',
      autoplay: true,
      anchorId: crypto.randomUUID(),
      filePath: activeFile.path,
      sceneId,
      options: { volume: 70, fadeIn: 0, fadeOut: 0, loop: false },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    insertCueChip(cue, position)
    persistProject({ ...project, cues: [...project.cues, cue] })
    setSelectedCueId(cue.id)
    showStatus(`Cue inserito: ${cue.title || cue.src}`)
  }

  cueDropActionsRef.current = {
    insertExistingCue: (cue, position) => insertCueChip(cue, position, true),
    createCueFromAsset: (asset, position) => insertCue(asset, position),
  }

  const sceneCueIds = new Set(currentScene ? fileCues.filter((cue) => cue.sceneId === currentScene).map((cue) => cue.id) : [])
  const filteredCues = fileCues
    .filter((cue) => {
      if (noteMode === 'all') return true
      if (noteMode === 'scene') return currentScene ? cue.sceneId === currentScene : false
      if (!currentScene || sceneCueIds.size === 0) return true
      return sceneCueIds.has(cue.id)
    })
    .filter((cue) => (search ? `${cue.title} ${cue.src} ${cue.description}`.toLowerCase().includes(search.toLowerCase()) : true))

  useEffect(() => {
    if (filteredCues.length === 0 || filteredCues.some((cue) => cue.id === selectedCueId)) return
    setSelectedCueId(filteredCues[0].id)
  }, [filteredCues, selectedCueId])

  const visibleSelectedCue = filteredCues.find((cue) => cue.id === selectedCueId)
  const visibleSelectedCueAsset = visibleSelectedCue ? findTreeNode(project.media, visibleSelectedCue.src) : undefined
  const visibleSelectedCueAssetUrl = visibleSelectedCueAsset
    ? mediaAssetUrl(visibleSelectedCueAsset, project.rootPath)
    : undefined

  const exportActiveFile = async (mode: 'complete' | 'clean') => {
    try {
      const markdown = buildActiveExtendedMarkdown() ?? ''
      await persistDraftsNow()
      const baseName = stripMarkdownExtension(activeFile?.name ?? 'copione')
      const fileName = mode === 'clean' ? `${baseName}.pulito.pdf` : `${baseName}.completo.pdf`
      const title = mode === 'clean' ? `${baseName} - pulito` : `${baseName} - completo`
      const result = await downloadPdf(fileName, markdown, title, mode)
      showStatus(`Export completato: ${fileName}. Salvato in: ${result.location}`, 12000)
      setExportResult(result)
    } catch (error) {
      showStatus(`Export non riuscito: ${String(error)}`)
    }
  }

  const openExportResult = async () => {
    if (!exportResult) return
    await persistDraftsNow()
    if (exportResult.filePath && isTauriRuntime()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('open_path', { path: exportResult.filePath })
      } catch (error) {
        showStatus(`Apertura PDF non riuscita: ${String(error)}`)
      }
      return
    }
    if (exportResult.objectUrl) openObjectUrlInNewTab(exportResult.objectUrl)
  }

  const submitScriptDialog = () => {
    if (!scriptDialog) return

    if (scriptDialog.kind === 'delete') {
      if (scriptDialog.targetPath) deleteScriptNodeConfirmed(scriptDialog.targetPath)
      setScriptDialog(undefined)
      return
    }

    if (scriptDialog.kind === 'delete-media') {
      if (scriptDialog.targetPath) deleteMediaNodeConfirmed(scriptDialog.targetPath)
      setScriptDialog(undefined)
      return
    }

    const value = scriptDialog.value?.trim()
    if (!value) return

    if (scriptDialog.kind === 'create-file') createFileWithName(value)
    if (scriptDialog.kind === 'create-folder') createFolderWithName(value)
    if (scriptDialog.kind === 'rename' && scriptDialog.targetPath) renameScriptNodeWithName(scriptDialog.targetPath, value)
    if (scriptDialog.kind === 'new-project') createProjectWithName(value)
    if (scriptDialog.kind === 'create-media-folder') createMediaFolderWithName(value)
    if (scriptDialog.kind === 'rename-media' && scriptDialog.targetPath) renameMediaNodeWithName(scriptDialog.targetPath, value)
    if (scriptDialog.kind === 'bookmark') insertBookmarkWithTitle(value)
    setScriptDialog(undefined)
  }

  if (isFullscreen) {
    return (
      <FullscreenView
        block={currentBlock}
        index={fullscreenIndex}
        total={performanceBlocks.length}
        cues={project.cues.filter((cue) => cue.filePath === activePath)}
        media={project.media}
        projectRootPath={project.rootPath}
        executedCueIds={executedCueIds}
        onCueExecuted={(cueId) => setExecutedCueIds((current) => current.includes(cueId) ? current : [...current, cueId])}
        onClose={() => setFullscreen(false)}
        onNext={() => setFullscreenIndex((index) => Math.min(index + 1, performanceBlocks.length - 1))}
        onPrevious={() => setFullscreenIndex((index) => Math.max(index - 1, 0))}
        onHome={() => setFullscreenIndex(0)}
        onEnd={() => setFullscreenIndex(performanceBlocks.length - 1)}
      />
    )
  }

  return (
    <main className="app-shell" data-theme={project.settings.theme}>
      <header className="topbar">
        <div>
          <p className="eyebrow">StageDesk Pro</p>
          <h1>{project.name}</h1>
          <p className="storage-status">{storageStatus}</p>
        </div>
        <div className="topbar-actions">
          <button type="button" className="topbar-button" onClick={resetProject}>
            <FilePlus2 size={16} />
            Nuovo
          </button>
          <button type="button" className="topbar-button" onClick={openProjectFile}>
            <FolderOpen size={16} />
            Apri progetto
          </button>
          <button
            type="button"
            className="topbar-icon-button primary"
            title="Fullscreen"
            aria-label="Fullscreen"
            onClick={() => {
              setFullscreenIndex(fullscreenIndexAtEditorPosition(editor, performanceBlocks))
              setFullscreen(true)
            }}
          >
            <Play size={16} />
          </button>
          <div className="topbar-menu" ref={appMenuRef}>
            <button
              type="button"
              className="topbar-icon-button"
              title="Altro"
              aria-label="Altro"
              aria-haspopup="menu"
              aria-expanded={appMenuOpen}
              onClick={(event) => {
                if (appMenuOpen) {
                  setAppMenuOpen(false)
                  setAppMenuPosition(undefined)
                  return
                }

                const rect = event.currentTarget.getBoundingClientRect()
                setAppMenuPosition({
                  top: rect.bottom + 6,
                  left: Math.max(8, Math.min(rect.right - 224, window.innerWidth - 232)),
                })
                setAppMenuOpen(true)
              }}
            >
              <MoreVertical size={17} />
            </button>
            {appMenuOpen ? (
              <div className="toolbar-menu-popover topbar-popover floating" role="menu" style={appMenuPosition}>
                <div className="app-menu-user" title={userEmail}>
                  <span className="app-menu-user-label">Account</span>
                  <span className="app-menu-user-email">{userEmail}</span>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className={activePath === 'app://version-history' ? 'active' : ''}
                  onClick={() => {
                    setAppMenuOpen(false)
                    setAppMenuPosition(undefined)
                    openAppDocumentTab('app://version-history')
                  }}
                >
                  <History size={15} />
                  Novità
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={activePath === 'app://readme' ? 'active' : ''}
                  onClick={() => {
                    setAppMenuOpen(false)
                    setAppMenuPosition(undefined)
                    openAppDocumentTab('app://readme')
                  }}
                >
                  <FileText size={15} />
                  Aiuto
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="app-menu-logout"
                  onClick={() => {
                    setAppMenuOpen(false)
                    setAppMenuPosition(undefined)
                    void checkForAppUpdates(false)
                  }}
                >
                  <RefreshCw size={15} />
                  Aggiornamenti
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAppMenuOpen(false)
                    setAppMenuPosition(undefined)
                    void signOut()
                  }}
                >
                  <LogOut size={15} />
                  Esci
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <section className="workspace">
        <aside className="sidebar left-sidebar">
          <div className="panel-title"><PanelLeft size={17} />Struttura</div>
          <div className="segmented">
            <button
              type="button"
              className={leftTab === 'outline' ? 'active' : ''}
              title="Indice documento"
              aria-label="Indice documento"
              onClick={() => setLeftTab('outline')}
            >
              <ListTree size={16} />
              <span className="sr-only">Indice documento</span>
            </button>
            <button
              type="button"
              className={leftTab === 'script' ? 'active' : ''}
              title="Copioni"
              aria-label="Copioni"
              onClick={() => setLeftTab('script')}
            >
              <BookOpen size={16} />
              <span className="sr-only">Copioni</span>
            </button>
            <button
              type="button"
              className={leftTab === 'media' ? 'active' : ''}
              title="Media"
              aria-label="Media"
              onClick={() => setLeftTab('media')}
            >
              <Images size={16} />
              <span className="sr-only">Media</span>
            </button>
            <button
              type="button"
              className={leftTab === 'bookmarks' ? 'active' : ''}
              title="Bookmark"
              aria-label="Bookmark"
              onClick={() => setLeftTab('bookmarks')}
            >
              <Bookmark size={16} />
              <span className="sr-only">Bookmark</span>
            </button>
          </div>

          {leftTab === 'outline' ? (
            <DocumentOutlineTree
              items={activeOutline}
              activeItemId={activeOutlineId}
              activeFileName={activeDocumentTitle}
              onSelect={focusOutlineItem}
            />
          ) : null}

          {leftTab === 'script' ? (
            <>
              <div className="toolbar-row">
                <button type="button" title="Nuovo file" onClick={createFile}><FilePlus2 size={16} /></button>
                <button type="button" title="Nuova cartella" onClick={createFolder}><FolderPlus size={16} /></button>
                <button type="button" title="Duplica selezione" onClick={duplicateSelectedScriptNode}><Copy size={16} /></button>
                <button type="button" title="Rinomina selezione" onClick={renameSelectedScriptNode}><Pencil size={16} /></button>
                <button type="button" title="Elimina selezione" onClick={deleteSelectedScriptNode}><Trash2 size={16} /></button>
              </div>
              <ScriptExplorerTree
                nodes={project.scripts}
                activePath={activePath}
                selectedPath={selectedScriptPath}
                expandedPaths={expandedPaths}
                onOpen={openMarkdownTab}
                onSelect={setSelectedScriptPath}
                onToggle={toggleExpanded}
              />
            </>
          ) : null}

          {leftTab === 'media' ? (
            <>
              <div className="toolbar-row">
                <label className="toolbar-file-button" title="Importa media" aria-label="Importa media">
                  <Upload size={16} />
                  <input type="file" multiple accept="audio/*,image/*,video/*" onChange={importMedia} />
                </label>
                <button type="button" title="Nuova cartella media" onClick={createMediaFolder}><FolderPlus size={16} /></button>
                <button type="button" title="Rinomina selezione" onClick={renameSelectedMediaNode}><Pencil size={16} /></button>
                <button
                  type="button"
                  title={selectedMediaIsProtectedRoot ? 'Le cartelle root della raccolta non possono essere eliminate' : 'Elimina media selezionato'}
                  onClick={deleteSelectedMediaNode}
                  disabled={!selectedMediaNode || selectedMediaIsProtectedRoot}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div
                className="media-tree-drop-zone"
                onDragOver={(event) => {
                  if (!hasDragPayload(event.dataTransfer, MEDIA_PATH_DND_TYPE)) return
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                  event.currentTarget.classList.add('drop-target')
                }}
                onDragLeave={(event) => event.currentTarget.classList.remove('drop-target')}
                onDrop={(event) => {
                  const sourcePath = readDragPayload(event.dataTransfer, MEDIA_PATH_DND_TYPE, MEDIA_PATH_DND_PREFIX)
                  event.currentTarget.classList.remove('drop-target')
                  if (!sourcePath) return
                  event.preventDefault()
                  void moveMediaNode(sourcePath, '/media')
                }}
              >
                <MediaExplorerTree
                  assets={project.media}
                  selectedPath={selectedMediaPath}
                  expandedPaths={expandedPaths}
                  onSelect={setSelectedMediaPath}
                  onToggle={toggleExpanded}
                  onCue={insertCue}
                  onMove={(sourcePath, targetFolderPath) => void moveMediaNode(sourcePath, targetFolderPath)}
                />
              </div>
              {selectedMediaNode && selectedMediaNode.kind !== 'folder' ? (
                <MediaPreview asset={selectedMediaNode} projectRootPath={project.rootPath} onCue={insertCue} />
              ) : null}
            </>
          ) : null}

          {leftTab === 'bookmarks' ? (
            <BookmarkTree
              items={activeBookmarks}
              activeItemId={activeBookmarkId}
              activeFileName={activeDocumentTitle}
              onSelect={focusBookmarkItem}
            />
          ) : null}
        </aside>

        <section className="editor-column">
          <div className="file-tabbar">
            {openTabs.length > 0 ? (
              openTabs.map((path) => {
                const tabFile = findMarkdownNode(project.scripts, path)
                return (
                  <button
                    type="button"
                    key={path}
                    className={path === activePath ? fileTabClass(tabFile, true, isAppDocumentPath(path)) : fileTabClass(tabFile, false, isAppDocumentPath(path))}
                    onClick={() => {
                      setActivePath(path)
                      if (!isAppDocumentPath(path)) setSelectedScriptPath(path)
                    }}
                  >
                    <span className="file-tab-name">{tabFile?.name ?? getAppDocument(path)?.title ?? path.split('/').pop()}</span>
                    {tabFile?.dirty ? <span className="dirty-dot" aria-label="modificato" /> : null}
                    <span
                      role="button"
                      tabIndex={0}
                      className="file-tab-close"
                      aria-label={`Chiudi ${tabFile?.name ?? getAppDocument(path)?.title ?? path}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        closeMarkdownTab(path)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          event.stopPropagation()
                          closeMarkdownTab(path)
                        }
                      }}
                    >
                      <X size={13} />
                    </span>
                  </button>
                )
              })
            ) : (
              <button type="button" className="file-tab active">Nessun file</button>
            )}
          </div>
          <div className="editor-toolbar">
            <div className="toolbar-group" aria-label="Cronologia">
              <button type="button" title="Annulla" aria-label="Annulla" onClick={() => editor?.chain().focus().undo().run()} disabled={editorEditingDisabled}>
                <Undo2 size={15} />
              </button>
              <button type="button" title="Ripeti" aria-label="Ripeti" onClick={() => editor?.chain().focus().redo().run()} disabled={editorEditingDisabled}>
                <Redo2 size={15} />
              </button>
            </div>
            <span className="toolbar-divider" aria-hidden="true" />
            <div className="toolbar-group" aria-label="Formato testo">
              <button
                type="button"
                title="Grassetto"
                aria-label="Grassetto"
                className={toolbarState.bold ? 'active' : ''}
                onClick={() => editor?.chain().focus().toggleBold().run()}
                disabled={editorEditingDisabled}
              >
                <Bold size={15} />
              </button>
              <button
                type="button"
                title="Corsivo"
                aria-label="Corsivo"
                className={toolbarState.italic ? 'active' : ''}
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                disabled={editorEditingDisabled}
              >
                <Italic size={15} />
              </button>
              <button
                type="button"
                title="Pulisci formato"
                aria-label="Pulisci formato"
                onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}
                disabled={editorEditingDisabled}
              >
                <Eraser size={15} />
              </button>
            </div>
            <span className="toolbar-divider" aria-hidden="true" />
            <div className="toolbar-group" aria-label="Struttura">
              <button
                type="button"
                title="Testo normale"
                aria-label="Testo normale"
                className={toolbarState.paragraph ? 'active' : ''}
                onMouseDown={(event) => event.preventDefault()}
                onClick={setCurrentBlockAsParagraph}
                disabled={editorEditingDisabled}
              >
                <Type size={15} />
              </button>
              <button
                type="button"
                title="Titolo 1"
                aria-label="Titolo 1"
                className={toolbarState.heading1 ? 'active' : ''}
                onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                disabled={editorEditingDisabled}
              >
                <Heading1 size={15} />
              </button>
              <button
                type="button"
                title="Titolo 2"
                aria-label="Titolo 2"
                className={toolbarState.heading2 ? 'active' : ''}
                onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                disabled={editorEditingDisabled}
              >
                <Heading2 size={15} />
              </button>
              <button
                type="button"
                title="Titolo 3"
                aria-label="Titolo 3"
                className={toolbarState.heading3 ? 'active' : ''}
                onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                disabled={editorEditingDisabled}
              >
                <Heading3 size={15} />
              </button>
            </div>
            <span className="toolbar-divider" aria-hidden="true" />
            <div className="toolbar-group" aria-label="Blocchi">
              <button
                type="button"
                title="Elenco puntato"
                aria-label="Elenco puntato"
                className={toolbarState.bulletList ? 'active' : ''}
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                disabled={editorEditingDisabled}
              >
                <List size={15} />
              </button>
              <button
                type="button"
                title="Elenco numerato"
                aria-label="Elenco numerato"
                className={toolbarState.orderedList ? 'active' : ''}
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                disabled={editorEditingDisabled}
              >
                <ListOrdered size={15} />
              </button>
              <button
                type="button"
                title="Citazione"
                aria-label="Citazione"
                className={toolbarState.blockquote ? 'active' : ''}
                onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                disabled={editorEditingDisabled}
              >
                <Quote size={15} />
              </button>
              <button
                type="button"
                title="Separatore"
                aria-label="Separatore"
                onClick={() => editor?.chain().focus().setHorizontalRule().run()}
                disabled={editorEditingDisabled}
              >
                <Minus size={15} />
              </button>
              <button
                type="button"
                title="Bookmark"
                aria-label="Bookmark"
                onClick={showBookmarkDialog}
                disabled={editorEditingDisabled}
              >
                <Bookmark size={15} />
              </button>
            </div>
            <span className="toolbar-divider" aria-hidden="true" />
            <div className="toolbar-menu" ref={noteMenuRef}>
              <button
                type="button"
                className="toolbar-menu-trigger"
                title="Nota regia"
                aria-label="Nota regia"
                aria-haspopup="menu"
                aria-expanded={noteMenuOpen}
                disabled={editorEditingDisabled}
                onClick={(event) => {
                  if (noteMenuOpen) {
                    setNoteMenuOpen(false)
                    setNoteMenuPosition(undefined)
                    return
                  }

                  const rect = event.currentTarget.getBoundingClientRect()
                  setNoteMenuPosition({
                    top: rect.bottom + 4,
                    left: Math.max(8, Math.min(rect.left, window.innerWidth - 212)),
                  })
                  setNoteMenuOpen(true)
                }}
              >
                <span>Nota regia</span>
                <span className="toolbar-menu-value">{selectedNoteType?.label ?? 'Tipo'}</span>
                <ChevronDown size={14} />
              </button>
              {noteMenuOpen ? (
              <div className="toolbar-menu-popover floating" role="menu" style={noteMenuPosition}>
                {project.noteTypes.map((noteType) => (
                  <button
                    type="button"
                    role="menuitem"
                    key={noteType.id}
                    className={noteType.id === selectedNoteType?.id ? 'active' : ''}
                    onClick={() => {
                      setNoteMenuOpen(false)
                      setNoteMenuPosition(undefined)
                      insertNote(noteType)
                    }}
                  >
                    <span className={`note-dot ${noteType.color}`} />
                    {noteType.label}
                  </button>
                ))}
              </div>
              ) : null}
            </div>
            <button type="button" title="Personaggi" aria-label="Personaggi" onClick={insertCharactersSection} disabled={editorEditingDisabled}>
              <User size={16} />
            </button>
            <button
              type="button"
              title="Elimina riga tabella"
              aria-label="Elimina riga tabella"
              className={toolbarState.table ? 'active' : ''}
              onClick={deleteCurrentTableRow}
              disabled={editorEditingDisabled}
            >
              <PanelTopClose size={15} />
            </button>
            <button
              type="button"
              title="Elimina tabella"
              aria-label="Elimina tabella"
              className={toolbarState.table ? 'active' : ''}
              onClick={deleteCurrentTable}
              disabled={editorEditingDisabled}
            >
              <Grid2X2X size={15} />
            </button>
            <span className="toolbar-divider" aria-hidden="true" />
            <div className="toolbar-menu" ref={exportMenuRef}>
              <button
                type="button"
                className="toolbar-menu-trigger icon-only"
                title="Export"
                aria-label="Export"
                aria-haspopup="menu"
                aria-expanded={exportMenuOpen}
                disabled={!activeFile}
                onClick={(event) => {
                  if (exportMenuOpen) {
                    setExportMenuOpen(false)
                    setExportMenuPosition(undefined)
                    return
                  }

                  const rect = event.currentTarget.getBoundingClientRect()
                  setExportMenuPosition({
                    top: rect.bottom + 4,
                    left: Math.max(8, Math.min(rect.left, window.innerWidth - 124)),
                  })
                  setExportMenuOpen(true)
                }}
              >
                <Download size={15} />
              </button>
              {exportMenuOpen ? (
                <div className="toolbar-menu-popover compact floating" role="menu" style={exportMenuPosition}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setExportMenuOpen(false)
                      setExportMenuPosition(undefined)
                      void exportActiveFile('complete')
                    }}
                  >
                    Completo
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setExportMenuOpen(false)
                      setExportMenuPosition(undefined)
                      void exportActiveFile('clean')
                    }}
                  >
                    Pulito
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          <div className="editor-scroll-area">
            <EditorContent editor={editor} />
          </div>
          <audio ref={editorAudioRef} className="sr-only" />
        </section>

        <aside className="sidebar right-sidebar">
          <div className="panel-title"><PanelRight size={17} />Cue</div>
          <div className="segmented">
            <button type="button" className={noteMode === 'context' ? 'active' : ''} onClick={() => setNoteMode('context')}>Contestuale</button>
            <button type="button" className={noteMode === 'scene' ? 'active' : ''} onClick={() => setNoteMode('scene')}>Scena</button>
            <button type="button" className={noteMode === 'all' ? 'active' : ''} onClick={() => setNoteMode('all')}>Tutte</button>
          </div>
          <label className="search-field">
            <Search size={15} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca cue" />
          </label>
          <div className="note-list">
            {filteredCues.map((cue) => (
              <button
                type="button"
                key={cue.id}
                draggable
                title="Trascina nell'editor o clicca per selezionare"
                className={cue.id === selectedCueId ? 'note-card active' : 'note-card'}
                onDragStart={(event: ReactDragEvent<HTMLButtonElement>) => {
                  event.dataTransfer.effectAllowed = 'move'
                  writeDragPayload(event.dataTransfer, CUE_ID_DND_TYPE, CUE_ID_DND_PREFIX, cue.id)
                }}
                onClick={() => selectCueFromInspector(cue)}
              >
                <span className="note-dot blue" />
                <strong>{cue.title || cue.src.split('/').pop()}</strong>
                <span>{cue.autoplay ? 'Autoplay' : 'Manuale'} · {cue.src}</span>
              </button>
            ))}
          </div>

          {visibleSelectedCue ? (
            <section className="note-editor cue-editor">
              <label>
                Titolo
                <input value={visibleSelectedCue.title ?? ''} onChange={(event) => updateSelectedCue({ title: event.target.value })} />
              </label>
              <label>
                Descrizione
                <textarea value={visibleSelectedCue.description ?? ''} rows={4} onChange={(event) => updateSelectedCue({ description: event.target.value })} />
              </label>
              <label>
                File
                <input value={visibleSelectedCue.src} onChange={(event) => updateSelectedCue({ src: event.target.value })} />
              </label>
              <div className="form-grid">
                <label>
                  Volume
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={visibleSelectedCue.options.volume ?? 70}
                    onChange={(event) => updateSelectedCueOptions({ volume: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Fade in (sec)
                  <input
                    type="number"
                    min="0"
                    max="30"
                    step="0.5"
                    value={visibleSelectedCue.options.fadeIn ?? 0}
                    onChange={(event) => updateSelectedCueOptions({ fadeIn: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Fade out (sec)
                  <input
                    type="number"
                    min="0"
                    max="30"
                    step="0.5"
                    value={visibleSelectedCue.options.fadeOut ?? 0}
                    onChange={(event) => updateSelectedCueOptions({ fadeOut: Number(event.target.value) })}
                  />
                </label>
              </div>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={visibleSelectedCue.autoplay}
                  onChange={(event) => updateSelectedCue({ autoplay: event.target.checked })}
                />
                Autoplay in fullscreen
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={Boolean(visibleSelectedCue.options.loop)}
                  onChange={(event) => updateSelectedCueOptions({ loop: event.target.checked })}
                />
                Loop
              </label>
              {visibleSelectedCueAssetUrl && (visibleSelectedCue.type === 'audio' || visibleSelectedCue.type === 'music') ? (
                <audio className="media-preview" controls src={visibleSelectedCueAssetUrl} />
              ) : null}
              {visibleSelectedCueAssetUrl && visibleSelectedCue.type === 'image' ? (
                <img className="media-preview visual" src={visibleSelectedCueAssetUrl} alt={visibleSelectedCue.title || visibleSelectedCue.src} />
              ) : null}
              {visibleSelectedCueAssetUrl && visibleSelectedCue.type === 'video' ? (
                <video className="media-preview visual" controls src={visibleSelectedCueAssetUrl} />
              ) : null}
              {!visibleSelectedCueAssetUrl ? (
                <p className="empty-state">Anteprima non disponibile: file media non trovato nel progetto.</p>
              ) : null}
              <button type="button" className="danger" onClick={deleteSelectedCue}><Trash2 size={16} />Elimina cue</button>
            </section>
          ) : (
            <p className="empty-state">
              {filteredCues.length === 0 ? 'Nessun cue nel filtro corrente.' : 'Nessun cue selezionato.'}
            </p>
          )}
        </aside>
      </section>
      {scriptDialog ? (
        <ScriptActionModal
          dialog={scriptDialog}
          onChange={(value) => setScriptDialog((current) => current ? { ...current, value } : current)}
          onCancel={() => setScriptDialog(undefined)}
          onConfirm={submitScriptDialog}
        />
      ) : null}
      {projectPickerEntries.length > 0 ? (
        <ProjectPickerModal
          entries={projectPickerEntries}
          onCancel={() => setProjectPickerEntries([])}
          onOpen={(entry) => {
            setProjectPickerEntries([])
            void openProjectFolder(entry.path)
          }}
        />
      ) : null}
      {toastMessage ? (
        <div className="app-toast" role="status">
          <span>{toastMessage}</span>
          {exportResult ? (
            <button type="button" onClick={() => void openExportResult()}>
              Apri PDF
            </button>
          ) : null}
        </div>
      ) : null}
    </main>
  )
}

type ScriptActionDialog = {
  kind:
    | 'new-project'
    | 'create-file'
    | 'create-folder'
    | 'rename'
    | 'delete'
    | 'create-media-folder'
    | 'rename-media'
    | 'delete-media'
    | 'bookmark'
  title: string
  label?: string
  value?: string
  message?: string
  targetPath?: string
  confirmLabel: string
  danger?: boolean
}

type OutlineItem = {
  id: string
  level: number
  title: string
  position?: number
}

type BookmarkItem = {
  id: string
  title: string
  position?: number
}

type ToolbarState = {
  bold: boolean
  italic: boolean
  paragraph: boolean
  heading1: boolean
  heading2: boolean
  heading3: boolean
  bulletList: boolean
  orderedList: boolean
  blockquote: boolean
  table: boolean
}

const emptyToolbarState: ToolbarState = {
  bold: false,
  italic: false,
  paragraph: false,
  heading1: false,
  heading2: false,
  heading3: false,
  bulletList: false,
  orderedList: false,
  blockquote: false,
  table: false,
}

function ScriptActionModal({
  dialog,
  onChange,
  onCancel,
  onConfirm,
}: {
  dialog: ScriptActionDialog
  onChange: (value: string) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const hasInput = dialog.kind !== 'delete' && dialog.kind !== 'delete-media'
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="action-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="script-action-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="script-action-title">{dialog.title}</h2>
        {dialog.message ? <p>{dialog.message}</p> : null}
        {hasInput ? (
          <label>
            {dialog.label}
            <input
              autoFocus
              value={dialog.value ?? ''}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onConfirm()
                if (event.key === 'Escape') onCancel()
              }}
            />
          </label>
        ) : null}
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>Annulla</button>
          <button type="button" className={dialog.danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {dialog.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

function ProjectPickerModal({
  entries,
  onCancel,
  onOpen,
}: {
  entries: ProjectEntry[]
  onCancel: () => void
  onOpen: (entry: ProjectEntry) => void
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="action-modal project-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-picker-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="project-picker-title">Apri progetto</h2>
        <div className="project-picker-list">
          {entries.map((entry) => (
            <button type="button" key={entry.path} onClick={() => onOpen(entry)}>
              <FolderOpen size={15} />
              <span>
                <strong>{entry.name}</strong>
                <small>{compactPath(entry.path)}</small>
              </span>
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>Annulla</button>
        </div>
      </section>
    </div>
  )
}

function DocumentOutlineTree({
  items,
  activeItemId,
  activeFileName,
  onSelect,
}: {
  items: OutlineItem[]
  activeItemId: string
  activeFileName?: string
  onSelect: (item: OutlineItem) => void
}) {
  if (!activeFileName) return <p className="empty-state">Nessun file aperto.</p>
  if (items.length === 0) return <p className="empty-state">Nessun titolo nel file attivo.</p>

  return (
    <div className="document-outline" aria-label={`Indice di ${activeFileName}`}>
      <div className="outline-file-name">{activeFileName}</div>
      <ul className="tree outline-tree">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={item.id === activeItemId ? 'tree-node outline-node active' : 'tree-node outline-node'}
              style={{ '--outline-depth': item.level - 1 } as CSSProperties}
              onClick={() => onSelect(item)}
            >
              <span className="outline-level" aria-hidden="true">H{item.level}</span>
              <span className="node-name">{item.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function BookmarkTree({
  items,
  activeItemId,
  activeFileName,
  onSelect,
}: {
  items: BookmarkItem[]
  activeItemId: string
  activeFileName?: string
  onSelect: (item: BookmarkItem) => void
}) {
  if (!activeFileName) return <p className="empty-state">Nessun file aperto.</p>
  if (items.length === 0) return <p className="empty-state">Nessun bookmark nel file attivo.</p>

  return (
    <div className="document-outline" aria-label={`Bookmark di ${activeFileName}`}>
      <div className="outline-file-name">{activeFileName}</div>
      <ul className="tree outline-tree bookmark-tree">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={item.id === activeItemId ? 'tree-node bookmark-node active' : 'tree-node bookmark-node'}
              onClick={() => onSelect(item)}
            >
              <Bookmark size={14} />
              <span className="node-name">{item.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ScriptExplorerTree({
  nodes,
  activePath,
  selectedPath,
  expandedPaths,
  onOpen,
  onSelect,
  onToggle,
}: {
  nodes: ProjectTreeNode[]
  activePath: string
  selectedPath: string
  expandedPaths: string[]
  onOpen: (path: string) => void
  onSelect: (path: string) => void
  onToggle: (path: string) => void
}) {
  return (
    <ul className="tree">
      {nodes.map((node) => {
        const isFolder = node.kind === 'folder'
        const isExpanded = expandedPaths.includes(node.path)
        return (
          <li key={node.id}>
            <button
              type="button"
              className={treeNodeClass(node.path, selectedPath, activePath)}
              onClick={() => {
                onSelect(node.path)
                if (isFolder) onToggle(node.path)
                else onOpen(node.path)
              }}
            >
              <span className="node-caret" aria-hidden="true">
                {isFolder ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
              </span>
              <span className="node-icon" aria-hidden="true">
                {isFolder ? <Folder size={15} /> : <FileText size={15} />}
              </span>
              <span className="node-name">{node.name}</span>
              {node.dirty ? <em>modificato</em> : null}
            </button>
            {node.children && isExpanded ? (
              <ScriptExplorerTree
                nodes={node.children}
                activePath={activePath}
                selectedPath={selectedPath}
                expandedPaths={expandedPaths}
                onOpen={onOpen}
                onSelect={onSelect}
                onToggle={onToggle}
              />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function MediaExplorerTree({
  assets,
  selectedPath,
  expandedPaths,
  onSelect,
  onToggle,
  onCue,
  onMove,
}: {
  assets: MediaAsset[]
  selectedPath: string
  expandedPaths: string[]
  onSelect: (path: string) => void
  onToggle: (path: string) => void
  onCue: (asset: MediaAsset) => void
  onMove: (sourcePath: string, targetFolderPath: string) => void
}) {
  return (
    <ul className="tree">
      {assets.map((asset) => {
        const isFolder = asset.kind === 'folder'
        const isExpanded = expandedPaths.includes(asset.path)
        return (
          <li key={asset.id}>
            <div
              role="treeitem"
              tabIndex={0}
              draggable={asset.kind !== 'folder'}
              className={asset.path === selectedPath ? 'tree-node media-node selected' : 'tree-node media-node'}
              onDragStart={(event: ReactDragEvent<HTMLDivElement>) => {
                if (asset.kind === 'folder') return
                event.dataTransfer.effectAllowed = 'copyMove'
                writeDragPayload(event.dataTransfer, MEDIA_PATH_DND_TYPE, MEDIA_PATH_DND_PREFIX, asset.path)
              }}
              onDragOver={(event: ReactDragEvent<HTMLDivElement>) => {
                if (!isFolder) return
                if (!hasDragPayload(event.dataTransfer, MEDIA_PATH_DND_TYPE)) return
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
                event.currentTarget.classList.add('drop-target')
              }}
              onDragLeave={(event: ReactDragEvent<HTMLDivElement>) => {
                event.currentTarget.classList.remove('drop-target')
              }}
              onDrop={(event: ReactDragEvent<HTMLDivElement>) => {
                if (!isFolder) return
                const sourcePath = readDragPayload(event.dataTransfer, MEDIA_PATH_DND_TYPE, MEDIA_PATH_DND_PREFIX)
                if (!sourcePath) return
                event.preventDefault()
                event.stopPropagation()
                event.currentTarget.classList.remove('drop-target')
                onMove(sourcePath, asset.path)
              }}
              onClick={() => {
                onSelect(asset.path)
                if (isFolder) onToggle(asset.path)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(asset.path)
                  if (isFolder) onToggle(asset.path)
                }
              }}
            >
              <span className="node-caret" aria-hidden="true">
                {isFolder ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
              </span>
              <span className="node-icon" aria-hidden="true">{mediaIcon(asset.kind)}</span>
              <span className="node-name">{asset.name}</span>
              {asset.kind !== 'folder' ? (
                <button
                  type="button"
                  className="node-action"
                  title="Inserisci come cue"
                  aria-label={`Inserisci ${asset.name} come cue`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onCue(asset)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.stopPropagation()
                    }
                  }}
                >
                  <Play size={13} />
                </button>
              ) : null}
            </div>
            {asset.children && isExpanded ? (
              <MediaExplorerTree
                assets={asset.children}
                selectedPath={selectedPath}
                expandedPaths={expandedPaths}
                onSelect={onSelect}
                onToggle={onToggle}
                onCue={onCue}
                onMove={onMove}
              />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

const mediaIcon = (kind: MediaAsset['kind']) => {
  if (kind === 'folder') return <Folder size={15} />
  if (kind === 'image') return <FileImage size={15} />
  if (kind === 'video') return <FileVideo size={15} />
  return <FileAudio size={15} />
}

function MediaPreview({
  asset,
  projectRootPath,
  onCue,
}: {
  asset: MediaAsset
  projectRootPath: string
  onCue: (asset: MediaAsset) => void
}) {
  const assetUrl = mediaAssetUrl(asset, projectRootPath)
  return (
    <section className="media-preview-card">
      <div className="media-preview-header">
        <strong>{asset.name}</strong>
        <button type="button" title="Inserisci come cue" onClick={() => onCue(asset)}><Play size={13} /></button>
      </div>
      {assetUrl && asset.kind === 'image' ? <img src={assetUrl} alt="" /> : null}
      {assetUrl && asset.kind === 'video' ? <video controls src={assetUrl} /> : null}
      {assetUrl && (asset.kind === 'audio' || asset.kind === 'music') ? <audio controls src={assetUrl} /> : null}
      {!assetUrl ? <p className="empty-state">Anteprima non disponibile: file media non trovato nel progetto.</p> : null}
    </section>
  )
}

type TreeItem<T> = {
  id: string
  name: string
  path: string
  children?: T[]
}

const treeNodeClass = (path: string, selectedPath: string, activePath: string) =>
  [
    'tree-node',
    path === activePath ? 'active' : '',
    path === selectedPath ? 'selected' : '',
  ]
    .filter(Boolean)
    .join(' ')

const fileTabClass = (file: ProjectTreeNode | undefined, active: boolean, readOnly = false) =>
  ['file-tab', active ? 'active' : '', file?.dirty ? 'dirty' : '', readOnly ? 'read-only' : '']
    .filter(Boolean)
    .join(' ')

const findTreeNode = <T extends TreeItem<T>>(nodes: T[], path: string): T | undefined => {
  for (const node of nodes) {
    if (node.path === path) return node
    const child = node.children ? findTreeNode(node.children, path) : undefined
    if (child) return child
  }
  return undefined
}

const flattenTree = <T extends TreeItem<T>>(nodes: T[]): T[] =>
  nodes.flatMap((node) => [node, ...(node.children ? flattenTree(node.children) : [])])

const updateTreeNode = <T extends TreeItem<T>>(
  nodes: T[],
  path: string,
  updater: (node: T) => T,
): T[] =>
  nodes.map((node) => {
    if (node.path === path) return updater(node)
    if (node.children) return { ...node, children: updateTreeNode(node.children, path, updater) }
    return node
  })

function applyDraftsToProject(project: Project, drafts: Record<string, string>): Project {
  const entries = Object.entries(drafts)
  if (entries.length === 0) return project

  let scripts = project.scripts
  for (const [path, draft] of entries) {
    const content = serializeExtendedMarkdown(
      draft,
      project.notes.filter((note) => note.filePath === path),
      project.cues.filter((cue) => cue.filePath === path),
    )
    scripts = updateTreeNode(scripts, path, (node) => ({ ...node, content, dirty: false }))
  }

  return { ...project, scripts }
}

const insertTreeChild = <T extends TreeItem<T>>(nodes: T[], folderPath: string, child: T): T[] => {
  if (folderPath === '/media') return [...nodes, child]
  return updateTreeNode(nodes, folderPath, (node) => ({
    ...node,
    children: [...(node.children ?? []), child],
  }))
}

const insertTreeChildren = <T extends TreeItem<T>>(nodes: T[], folderPath: string, children: T[]): T[] => {
  if (folderPath === '/media') return [...nodes, ...children]
  return updateTreeNode(nodes, folderPath, (node) => ({
    ...node,
    children: [...(node.children ?? []), ...children],
  }))
}

const removeTreeNode = <T extends TreeItem<T>>(nodes: T[], path: string): T[] =>
  nodes
    .filter((node) => node.path !== path)
    .map((node) => ({
      ...node,
      children: node.children ? removeTreeNode(node.children, path) : undefined,
    }))

const clearDirtyPath = (nodes: ProjectTreeNode[], pathToClear: string): ProjectTreeNode[] =>
  nodes.map((node) => ({
    ...node,
    dirty: isPathInside(node.path, pathToClear) ? false : node.dirty,
    children: node.children ? clearDirtyPath(node.children, pathToClear) : undefined,
  }))

const renameTreeNode = <T extends TreeItem<T>>(node: T, name: string, path: string): T => {
  const previousPath = node.path
  const rewritePaths = (items: T[]): T[] =>
    items.map((child) => ({
      ...child,
      path: child.path.replace(previousPath, path),
      children: child.children ? rewritePaths(child.children) : undefined,
    }))

  return {
    ...node,
    name,
    path,
    children: node.children ? rewritePaths(node.children) : undefined,
  }
}

const cloneTreeNode = <T extends TreeItem<T>>(node: T, path: string, name: string): T => {
  const cloneChildren = (items: T[], previousParentPath: string, nextParentPath: string): T[] =>
    items.map((child) => {
      const childPath = child.path.replace(previousParentPath, nextParentPath)
      return {
        ...child,
        id: crypto.randomUUID(),
        path: childPath,
        children: child.children ? cloneChildren(child.children, child.path, childPath) : undefined,
      }
    })

  return {
    ...node,
    id: crypto.randomUUID(),
    name,
    path,
    children: node.children ? cloneChildren(node.children, node.path, path) : undefined,
  }
}

const duplicateName = (name: string) => {
  const extensionMatch = name.match(/(\.[^.]+)$/)
  if (!extensionMatch) return `${name}-copia`
  const extension = extensionMatch[1]
  return `${name.slice(0, -extension.length)}-copia${extension}`
}

const defaultNoteType = (noteTypes: NoteType[]) =>
  noteTypes.find((noteType) => noteType.id === 'general') ?? noteTypes[0]

const requiredNoteTypes: NoteType[] = [
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

function normalizeProject(project: Project): Project {
  const noteTypeIds = new Set(project.noteTypes.map((noteType) => noteType.id))
  const missingNoteTypes = requiredNoteTypes.filter((noteType) => !noteTypeIds.has(noteType.id))
  return missingNoteTypes.length > 0
    ? { ...project, noteTypes: mergeNoteTypes(project.noteTypes, missingNoteTypes) }
    : project
}

const mergeNoteTypes = (current: NoteType[], missing: NoteType[]) => {
  const byId = new Map([...current, ...missing].map((noteType) => [noteType.id, noteType]))
  return requiredNoteTypes.map((noteType) => byId.get(noteType.id) ?? noteType)
}

const charactersTableRow = (cells: string[], header = false): TiptapJsonNode => ({
  type: 'tableRow',
  content: cells.map((cell) => ({
    type: header ? 'tableHeader' : 'tableCell',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: cell }],
      },
    ],
  })),
})

const isProject = (value: unknown): value is Project => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<Project>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.scripts) &&
    Array.isArray(candidate.media) &&
    Array.isArray(candidate.notes) &&
    Array.isArray(candidate.cues) &&
    Array.isArray(candidate.noteTypes) &&
    Boolean(candidate.settings)
  )
}

const noteChipLabel = (note: Pick<DirectorNote, 'title' | 'type'>, noteTypes: NoteType[]) =>
  note.title?.trim() || noteTypes.find((noteType) => noteType.id === note.type)?.label || 'Nota regia'

const cueChipLabel = (cue: Pick<MediaCue, 'src' | 'title'>) =>
  cue.title?.trim() || cue.src.split('/').pop() || 'Cue media'

const compactPath = (path: string) => {
  const parts = path.split('/')
  if (parts.length <= 3) return path
  return `.../${parts.slice(-3).join('/')}`
}

const isTauriRuntime = () =>
  typeof window !== 'undefined' && Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)

const isLocalDevRuntime = () =>
  typeof window !== 'undefined' &&
  !isTauriRuntime() &&
  (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')

const linkFromClickTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return ''
  const link = target.closest<HTMLAnchorElement>('a[href]')
  if (!link) return ''
  return link.href
}

const insertMarkdownAtSelection = (view: EditorView, markdown: string) => {
  const container = document.createElement('div')
  container.innerHTML = markdownToHtml(markdown)
  const slice = ProseMirrorDOMParser.fromSchema(view.state.schema).parseSlice(container)
  view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView())
}

const convertMarkdownTableAroundSelection = (view: EditorView) => {
  const paragraphs: { node: ProseMirrorNode; position: number; text: string }[] = []

  view.state.doc.descendants((node, position) => {
    if (node.type.name === 'paragraph') {
      paragraphs.push({ node, position, text: node.textContent.trim() })
      return false
    }
    return true
  })

  const selectionFrom = view.state.selection.from
  const currentIndex = paragraphs.findIndex(
    ({ node, position }) => selectionFrom >= position && selectionFrom <= position + node.nodeSize,
  )
  if (currentIndex < 0 || !isPotentialMarkdownTableLine(paragraphs[currentIndex].text)) return false

  let startIndex = currentIndex
  let endIndex = currentIndex
  while (startIndex > 0 && isPotentialMarkdownTableLine(paragraphs[startIndex - 1].text)) startIndex -= 1
  while (endIndex < paragraphs.length - 1 && isPotentialMarkdownTableLine(paragraphs[endIndex + 1].text)) endIndex += 1

  const markdown = paragraphs.slice(startIndex, endIndex + 1).map((paragraph) => paragraph.text).join('\n')
  if (!hasMarkdownTable(markdown)) return false

  const container = document.createElement('div')
  container.innerHTML = markdownToHtml(markdown)
  const slice = ProseMirrorDOMParser.fromSchema(view.state.schema).parseSlice(container)
  const from = paragraphs[startIndex].position
  const to = paragraphs[endIndex].position + paragraphs[endIndex].node.nodeSize
  view.dispatch(view.state.tr.replaceRange(from, to, slice).scrollIntoView())
  return true
}

const isPotentialMarkdownTableLine = (text: string) => text.includes('|') && text.trim().length > 0

const openExternalLink = async (href: string) => {
  const url = normalizedExternalUrl(href)
  if (!url) throw new Error('collegamento non valido')

  if (isTauriRuntime()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
    return
  }

  window.open(url, '_blank', 'noopener,noreferrer')
}

const openObjectUrlInNewTab = (url: string) => {
  const link = document.createElement('a')
  link.href = url
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  document.body.append(link)
  link.click()
  link.remove()
}

const normalizedExternalUrl = (href: string) => {
  try {
    const url = new URL(href, window.location.href)
    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) return ''
    return url.toString()
  } catch {
    return ''
  }
}

const parentPath = (path: string) => {
  const index = path.lastIndexOf('/')
  if (index <= 0) return ''
  return path.slice(0, index)
}

const childPath = (folderPath: string, name: string) => `${folderPath.replace(/\/$/, '')}/${name}`

const isPathInside = (path: string, parent: string) => path === parent || path.startsWith(`${parent}/`)

const protectedMediaRootPaths = new Set(['/media/suoni', '/media/musiche', '/media/immagini', '/media/video'])

const isProtectedMediaRoot = (asset: MediaAsset) => asset.kind === 'folder' && protectedMediaRootPaths.has(asset.path)

const renameDraftPaths = (drafts: Record<string, string>, previousPath: string, nextPath: string) =>
  Object.fromEntries(
    Object.entries(drafts).map(([path, content]) => [
      path === previousPath || path.startsWith(`${previousPath}/`) ? path.replace(previousPath, nextPath) : path,
      content,
    ]),
  )

const removeDraftPath = (drafts: Record<string, string>, pathToRemove: string) =>
  Object.fromEntries(
    Object.entries(drafts).filter(([path]) => path !== pathToRemove && !path.startsWith(`${pathToRemove}/`)),
  )

type TiptapJsonNode = {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: { type?: string; attrs?: Record<string, unknown> }[]
  content?: TiptapJsonNode[]
}

type ProseMirrorDocNode = {
  descendants: (
    callback: (node: ProseMirrorNode, pos: number) => void | false,
  ) => void
}

type EditorKeyboardNode = {
  type?: { name?: string }
  attrs?: Record<string, unknown>
}

type ScriptChipMatch = {
  position: number
  nodeSize: number
  attrs: Record<string, unknown>
}

type ScriptNodeMatch = ScriptChipMatch & {
  node: ProseMirrorNode
}

const editorOutlineItems = (doc: ProseMirrorDocNode): OutlineItem[] => {
  const items: OutlineItem[] = []
  doc.descendants((node, position) => {
    if (node.type.name !== 'heading') return
    const level = Number(node.attrs.level ?? 1)
    const title = node.textContent?.trim()
    if (!title) return
    items.push({
      id: `heading-${position}`,
      level: clampHeadingLevel(level),
      title,
      position,
    })
  })
  return items
}

const editorBookmarkItems = (doc: ProseMirrorDocNode): BookmarkItem[] => {
  const items: BookmarkItem[] = []
  doc.descendants((node, position) => {
    if (node.type.name !== 'scriptChip' || node.attrs.kind !== 'bookmark') return
    const title = String(node.attrs.label ?? '').trim()
    const refId = String(node.attrs.refId ?? '')
    if (!title) return
    items.push({
      id: refId || `bookmark-${position}`,
      title,
      position,
    })
  })
  return items
}

const markdownOutlineItems = (markdown: string): OutlineItem[] =>
  markdown
    .split('\n')
    .map((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
      if (!match) return undefined
      return {
        id: `heading-${index}`,
        level: match[1].length,
        title: match[2].trim(),
      }
    })
    .filter((item): item is OutlineItem => Boolean(item))

const markdownBookmarkItems = (markdown: string): BookmarkItem[] =>
  [...markdown.matchAll(/\[BOOKMARK:\s*([^\]]+)\](?:\s+\{#([^\s}]+)[^}]*\})?/g)]
    .map((match, index) => ({
      id: match[2] ?? `bookmark-${index}`,
      title: match[1].trim(),
    }))

const clampHeadingLevel = (level: number) => Math.min(6, Math.max(1, Number.isFinite(level) ? level : 1))

const isFullscreenBlock = (type: string) =>
  type === 'dialogue' || type === 'media'

const markerRefIdsFromMarkdown = (markdown: string, kind: 'cue' | 'note') => {
  const ids = new Set<string>()
  const directiveName = kind === 'cue' ? 'media' : 'regia'
  const directivePattern = new RegExp(`::${directiveName}\\\\{([^}]*)\\\\}`, 'g')
  for (const match of markdown.matchAll(directivePattern)) {
    const id = readDirectiveAttr(match[1], 'id')
    if (id) ids.add(id)
  }

  const markerPattern = kind === 'cue'
    ? /^\[CUE[\s:][^\]]+\]\s+\{#([^\s}]+)/gm
    : /^\[NOTA:[^\]]+\]\s+\{#([^\s}]+)/gm
  for (const match of markdown.matchAll(markerPattern)) {
    ids.add(match[1])
  }

  return [...ids]
}

const uniqueValues = (values: string[]) => [...new Set(values.filter(Boolean))]

const readDragPayload = (dataTransfer: DataTransfer, type: string, prefix: string) => {
  const direct = dataTransfer.getData(type)
  if (direct) return direct

  const text = dataTransfer.getData('text/plain')
  return text.startsWith(prefix) ? text.slice(prefix.length) : ''
}

const writeDragPayload = (dataTransfer: DataTransfer, type: string, prefix: string, value: string) => {
  dataTransfer.setData(type, value)
  dataTransfer.setData('text/plain', `${prefix}${value}`)
}

const hasDragPayload = (dataTransfer: DataTransfer, type: string) =>
  Array.from(dataTransfer.types).some((item) => item.toLowerCase() === type.toLowerCase() || item === 'text/plain')

const arraysEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index])

const syncEditorCueRefs = (
  editor: Editor,
  setIds: Dispatch<SetStateAction<string[]>>,
) => {
  const ids: string[] = []
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'scriptChip' && node.attrs.kind === 'cue' && node.attrs.refId) {
      ids.push(String(node.attrs.refId))
    }
  })
  setIds((current) => {
    const next = uniqueValues(ids)
    return arraysEqual(current, next) ? current : next
  })
}

const syncBookmarkState = (
  editor: Editor,
  setActiveBookmarks: Dispatch<SetStateAction<BookmarkItem[]>>,
  setActiveBookmarkId: Dispatch<SetStateAction<string>>,
) => {
  const next = editorBookmarkItems(editor.state.doc)
  const activeId = bookmarkItemIdAtPosition(next, editor.state.selection.from)
  setActiveBookmarks((current) => (sameBookmarkItems(current, next) ? current : next))
  setActiveBookmarkId((current) => (current === activeId ? current : activeId))
}

const fullscreenIndexAtEditorPosition = (editor: Editor | null, performanceBlocks: PerformanceBlock[]) => {
  if (!editor || performanceBlocks.length === 0) return 0
  const selectionPosition = editor.state.selection.from
  let index = 0
  let currentIndex = 0
  editor.state.doc.descendants((node, position) => {
    if (position > selectionPosition) return false
    if (node.type.name !== 'paragraph') return

    const text = node.textContent?.trim() ?? ''
    if (!text) return
    currentIndex = Math.min(index, performanceBlocks.length - 1)
    index += 1
  })
  return currentIndex
}

const syncEditorSceneState = (editor: Editor, setActiveSceneId: Dispatch<SetStateAction<string>>) => {
  const sceneId = editorSceneIdAtPosition(editor.state.doc, editor.state.selection.from)
  setActiveSceneId((current) => (current === sceneId ? current : sceneId))
}

const editorSceneIdAtPosition = (doc: ProseMirrorDocNode, selectionPosition: number) => {
  let sceneId = ''
  doc.descendants((node, position) => {
    if (position > selectionPosition) return false
    if (node.type.name !== 'heading') return

    const title = node.textContent?.trim() ?? ''
    const level = Number(node.attrs.level ?? 1)
    if (!title || (level !== 2 && !/^SCENA\b/i.test(title))) return
    sceneId = slug(title)
  })
  return sceneId
}

const readToolbarState = (editor: Editor): ToolbarState => {
  const currentBlock = editor.state.selection.$from.parent
  const headingLevel = currentBlock.type.name === 'heading' ? Number(currentBlock.attrs.level ?? 1) : undefined

  return {
    bold: editor.isActive('bold'),
    italic: editor.isActive('italic'),
    paragraph: currentBlock.type.name === 'paragraph',
    heading1: headingLevel === 1,
    heading2: headingLevel === 2,
    heading3: headingLevel === 3,
    bulletList: editor.isActive('bulletList'),
    orderedList: editor.isActive('orderedList'),
    blockquote: editor.isActive('blockquote'),
    table: editor.isActive('table'),
  }
}

const bookmarkTitleFromSelection = (editor: Editor) => {
  const { from, to } = editor.state.selection
  const selectedText = editor.state.doc.textBetween(from, to, ' ').trim()
  if (selectedText) return selectedText.slice(0, 48)

  const lineText = editor.state.selection.$from.parent.textContent.trim()
  return lineText.slice(0, 48)
}

const syncToolbarState = (
  editor: Editor,
  setToolbarState: Dispatch<SetStateAction<ToolbarState>>,
) => {
  const next = readToolbarState(editor)
  setToolbarState((current) => (sameToolbarState(current, next) ? current : next))
}

const syncOutlineState = (
  editor: Editor,
  setActiveOutline: Dispatch<SetStateAction<OutlineItem[]>>,
  setActiveOutlineId: Dispatch<SetStateAction<string>>,
) => {
  const next = editorOutlineItems(editor.state.doc)
  const activeId = outlineItemIdAtPosition(next, editor.state.selection.from)
  setActiveOutline((current) => (sameOutlineItems(current, next) ? current : next))
  setActiveOutlineId((current) => (current === activeId ? current : activeId))
}

const outlineItemIdAtPosition = (items: OutlineItem[], position: number) => {
  let activeId = ''
  for (const item of items) {
    if (item.position === undefined || item.position >= position) break
    activeId = item.id
  }
  return activeId
}

const bookmarkItemIdAtPosition = (items: BookmarkItem[], position: number) => {
  let activeId = ''
  for (const item of items) {
    if (item.position === undefined || item.position > position) break
    activeId = item.id
  }
  return activeId
}

const sameOutlineItems = (left: OutlineItem[], right: OutlineItem[]) =>
  left.length === right.length &&
  left.every((item, index) => {
    const other = right[index]
    return (
      other !== undefined &&
      item.id === other.id &&
      item.level === other.level &&
      item.title === other.title &&
      item.position === other.position
    )
  })

const sameBookmarkItems = (left: BookmarkItem[], right: BookmarkItem[]) =>
  left.length === right.length &&
  left.every((item, index) => {
    const other = right[index]
    return (
      other !== undefined &&
      item.id === other.id &&
      item.title === other.title &&
      item.position === other.position
    )
  })

const sameToolbarState = (left: ToolbarState, right: ToolbarState) =>
  left.bold === right.bold &&
  left.italic === right.italic &&
  left.paragraph === right.paragraph &&
  left.heading1 === right.heading1 &&
  left.heading2 === right.heading2 &&
  left.heading3 === right.heading3 &&
  left.bulletList === right.bulletList &&
  left.orderedList === right.orderedList &&
  left.blockquote === right.blockquote &&
  left.table === right.table

const editorJsonToMarkdown = (doc: TiptapJsonNode) =>
  (doc.content ?? []).map((node) => blockJsonToMarkdown(node)).join('\n')

const inlineJsonToText = (node: TiptapJsonNode): string => {
  if (node.type === 'text') return applyMarkdownMarks(node.text ?? '', node.marks)
  if (node.type === 'scriptChip') {
    if (node.attrs?.kind === 'note') return noteMarkerFromAttrs(node.attrs)
    if (node.attrs?.kind === 'cue') return cueMarkerFromAttrs(node.attrs)
    if (node.attrs?.kind === 'bookmark') return bookmarkMarkerFromAttrs(node.attrs)
    return String(node.attrs?.label ?? '')
  }
  if (node.type === 'hardBreak') return '\n'
  return (node.content ?? []).map(inlineJsonToText).join('')
}

const blockJsonToMarkdown = (node: TiptapJsonNode): string => {
  const text = inlineJsonToText(node)
  if (node.type === 'heading') {
    const level = clampHeadingLevel(Number(node.attrs?.level ?? 1))
    return `${'#'.repeat(level)} ${text}`
  }
  if (node.type === 'scriptNote') return noteMarkerFromAttrs(node.attrs)
  if (node.type === 'bulletList') {
    return (node.content ?? []).map((item) => `- ${listItemJsonToMarkdown(item)}`).join('\n')
  }
  if (node.type === 'orderedList') {
    const start = Number(node.attrs?.start ?? 1)
    return (node.content ?? []).map((item, index) => `${start + index}. ${listItemJsonToMarkdown(item)}`).join('\n')
  }
  if (node.type === 'blockquote') {
    return (node.content ?? [])
      .map((item) => blockJsonToMarkdown(item).split('\n').map((line) => `> ${line}`).join('\n'))
      .join('\n')
  }
  if (node.type === 'table') return tableJsonToMarkdown(node)
  if (node.type === 'horizontalRule') return '---'
  return text
}

const tableJsonToMarkdown = (node: TiptapJsonNode) => {
  const rows = (node.content ?? []).map((row) =>
    (row.content ?? []).map((cell) =>
      (cell.content ?? [])
        .map((block) => inlineJsonToText(block).replace(/\s+/g, ' ').trim())
        .join(' ')
        .trim(),
    ),
  )
  if (rows.length === 0) return ''
  const headers = rows[0] ?? []
  const separator = headers.map(() => '---')
  return [headers, separator, ...rows.slice(1)]
    .map((row) => `| ${row.map(escapeMarkdownTableCell).join(' | ')} |`)
    .join('\n')
}

const escapeMarkdownTableCell = (value: string) => value.replace(/\|/g, '\\|')

const listItemJsonToMarkdown = (node: TiptapJsonNode) =>
  (node.content ?? [])
    .map((item) => (item.type === 'paragraph' ? inlineJsonToText(item) : blockJsonToMarkdown(item)))
    .join('\n  ')

const applyMarkdownMarks = (text: string, marks: TiptapJsonNode['marks']) =>
  (marks ?? []).reduce((current, mark) => {
    if (mark.type === 'bold') return `**${current}**`
    if (mark.type === 'italic') return `*${current}*`
    if (mark.type === 'link' && typeof mark.attrs?.href === 'string') return `[${current}](${mark.attrs.href})`
    return current
  }, text)

const noteMarkerFromAttrs = (attrs?: Record<string, unknown>) => {
  const title = String(attrs?.title || attrs?.label || attrs?.refId || 'nota')
  const refId = String(attrs?.refId || '')
  const color = String(attrs?.color || '')
  const type = String(attrs?.type || 'general')
  const content = String(attrs?.content || '')
  const collapsed = attrs?.collapsed === true || attrs?.collapsed === 'true'
  const attrsText = [
    refId ? `#${refId}` : '',
    color ? `.${color}` : '',
    `type="${escapeMarkdownAttr(type)}"`,
    content ? `content="${escapeMarkdownAttr(content)}"` : '',
    collapsed ? 'collapsed="true"' : '',
  ].filter(Boolean).join(' ')
  return attrsText ? `[NOTA: ${title}] {${attrsText}}` : `[NOTA: ${title}]`
}

const cueMarkerFromAttrs = (attrs?: Record<string, unknown>) => {
  const label = String(attrs?.label || attrs?.refId || 'cue')
  const refId = String(attrs?.refId || '')
  const color = String(attrs?.color || '')
  const attrsText = [refId ? `#${refId}` : '', color ? `.${color}` : ''].filter(Boolean).join(' ')
  return attrsText ? `[CUE: ${label}] {${attrsText}}` : `[CUE: ${label}]`
}

const bookmarkMarkerFromAttrs = (attrs?: Record<string, unknown>) => {
  const label = String(attrs?.label || attrs?.refId || 'Bookmark')
  const refId = String(attrs?.refId || '')
  return refId ? `[BOOKMARK: ${label}] {#${refId}}` : `[BOOKMARK: ${label}]`
}

const escapeMarkdownAttr = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/\n/g, '&#10;')

const chipIndexBeforePosition = (doc: ProseMirrorDocNode, position: number, kind: string) => {
  let index = 0
  doc.descendants((node, pos) => {
    if (pos >= position) return
    if (node.type.name === 'scriptChip' && node.attrs.kind === kind) index += 1
  })
  return index
}

const chipMatchByRef = (doc: ProseMirrorDocNode, kind: string, refId: string): ScriptChipMatch | undefined => {
  if (!refId) return undefined
  let match: ScriptChipMatch | undefined
  doc.descendants((node, pos) => {
    if (match || node.type.name !== 'scriptChip' || node.attrs.kind !== kind || node.attrs.refId !== refId) return
    match = { position: pos, nodeSize: node.nodeSize, attrs: node.attrs }
  })
  return match
}

const nodeMatchByRef = (doc: ProseMirrorDocNode, nodeType: string, refId: string): ScriptNodeMatch | undefined => {
  if (!refId) return undefined
  let match: ScriptNodeMatch | undefined
  doc.descendants((node, pos) => {
    if (match || node.type.name !== nodeType || node.attrs.refId !== refId) return
    match = { position: pos, nodeSize: node.nodeSize, attrs: node.attrs, node }
  })
  return match
}

const chipKindHasRefs = (doc: ProseMirrorDocNode, kind: string) => {
  let hasRefs = false
  doc.descendants((node) => {
    if (hasRefs || node.type.name !== 'scriptChip' || node.attrs.kind !== kind) return
    hasRefs = Boolean(node.attrs.refId)
  })
  return hasRefs
}

const chipMatchByIndex = (doc: ProseMirrorDocNode, kind: string, index: number): ScriptChipMatch | undefined => {
  let currentIndex = 0
  let match: ScriptChipMatch | undefined
  doc.descendants((node, pos) => {
    if (match || node.type.name !== 'scriptChip' || node.attrs.kind !== kind) return
    if (currentIndex === index) {
      match = { position: pos, nodeSize: node.nodeSize, attrs: node.attrs }
      return
    }
    currentIndex += 1
  })
  return match
}

const chipPositionByIndex = (doc: ProseMirrorDocNode, kind: string, index: number) => {
  return chipMatchByIndex(doc, kind, index)?.position
}

type PerformanceBlock = ReturnType<typeof parseScriptBlocks>[number]

const assignCueBlocks = (
  blocks: PerformanceBlock[],
  cues: MediaCue[],
  activePath: string,
  activeCueRefIds: string[],
): PerformanceBlock[] => {
  const fileCues = cues.filter((cue) => cue.filePath === activePath && activeCueRefIds.includes(cue.id))
  let cueIndex = 0

  return blocks.map((block) => {
    if (block.type !== 'media') return block
    const text = block.text?.toLowerCase() ?? ''
    const refId = cueRefIdFromBlockText(block.text ?? '')
    const matchedCue =
      (refId ? fileCues.find((cue) => cue.id === refId) : undefined) ??
      fileCues.find((cue) => text.includes(cue.src.split('/').pop()?.toLowerCase() ?? cue.id)) ?? fileCues[cueIndex]
    cueIndex += 1
    return matchedCue ? { ...block, cueId: matchedCue.id, sceneId: matchedCue.sceneId ?? block.sceneId } : block
  })
}

const cueRefIdFromBlockText = (text: string) =>
  text.match(/\{#([^\s}]+)/)?.[1] ?? undefined

function FullscreenView({
  block,
  index,
  total,
  cues,
  media,
  projectRootPath,
  executedCueIds,
  onCueExecuted,
  onClose,
  onNext,
  onPrevious,
  onHome,
  onEnd,
}: {
  block: ReturnType<typeof parseScriptBlocks>[number] | undefined
  index: number
  total: number
  cues: MediaCue[]
  media: MediaAsset[]
  projectRootPath: string
  executedCueIds: string[]
  onCueExecuted: (cueId: string) => void
  onClose: () => void
  onNext: () => void
  onPrevious: () => void
  onHome: () => void
  onEnd: () => void
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioTimersRef = useRef<number[]>([])
  const activePlaybackRef = useRef<{ cueId: string; assetUrl: string; type: 'audio' | 'video' } | undefined>(undefined)
  const playingCueRef = useRef<MediaCue | undefined>(undefined)
  const onCueExecutedRef = useRef(onCueExecuted)
  const [playingCueId, setPlayingCueId] = useState('')
  const [mediaStatus, setMediaStatus] = useState('Pronto')
  const stepCue = block?.cueId ? cues.find((cue) => cue.id === block.cueId) : undefined
  const stepAsset = stepCue ? findTreeNode(media, stepCue.src) : undefined
  const stepAssetUrl = stepAsset ? mediaAssetUrl(stepAsset, projectRootPath) : undefined
  const playingCue = cues.find((cue) => cue.id === playingCueId)
  const playingAsset = playingCue ? findTreeNode(media, playingCue.src) : undefined
  const playingAssetUrl = playingAsset ? mediaAssetUrl(playingAsset, projectRootPath) : undefined
  playingCueRef.current = playingCue
  onCueExecutedRef.current = onCueExecuted
  const visualCue = isVisualCue(stepCue) ? stepCue : undefined
  const playablePlayingCue = isPlayableCue(playingCue) ? playingCue : undefined
  const isCueStep = block?.type === 'media'
  const fullscreenLabel = fullscreenBlockLabel(block, isCueStep)
  const fullscreenText = isCueStep ? stepCue?.title || block?.text || 'Cue multimediale' : block?.text ?? 'Nessuna battuta disponibile.'
  const density = fullscreenText.length > 420 ? 'dense' : fullscreenText.length > 220 ? 'medium' : 'normal'

  useEffect(() => {
    if (!stepCue || !stepCue.autoplay || executedCueIds.includes(stepCue.id)) return

    if (stepCue.type === 'image') {
      setMediaStatus(`Immagine visualizzata: ${stepCue.title || stepCue.src}`)
      onCueExecutedRef.current(stepCue.id)
      return
    }

    setPlayingCueId(stepCue.id)
  }, [executedCueIds, stepCue])

  useEffect(() => {
    const cue = playingCueRef.current
    if (!cue) return
    const audio = audioRef.current
    const video = videoRef.current
    const assetUrl = playingAssetUrl
    let cancelled = false

    if (cue.type === 'image') {
      setMediaStatus(`Immagine visualizzata: ${cue.title || cue.src}`)
      onCueExecutedRef.current(cue.id)
      setPlayingCueId((current) => (current === cue.id ? '' : current))
      activePlaybackRef.current = undefined
      return
    }

    if (!assetUrl) {
      setMediaStatus(`Cue senza file locale: ${cue.title || cue.src}`)
      return
    }

    const playbackType = cue.type === 'video' ? 'video' : 'audio'
    const activePlayback = activePlaybackRef.current
    if (
      activePlayback?.cueId === cue.id &&
      activePlayback.assetUrl === assetUrl &&
      activePlayback.type === playbackType
    ) {
      return
    }
    activePlaybackRef.current = { cueId: cue.id, assetUrl, type: playbackType }
    clearAudioTimers(audioTimersRef)

    if (cue.type === 'video') {
      if (!video) return
      audio?.pause()
      video.pause()
      video.loop = Boolean(cue.options.loop)
      video.volume = cueTargetVolume(cue)
      video.muted = false
      video.onended = () => {
        activePlaybackRef.current = undefined
        setPlayingCueId('')
        setMediaStatus(`Video terminato: ${cue.title || cue.src}`)
      }
      void prepareMediaForCue(video, cue, assetUrl)
        .then((preparedSrc) => {
          if (cancelled || video.src !== preparedSrc) return
          scheduleCueEnd(video, cue, audioTimersRef, () => {
            activePlaybackRef.current = undefined
            setPlayingCueId('')
            setMediaStatus(`Video terminato: ${cue.title || cue.src}`)
          })
          return video.play()
        })
        .then(() => {
          if (cancelled) return
          onCueExecutedRef.current(cue.id)
          setMediaStatus(`Video in esecuzione: ${cue.title || cue.src}`)
        })
        .catch(() => {
          if (cancelled) return
          video.muted = true
          prepareMediaForCue(video, cue, assetUrl)
            .then((preparedSrc) => {
              if (cancelled || video.src !== preparedSrc) return
              return video.play()
            })
            .then(() => {
              if (cancelled) return
              onCueExecutedRef.current(cue.id)
              setMediaStatus(`Video in esecuzione senza audio: ${cue.title || cue.src}`)
            })
            .catch(() => {
              if (!cancelled) setMediaStatus(`Video pronto, avvio bloccato dal browser: ${cue.title || cue.src}`)
            })
        })
      return () => {
        cancelled = true
        video.onended = null
        clearAudioTimers(audioTimersRef)
        if (activePlaybackRef.current?.cueId === cue.id) activePlaybackRef.current = undefined
      }
    }

    if (!audio) {
      setMediaStatus(`Cue senza file locale: ${cue.title || cue.src}`)
      return
    }

    const targetVolume = cueTargetVolume(cue)
    video?.pause()
    audio.pause()
    audio.loop = Boolean(cue.options.loop)
    audio.onended = () => {
      activePlaybackRef.current = undefined
      setPlayingCueId('')
      setMediaStatus(`Cue terminato: ${cue.title || cue.src}`)
    }

    if ((cue.options.fadeIn ?? 0) > 0) {
      audio.volume = 0
      fadeAudioVolume(audio, targetVolume, cue.options.fadeIn ?? 0, audioTimersRef)
    } else {
      audio.volume = targetVolume
    }

    void prepareMediaForCue(audio, cue, assetUrl)
      .then((preparedSrc) => {
        if (cancelled || audio.src !== preparedSrc) return
        scheduleCueEnd(audio, cue, audioTimersRef, () => {
          activePlaybackRef.current = undefined
          setPlayingCueId('')
          setMediaStatus(`Cue terminato: ${cue.title || cue.src}`)
        })
        return audio.play()
      })
      .then(() => {
        if (cancelled) return
        onCueExecutedRef.current(cue.id)
        setMediaStatus(`In esecuzione: ${cue.title || cue.src}`)
      })
      .catch(() => {
        if (!cancelled) setMediaStatus(`Cue pronto, avvio bloccato dal browser: ${cue.title || cue.src}`)
      })

    return () => {
      cancelled = true
      audio.onended = null
      clearAudioTimers(audioTimersRef)
      if (activePlaybackRef.current?.cueId === cue.id) activePlaybackRef.current = undefined
    }
  }, [playingAssetUrl, playingCueId])

  const togglePlayback = () => {
    if (!playablePlayingCue) {
      if (!stepCue) return
      if (stepCue.type === 'image') {
        setMediaStatus(`Immagine visualizzata: ${stepCue.title || stepCue.src}`)
        onCueExecuted(stepCue.id)
        setPlayingCueId('')
        activePlaybackRef.current = undefined
        return
      }
      if (!isPlayableCue(stepCue)) return
      clearAudioTimers(audioTimersRef)
      setPlayingCueId(stepCue.id)
      return
    }

    const media = playablePlayingCue.type === 'video' ? videoRef.current : audioRef.current
    if (!media) return
    if (media.paused) {
      clearAudioTimers(audioTimersRef)
      media.volume = cueTargetVolume(playablePlayingCue)
      void media.play()
      setMediaStatus(`In esecuzione: ${playablePlayingCue.title || playablePlayingCue.src}`)
    } else {
      fadeOutThen(media, playablePlayingCue, audioTimersRef, () => {
        media.pause()
        setMediaStatus('Pausa')
      })
    }
  }

  const stopPlayback = () => {
    if (!playablePlayingCue) {
      setPlayingCueId('')
      activePlaybackRef.current = undefined
      setMediaStatus('Media fermati')
      return
    }
    const media = playablePlayingCue.type === 'video' ? videoRef.current : audioRef.current
    if (!media) return
    fadeOutThen(media, playablePlayingCue, audioTimersRef, () => {
      media.pause()
      media.currentTime = 0
      activePlaybackRef.current = undefined
      setPlayingCueId('')
      setMediaStatus('Media fermati')
    })
  }

  const restartPlayback = () => {
    const cue = stepCue ?? playablePlayingCue
    if (!cue) return
    clearAudioTimers(audioTimersRef)
    setPlayingCueId(cue.id)
    if (cue.type === 'image') {
      setMediaStatus(`Immagine visualizzata: ${cue.title || cue.src}`)
      onCueExecuted(cue.id)
      setPlayingCueId('')
      activePlaybackRef.current = undefined
      return
    }
    if (!isPlayableCue(cue)) return

    const mediaElement = cue.type === 'video' ? videoRef.current : audioRef.current
    if (!mediaElement) return
    const restartAsset = findTreeNode(media, cue.src)
    const restartAssetUrl = restartAsset ? mediaAssetUrl(restartAsset, projectRootPath) : undefined
    void prepareMediaForCue(mediaElement, cue, restartAssetUrl)
      .then((preparedSrc) => {
        if (mediaElement.src !== preparedSrc) return
        mediaElement.volume = cueTargetVolume(cue)
        scheduleCueEnd(mediaElement, cue, audioTimersRef)
        return mediaElement.play()
      })
      .then(() => {
        onCueExecuted(cue.id)
        setMediaStatus(`Riavviato: ${cue.title || cue.src}`)
      })
      .catch(() => setMediaStatus(`Cue pronto, avvio bloccato dal browser: ${cue.title || cue.src}`))
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation()
    if (event.key === 'ArrowRight') onNext()
    if (event.key === 'ArrowLeft') onPrevious()
    if (event.key === 'Home') onHome()
    if (event.key === 'End') onEnd()
    if (event.key === 'Escape') onClose()
    if (event.key === ' ') {
      event.preventDefault()
      togglePlayback()
    }
    if (event.key.toLowerCase() === 's') stopPlayback()
    if (event.key.toLowerCase() === 'r') restartPlayback()
  }

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') onNext()
      if (event.key === 'ArrowLeft') onPrevious()
      if (event.key === 'Home') onHome()
      if (event.key === 'End') onEnd()
      if (event.key === 'Escape') onClose()
      if (event.key === ' ') {
        event.preventDefault()
        togglePlayback()
      }
    }
    window.addEventListener('keydown', handleWindowKeyDown)
    return () => window.removeEventListener('keydown', handleWindowKeyDown)
  })

  return (
    <div className="fullscreen-view" tabIndex={0} onKeyDown={handleKeyDown}>
      <button type="button" className="exit-fullscreen" onClick={onClose} aria-label="Esci" title="Esci">
        <X size={18} />
      </button>
      <div className="fullscreen-content" data-density={density}>
        <p className="scene-label">{block?.sceneId ?? 'scena'}</p>
        <h2>{fullscreenLabel}</h2>
        {block?.type === 'table' ? (
          <FullscreenTable rows={block.tableRows ?? []} />
        ) : block?.type === 'section' ? (
          <h3 className="fullscreen-section-heading"><InlineMarkdownText text={fullscreenText} /></h3>
        ) : (
          <p><InlineMarkdownText text={fullscreenText} /></p>
        )}
        {visualCue && stepAssetUrl ? (
          <div className="fullscreen-media-stage" data-cue-type={visualCue.type}>
            {visualCue.type === 'image' ? (
              <img src={stepAssetUrl} alt={visualCue.title || stepAsset?.name || 'Cue immagine'} />
            ) : (
              <video
                ref={videoRef}
                src={stepAssetUrl}
                controls
                playsInline
                preload="auto"
              />
            )}
          </div>
        ) : null}
        {isCueStep && stepCue?.description ? <p className="fullscreen-cue-description">{stepCue.description}</p> : null}
        <div className="cue-strip">
          {stepCue ? (
            <span className={stepCue.id === playingCueId ? 'current-cue' : ''}>
              {cueLabel(stepCue)} {executedCueIds.includes(stepCue.id) ? 'eseguito' : 'in attesa'}
            </span>
          ) : null}
        </div>
        <p className="fullscreen-media-status">{mediaStatus}</p>
        <audio ref={audioRef} src={playingCue && isAudioCue(playingCue) ? playingAssetUrl : undefined} />
        <progress value={index + 1} max={Math.max(total, 1)} />
        <small>{index + 1} / {total}</small>
      </div>
    </div>
  )
}

function FullscreenTable({ rows }: { rows: NonNullable<PerformanceBlock['tableRows']> }) {
  const headerRows = rows.filter((row) => row.header)
  const bodyRows = rows.filter((row) => !row.header)

  return (
    <div className="fullscreen-table-wrap">
      <table className="fullscreen-table">
        {headerRows.length > 0 ? (
          <thead>
            {headerRows.map((row, rowIndex) => (
              <tr key={`head-${rowIndex}`}>
                {row.cells.map((cell, cellIndex) => <th key={`${rowIndex}-${cellIndex}`}><InlineMarkdownText text={cell} /></th>)}
              </tr>
            ))}
          </thead>
        ) : null}
        <tbody>
          {bodyRows.map((row, rowIndex) => (
            <tr key={`body-${rowIndex}`}>
              {row.cells.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}><InlineMarkdownText text={cell} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const fullscreenBlockLabel = (block: PerformanceBlock | undefined, isCueStep: boolean) => {
  if (isCueStep) return 'CUE'
  if (!block) return 'COPIONE'
  if (block.type === 'section') return `H${block.headingLevel ?? 3}`
  if (block.type === 'table') return 'TABELLA'
  if (block.type === 'title') return 'TITOLO'
  if (block.type === 'scene') return 'SCENA'
  return block.characterId?.toUpperCase() ?? 'COPIONE'
}

const mediaKind = (mime: string, name: string): MediaAsset['kind'] => {
  if (mime.startsWith('audio/')) return name.toLowerCase().includes('music') ? 'music' : 'audio'
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  const lower = name.toLowerCase()
  if (/\.(png|jpe?g|webp|gif|avif)$/.test(lower)) return 'image'
  if (/\.(mp4|mov|webm|m4v)$/.test(lower)) return 'video'
  return 'audio'
}

const isAudioCue = (cue?: MediaCue): cue is MediaCue & { type: 'audio' | 'music' } =>
  Boolean(cue && (cue.type === 'audio' || cue.type === 'music'))

const isPlayableCue = (cue?: MediaCue): cue is MediaCue & { type: 'audio' | 'music' | 'video' } =>
  Boolean(cue && (cue.type === 'audio' || cue.type === 'music' || cue.type === 'video'))

const isVisualCue = (cue?: MediaCue): cue is MediaCue & { type: 'image' | 'video' } =>
  Boolean(cue && (cue.type === 'image' || cue.type === 'video'))

const mediaAssetUrl = (asset: MediaAsset, projectRootPath: string) => {
  if (asset.objectUrl) return asset.objectUrl
  if (asset.kind === 'folder') return undefined
  if (asset.sourcePath && !hasProjectStorageRoot(projectRootPath)) return asset.sourcePath

  if (isTauriRuntime() && projectRootPath) {
    return convertTauriFileSrc(projectFilePath(projectRootPath, asset.path))
  }

  if (isLocalDevRuntime()) {
    return `/__project-storage/media?path=${encodeURIComponent(asset.path)}`
  }

  return undefined
}

const hasProjectStorageRoot = (projectRootPath: string) =>
  Boolean(projectRootPath && projectRootPath !== '/progetto')

const projectFilePath = (rootPath: string, assetPath: string) => {
  const separator = rootPath.includes('\\') ? '\\' : '/'
  const cleanRoot = rootPath.replace(/[\\/]+$/, '')
  const cleanAssetPath = assetPath.replace(/^\/+/, '').split('/').join(separator)
  return `${cleanRoot}${separator}${cleanAssetPath}`
}

const convertTauriFileSrc = (filePath: string) => {
  const tauri = (window as Window & {
    __TAURI_INTERNALS__?: { convertFileSrc?: (path: string, protocol?: string) => string }
  }).__TAURI_INTERNALS__
  return tauri?.convertFileSrc?.(filePath, 'asset') ?? filePath
}

const waitForMediaReady = (media: HTMLMediaElement, readyState: number, timeoutMs = 1400) => {
  if (media.readyState >= readyState) return Promise.resolve()

  return new Promise<void>((resolve) => {
    let timeout = 0
    const events = ['loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough', 'error', 'stalled']
    const cleanup = () => {
      if (timeout) window.clearTimeout(timeout)
      for (const eventName of events) media.removeEventListener(eventName, done)
    }
    const done = () => {
      cleanup()
      resolve()
    }

    for (const eventName of events) media.addEventListener(eventName, done, { once: true })
    timeout = window.setTimeout(done, timeoutMs)
  })
}

const prepareMediaForCue = async (media: HTMLMediaElement, cue: MediaCue, assetUrl?: string) => {
  if (assetUrl && media.src !== assetUrl) {
    media.src = assetUrl
    media.load()
  } else if (!media.src || media.readyState === 0) {
    media.load()
  }

  const preparedSrc = media.src
  await waitForMediaReady(media, 1)
  const startAt = Math.max(0, cue.options.startAt ?? 0)
  if (Number.isFinite(startAt) && Math.abs(media.currentTime - startAt) > 0.05) {
    media.currentTime = startAt
    await waitForMediaReady(media, 2)
  }
  await waitForMediaReady(media, 2)
  return preparedSrc
}

const updateInstallErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error.trim()) return error
  try {
    return JSON.stringify(error)
  } catch {
    return 'Errore sconosciuto durante download o installazione'
  }
}

const clearAudioTimers = (timersRef: MutableRefObject<number[]>) => {
  for (const timer of timersRef.current) {
    window.clearInterval(timer)
    window.clearTimeout(timer)
  }
  timersRef.current = []
}

const cueTargetVolume = (cue: MediaCue) => Math.max(0, Math.min(1, (cue.options.volume ?? 70) / 100))

const fadeAudioVolume = (
  audio: HTMLMediaElement,
  targetVolume: number,
  durationSeconds: number,
  timersRef: MutableRefObject<number[]>,
  onComplete?: () => void,
) => {
  if (durationSeconds <= 0) {
    audio.volume = targetVolume
    onComplete?.()
    return
  }

  const startVolume = audio.volume
  const steps = 14
  const intervalMs = Math.max(60, (durationSeconds * 1000) / steps)
  let step = 0
  const interval = window.setInterval(() => {
    step += 1
    const progress = Math.min(1, step / steps)
    audio.volume = Math.max(0, Math.min(1, startVolume + ((targetVolume - startVolume) * progress)))
    if (progress >= 1) {
      window.clearInterval(interval)
      timersRef.current = timersRef.current.filter((timer) => timer !== interval)
      onComplete?.()
    }
  }, intervalMs)
  timersRef.current.push(interval)
}

const fadeOutThen = (
  audio: HTMLMediaElement,
  cue: MediaCue | undefined,
  timersRef: MutableRefObject<number[]>,
  onComplete: () => void,
) => {
  clearAudioTimers(timersRef)
  fadeAudioVolume(audio, 0, cue?.options.fadeOut ?? 0, timersRef, onComplete)
}

const scheduleCueEnd = (
  audio: HTMLMediaElement,
  cue: MediaCue,
  timersRef: MutableRefObject<number[]>,
  onComplete?: () => void,
) => {
  const startAt = cue.options.startAt ?? 0
  const endAt = cue.options.endAt ?? (cue.options.duration ? startAt + cue.options.duration : undefined)
  if (!endAt || endAt <= audio.currentTime) return

  const fadeOut = Math.max(0, cue.options.fadeOut ?? 0)
  const delayMs = Math.max(0, (endAt - audio.currentTime - fadeOut) * 1000)
  const timeout = window.setTimeout(() => {
    fadeAudioVolume(audio, 0, fadeOut, timersRef, () => {
      audio.pause()
      audio.currentTime = endAt
      onComplete?.()
    })
  }, delayMs)
  timersRef.current.push(timeout)
}

const stripMarkdownExtension = (name: string) => name.replace(/\.md$/i, '')

type PdfBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'note'; title: string; content: string }
  | { type: 'cue'; title: string; content: string }
  | { type: 'table'; rows: string[][] }

type PdfInlineSegment = {
  text: string
  bold: boolean
}

const markdownToPdfBlocks = (markdown: string, mode: 'complete' | 'clean'): PdfBlock[] => {
  const source = mode === 'clean' ? cleanScriptMarkdown(markdown) : markdown
  const lines = source.split('\n')
  const blocks: PdfBlock[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const trimmed = line.trim()
    if (!trimmed) continue

    const directive = trimmed.match(/^::(regia|media)\{([^}]*)\}/)
    if (directive) {
      const directiveType = directive[1]
      const attrs = directive[2]
      const contentLines: string[] = []
      index += 1
      while (index < lines.length && lines[index].trim() !== '::') {
        contentLines.push(lines[index])
        index += 1
      }
      if (mode === 'complete') {
        const title =
          readDirectiveAttr(attrs, 'title') ||
          readDirectiveAttr(attrs, directiveType === 'regia' ? 'type' : 'src') ||
          (directiveType === 'regia' ? 'Nota regia' : 'Cue')
        blocks.push({
          type: directiveType === 'regia' ? 'note' : 'cue',
          title,
          content: contentLines.join('\n').trim(),
        })
      }
      continue
    }

    if (isPdfTableStart(lines, index)) {
      const rows: string[][] = []
      rows.push(splitPdfTableRow(lines[index]))
      index += 2
      while (index < lines.length && isPdfTableRow(lines[index])) {
        rows.push(splitPdfTableRow(lines[index]))
        index += 1
      }
      index -= 1
      blocks.push({ type: 'table', rows })
      continue
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] })
      continue
    }

    if (/^> ?/.test(line)) {
      const quoteLines: string[] = []
      while (index < lines.length && /^> ?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^> ?/, '').trim())
        index += 1
      }
      index -= 1
      blocks.push({ type: 'quote', text: quoteLines.join('\n') })
      continue
    }

    blocks.push({ type: 'paragraph', text: trimmed })
  }

  return blocks
}

const readDirectiveAttr = (attrs: string, name: string) => {
  const match = attrs.match(new RegExp(`${name}="([^"]*)"`, 'i'))
  return match?.[1]
}

const downloadPdf = async (name: string, markdown: string, title: string, mode: 'complete' | 'clean'): Promise<ExportResult> => {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const marginX = 56
  const marginTop = 58
  const marginBottom = 76
  const maxWidth = doc.internal.pageSize.getWidth() - (marginX * 2)
  const pageBottom = doc.internal.pageSize.getHeight() - marginBottom
  const generatedAt = new Date()
  let y = marginTop

  doc.setProperties({ title })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(title, doc.internal.pageSize.getWidth() / 2, y, { align: 'center' })
  y += 30

  for (const block of markdownToPdfBlocks(markdown, mode)) {
    if (block.type === 'heading') {
      const style = pdfHeadingStyle(block.level)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(style.size)
      doc.setTextColor(style.color)
      const lines = doc.splitTextToSize(stripInlineMarkdown(block.text), maxWidth) as string[]
      for (const line of lines) {
        y = ensurePdfSpace(doc, y, pageBottom, marginTop, style.lineHeight)
        doc.text(line, doc.internal.pageSize.getWidth() / 2, y, { align: 'center' })
        y += style.lineHeight
      }
      y += style.after
      continue
    }

    if (block.type === 'table') {
      y = drawPdfTable(doc, block.rows, marginX, y, maxWidth, pageBottom, marginTop)
      y += 14
      continue
    }

    if (block.type === 'note') {
      y = drawPdfNoteBox(doc, block, marginX, y, maxWidth, pageBottom, marginTop)
      y += 12
      continue
    }

    if (block.type === 'cue') {
      y = drawPdfInlineBlock(doc, `[CUE: ${block.title}]${block.content ? ` ${block.content}` : ''}`, marginX, y, maxWidth, pageBottom, marginTop, {
        size: 10,
        lineHeight: 14,
        bold: true,
        color: '#4b5563',
      })
      y += 6
      continue
    }

    if (block.type === 'quote') {
      y = drawPdfQuoteBox(doc, block.text, marginX, y, maxWidth, pageBottom, marginTop)
      y += 10
      continue
    }

    y = drawPdfInlineBlock(doc, block.text, marginX, y, maxWidth, pageBottom, marginTop, {
      size: 11,
      lineHeight: 16,
      bold: false,
      color: '#222222',
    })
    y += 4
  }

  stampPdfPages(doc, marginX, generatedAt)

  const blob = doc.output('blob') as Blob

  if (isTauriRuntime()) {
    const { invoke } = await import('@tauri-apps/api/core')
    const filePath = await invoke<string>('save_pdf_to_downloads', {
      fileName: name,
      dataBase64: await blobToBase64(blob),
    })
    return {
      fileName: name,
      filePath,
      location: filePath,
    }
  }

  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  return {
    fileName: name,
    objectUrl,
    location: `cartella Download predefinita del browser (${name})`,
  }
}

const blobToBase64 = async (blob: Blob) => {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return window.btoa(binary)
}

const pdfHeadingStyle = (level: number) => {
  if (level === 1) return { size: 20, lineHeight: 25, after: 10, color: '#111111' }
  if (level === 2) return { size: 16, lineHeight: 21, after: 8, color: '#1f2937' }
  if (level === 3) return { size: 13, lineHeight: 18, after: 7, color: '#374151' }
  return { size: 11, lineHeight: 16, after: 5, color: '#4b5563' }
}

const stampPdfPages = (doc: JsPDF, marginX: number, generatedAt: Date) => {
  const pageCount = doc.getNumberOfPages()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const stampY = pageHeight - 34
  const stampText = `Generato il ${formatPdfGeneratedAt(generatedAt)} con StageDesk Pro`
  const separator = ' - '

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber)
    doc.setDrawColor(226, 232, 240)
    doc.line(marginX, stampY - 16, pageWidth - marginX, stampY - 16)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor('#64748b')
    doc.text(stampText, marginX, stampY)
    const separatorX = marginX + doc.getTextWidth(stampText)
    doc.text(separator, separatorX, stampY)
    const linkX = separatorX + doc.getTextWidth(separator)
    doc.setTextColor('#2563eb')
    doc.text(STAGEDESK_SITE_URL, linkX, stampY)
    doc.link(linkX, stampY - 8, doc.getTextWidth(STAGEDESK_SITE_URL), 10, { url: STAGEDESK_SITE_URL })
  }
}

const formatPdfGeneratedAt = (date: Date) =>
  new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date)

const drawPdfNoteBox = (
  doc: JsPDF,
  block: Extract<PdfBlock, { type: 'note' }>,
  x: number,
  y: number,
  width: number,
  pageBottom: number,
  marginTop: number,
) => {
  const padding = 10
  const titleHeight = 15
  const lines = doc.splitTextToSize(block.content || ' ', width - (padding * 2)) as string[]
  const boxHeight = padding + titleHeight + Math.max(lines.length, 1) * 14 + padding
  y = ensurePdfSpace(doc, y, pageBottom, marginTop, boxHeight)
  doc.setDrawColor(148, 163, 184)
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(x, y, width, boxHeight, 4, 4, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor('#334155')
  doc.text(`Nota regia: ${block.title}`, x + padding, y + padding + 9)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor('#1f2937')
  let textY = y + padding + titleHeight + 10
  for (const line of lines) {
    doc.text(line, x + padding, textY)
    textY += 14
  }
  return y + boxHeight
}

const drawPdfQuoteBox = (
  doc: JsPDF,
  text: string,
  x: number,
  y: number,
  width: number,
  pageBottom: number,
  marginTop: number,
) => {
  const paddingX = 14
  const paddingY = 10
  const lineHeight = 15
  const content = stripInlineMarkdown(text).split('\n').join(' ')
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(10.5)
  const lines = doc.splitTextToSize(content || ' ', width - (paddingX * 2) - 8) as string[]
  const boxHeight = (paddingY * 2) + (Math.max(lines.length, 1) * lineHeight)
  y = ensurePdfSpace(doc, y, pageBottom, marginTop, boxHeight)

  doc.setDrawColor(209, 213, 219)
  doc.setFillColor(249, 250, 251)
  doc.roundedRect(x, y, width, boxHeight, 4, 4, 'FD')
  doc.setFillColor(124, 92, 255)
  doc.rect(x, y, 4, boxHeight, 'F')
  doc.setTextColor('#374151')

  let textY = y + paddingY + 10
  for (const line of lines) {
    doc.text(line, x + paddingX, textY)
    textY += lineHeight
  }

  doc.setFont('helvetica', 'normal')
  return y + boxHeight
}

const drawPdfTable = (
  doc: JsPDF,
  rows: string[][],
  x: number,
  y: number,
  width: number,
  pageBottom: number,
  marginTop: number,
) => {
  const columnCount = Math.max(...rows.map((row) => row.length), 1)
  const columnWidth = width / columnCount
  const lineHeight = 13
  const padding = 7

  for (const [rowIndex, row] of rows.entries()) {
    const wrapped = Array.from({ length: columnCount }, (_, columnIndex) =>
      doc.splitTextToSize(stripInlineMarkdown(row[columnIndex] ?? ''), columnWidth - (padding * 2)) as string[],
    )
    const rowHeight = Math.max(26, (Math.max(...wrapped.map((lines) => lines.length), 1) * lineHeight) + (padding * 2))
    y = ensurePdfSpace(doc, y, pageBottom, marginTop, rowHeight)
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const cellX = x + (columnIndex * columnWidth)
      doc.setDrawColor(203, 213, 225)
      doc.setFillColor(rowIndex === 0 ? 241 : 255, rowIndex === 0 ? 245 : 255, rowIndex === 0 ? 249 : 255)
      doc.rect(cellX, y, columnWidth, rowHeight, 'FD')
      doc.setFont('helvetica', rowIndex === 0 ? 'bold' : 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor('#1f2937')
      let textY = y + padding + 10
      for (const line of wrapped[columnIndex]) {
        doc.text(line, cellX + padding, textY)
        textY += lineHeight
      }
    }
    y += rowHeight
  }

  return y
}

const drawPdfInlineBlock = (
  doc: JsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  pageBottom: number,
  marginTop: number,
  style: { size: number; lineHeight: number; bold: boolean; color: string },
) => {
  doc.setFontSize(style.size)
  doc.setTextColor(style.color)
  const lines = wrapPdfInlineSegments(doc, parseInlineMarkdown(text), maxWidth)
  for (const line of lines) {
    y = ensurePdfSpace(doc, y, pageBottom, marginTop, style.lineHeight)
    let cursorX = x
    for (const segment of line) {
      doc.setFont('helvetica', segment.bold || style.bold ? 'bold' : 'normal')
      doc.text(segment.text, cursorX, y)
      cursorX += doc.getTextWidth(segment.text)
    }
    y += style.lineHeight
  }
  return y
}

const ensurePdfSpace = (
  doc: JsPDF,
  y: number,
  pageBottom: number,
  marginTop: number,
  neededHeight: number,
) => {
  if (y + neededHeight <= pageBottom) return y
  doc.addPage()
  return marginTop
}

const parseInlineMarkdown = (text: string): PdfInlineSegment[] => {
  const segments: PdfInlineSegment[] = []
  const readableText = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
  const parts = readableText.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  for (const part of parts) {
    const bold = part.startsWith('**') && part.endsWith('**')
    segments.push({ text: bold ? part.slice(2, -2) : part, bold })
  }
  return segments
}

const wrapPdfInlineSegments = (
  doc: JsPDF,
  segments: PdfInlineSegment[],
  maxWidth: number,
) => {
  const lines: PdfInlineSegment[][] = [[]]
  let lineWidth = 0

  for (const segment of segments) {
    const words = segment.text.split(/(\s+)/).filter(Boolean)
    for (const word of words) {
      doc.setFont('helvetica', segment.bold ? 'bold' : 'normal')
      const wordWidth = doc.getTextWidth(word)
      if (lineWidth > 0 && lineWidth + wordWidth > maxWidth) {
        lines.push([])
        lineWidth = 0
      }
      lines[lines.length - 1].push({ text: word, bold: segment.bold })
      lineWidth += wordWidth
    }
  }

  return lines
}

const stripInlineMarkdown = (text: string) =>
  text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')

const isPdfTableStart = (lines: string[], index: number) =>
  isPdfTableRow(lines[index]) && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1] ?? '')

const isPdfTableRow = (line = '') => /^\s*\|.+\|\s*$/.test(line)

const splitPdfTableRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())

function InlineMarkdownText({ text }: { text: string }) {
  return (
    <>
      {parseInlineMarkdown(text).map((segment, index) =>
        segment.bold ? <strong key={index}>{segment.text}</strong> : <span key={index}>{segment.text}</span>,
      )}
    </>
  )
}

export default App
