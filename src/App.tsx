import type { Editor } from '@tiptap/core'
import { DOMParser as ProseMirrorDOMParser, type Node as ProseMirrorNode } from '@tiptap/pm/model'
import { NodeSelection, Selection } from '@tiptap/pm/state'
import { insertPoint } from '@tiptap/pm/transform'
import type { EditorView } from '@tiptap/pm/view'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { TableKit } from '@tiptap/extension-table'
import type { jsPDF as JsPDF } from 'jspdf'
import QRCode from 'qrcode'
import {
  BookOpen,
  Bookmark,
  Bold,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  CloudCheck,
  CloudOff,
  CloudUpload,
  Copy,
  Download,
  Drama,
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
  ChevronLeft,
  List,
  ListOrdered,
  ListTree,
  Minus,
  MoreVertical,
  PanelLeft,
  PanelRight,
  Pencil,
  Pause,
  Play,
  Plus,
  Quote,
  Redo2,
  RefreshCw,
  PanelTopClose,
  Rows3,
  Search,
  SkipBack,
  SkipForward,
  Square,
  Table2,
  Trash2,
  Type,
  Undo2,
  Upload,
  LogOut,
  X,
} from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  CSSProperties,
  ChangeEvent,
  Dispatch,
  DragEvent as ReactDragEvent,
  MouseEvent as ReactMouseEvent,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
} from 'react'
import './App.css'
import { appDocumentContent, fetchAppDocumentContent, getAppDocument, isAppDocumentPath } from './appDocs'
import { supabase } from './auth'
import { useAuth } from './authContext'
import { SCRIPT_ROOT_PATH } from './domain'
import type { DirectorNote, MediaAsset, MediaCue, NotePanelMode, NoteType, Project, ProjectTreeNode } from './domain'
import { blankProject } from './defaultProject'
import {
  cleanScriptMarkdown,
  cueLabel,
  findMarkdownNode,
  flattenMarkdownFiles,
  hasMarkdownTable,
  markdownToHtml,
  normalizeEditorMarkdownSpacing,
  parseScriptBlocks,
  serializeExtendedMarkdown,
  slug,
} from './markdown'
import { ScriptChip } from './scriptChip'
import { sanitizeChipLabel } from './chipText'
import { ScriptDialogue } from './scriptDialogue'
import { ScriptNote } from './scriptNote'
import { browserProjectStorage, readBrowserMediaAssetObjectUrl } from './storage'
import type { ProjectEntry } from './storage'
import { diagnosticLog } from './diagnostics'

const storage = browserProjectStorage
const MEDIA_PATH_DND_TYPE = 'application/x-stagedesk-media-path'
const CUE_ID_DND_TYPE = 'application/x-stagedesk-cue-id'
const NOTE_ID_DND_TYPE = 'application/x-stagedesk-note-id'
const DIALOGUE_ID_DND_TYPE = 'application/x-stagedesk-dialogue-id'
const MEDIA_PATH_DND_PREFIX = 'stagedesk-media:'
const CUE_ID_DND_PREFIX = 'stagedesk-cue:'
const NOTE_ID_DND_PREFIX = 'stagedesk-note:'
const DIALOGUE_ID_DND_PREFIX = 'stagedesk-dialogue:'
const INSTALLED_UPDATE_VERSION_KEY = 'stagedesk-installed-update-version'
const STAGEDESK_SITE_URL = 'https://stagedesk-pro.aigconsulting.it'
const STAGEDESK_DRAG_STATE_KEY = '__STAGEDESK_DRAG_PAYLOAD__'
const POINTER_DRAGGING_CLASS = 'stagedesk-pointer-dragging'
const POINTER_EDITOR_TARGET_CLASS = 'stagedesk-pointer-editor-target'
const POINTER_MEDIA_TARGET_CLASS = 'drop-target'
const STOP_PREVIEW_PLAYBACK_EVENT = 'stagedesk-stop-preview-playback'
const STOP_EDITOR_PLAYBACK_EVENT = 'stagedesk-stop-editor-playback'
const UI_STATE_STORAGE_KEY = 'stagedesk-pro.ui-state'
const WINDOW_STATE_STORAGE_KEY = 'stagedesk-pro.window-state'
const PLAYBACK_LOG_STORAGE_KEY = 'stagedesk-pro.playback-log'
const PLAYBACK_LOG_VERSION = 2
const PLAYBACK_SESSION_ID = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : `playback-${Date.now()}-${Math.random().toString(36).slice(2)}`
const SCRIPT_SHARE_TABLE = 'script_shares'
const SCRIPT_SHARE_BUCKET = 'published-scripts'
const SHARE_PIN_STORAGE_PREFIX = 'stagedesk-share-pin:'
const SHARE_URL_BASE = 'https://stagedesk-pro.aigconsulting.it/share'
const SHARED_SCRIPT_NOTE_TYPES = ['movement', 'position', 'characters', 'tone'] as const
const CUE_PAGE_SIZE = 5
const STORE_TAB_PATH = 'web://stagedesk-store'
const STORE_URL = 'https://stagedesk-pro.aigconsulting.it/store/'
type EditorCueState = 'playing' | 'paused' | 'stopped'
type EditorCueStateWindow = Window & {
  __STAGEDESK_EDITOR_CUE_STATE__?: { id: string; state: EditorCueState }
}
type CharacterOption = {
  id: string
  name: string
}
type PublishedScriptDialogue = {
  id: string
  characterId: string
  characterName: string
  sceneId?: string
  text: string
  sourceLine?: number
}
type PublishedScriptCharacter = CharacterOption & {
  dialogues: PublishedScriptDialogue[]
}
type PublishedScriptNote = {
  id: string
  type: string
  title: string
  content: string
  sceneId?: string
  sourceLine?: number
}
type PublishedScriptPayload = {
  schemaVersion: 1
  app: 'StageDesk Pro'
  project: {
    id: string
    name: string
  }
  script: {
    path: string
    name: string
  }
  publishedAt: string
  characters: PublishedScriptCharacter[]
  dialogues: PublishedScriptDialogue[]
  notes: PublishedScriptNote[]
}
type PublishState = {
  status: 'idle' | 'publishing' | 'published' | 'removing' | 'error'
  url?: string
  shareUid?: string
  storagePath?: string
  pin?: string
  pinAvailable?: boolean
  publishedAt?: string
  error?: string
}
type ShareIndicatorState = {
  status: 'disabled' | 'checking' | 'shared' | 'not-shared' | 'error'
  url?: string
  message?: string
}
type CharacterOptionsWindow = Window & {
  __STAGEDESK_CHARACTER_OPTIONS__?: CharacterOption[]
}
type StopPreviewPlaybackDetail = {
  sourceId?: string
}
type PlaybackLogEntry = {
  version?: number
  sessionId?: string
  repeatCount?: number
  timestamp: string
  scope: 'preview' | 'editor' | 'fullscreen' | 'native'
  action: string
  cueId?: string
  cueType?: MediaCue['type']
  label?: string
  details?: Record<string, unknown>
}
type PlaybackLogWindow = Window & {
  __STAGEDESK_PLAYBACK_LOGS__?: PlaybackLogEntry[]
}
type PreviewStopReason = 'user' | 'global-playback-switch' | 'component-unmount'
type StagedeskDragPayload = {
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
type StagedeskDragWindow = Window & {
  __STAGEDESK_DRAG_PAYLOAD__?: StagedeskDragPayload
}
type ExportResult = {
  fileName: string
  location: string
  objectUrl?: string
  filePath?: string
}
type ScriptValidationIssue = {
  id: string
  line: number
  lineText: string
  type: string
  message: string
  highlight: string
  severity: 'error' | 'warning'
}
type PointerDropTarget =
  | { kind: 'editor'; position: number; element: HTMLElement }
  | { kind: 'media'; folderPath: string; element: HTMLElement }
type InternalDragEvent = PointerEvent | MouseEvent
type PointerDragPreview = {
  x: number
  y: number
  label: string
  detail?: string
  tone: 'cue' | 'note' | 'media'
}
type PointerDropIndicator = {
  x: number
  y: number
  width: number
  label: string
}

type PersistedUiState = {
  projectId: string
  activePath: string
  openTabs: string[]
  selectedScriptPath: string
  selectedMediaPath: string
  expandedPaths: string[]
  leftTab: 'outline' | 'script' | 'media' | 'bookmarks'
  editorSelection?: number
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
  const fileTabbarRef = useRef<HTMLDivElement>(null)
  const [fileTabOverflow, setFileTabOverflow] = useState({ left: false, right: false })
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [selectedScriptPath, setSelectedScriptPath] = useState(activePath)
  const [selectedMediaPath, setSelectedMediaPath] = useState(project.media[0]?.path ?? '/media')
  const [expandedPaths, setExpandedPaths] = useState<string[]>([
    SCRIPT_ROOT_PATH,
    '/media',
    ...project.media.map((asset) => asset.path),
  ])
  const [leftTab, setLeftTab] = useState<'outline' | 'script' | 'media' | 'bookmarks'>('outline')
  const [noteMode, setNoteMode] = useState<NotePanelMode>('context')
  const [cuePage, setCuePage] = useState(0)
  const cuePageRef = useRef(cuePage)
  cuePageRef.current = cuePage
  const [, setSelectedNoteId] = useState(project.notes[0]?.id ?? '')
  const [selectedNoteTypeId, setSelectedNoteTypeId] = useState(initialNoteTypeId)
  const [selectedCueId, setSelectedCueId] = useState(project.cues[0]?.id ?? '')
  const [search, setSearch] = useState('')
  const [isFullscreen, setFullscreen] = useState(false)
  const [fullscreenIndex, setFullscreenIndex] = useState(0)
  const [fullscreenBlocks, setFullscreenBlocks] = useState<PerformanceBlock[]>([])
  const [executedCueIds, setExecutedCueIds] = useState<string[]>([])
  const [storageStatus, setStorageStatus] = useState('Storage locale browser')
  const [toastMessage, setToastMessage] = useState('')
  const [exportResult, setExportResult] = useState<ExportResult | undefined>()
  const [installedUpdateVersion, setInstalledUpdateVersion] = useState('')
  const [remoteAppDocuments, setRemoteAppDocuments] = useState<Record<string, string>>({})
  const [desktopStorageReady, setDesktopStorageReady] = useState(false)
  const [startupProjectReady, setStartupProjectReady] = useState(false)
  const [scriptValidationIssues, setScriptValidationIssues] = useState<ScriptValidationIssue[]>([])
  const [pointerDragPreview, setPointerDragPreview] = useState<PointerDragPreview | undefined>()
  const [pointerDropIndicator, setPointerDropIndicator] = useState<PointerDropIndicator | undefined>()
  const updateCheckStartedRef = useRef(false)
  const updateInstallInProgressRef = useRef(false)
  const startupProjectLoadedRef = useRef(false)
  const startupProjectReadyRef = useRef(false)
  const startupUserEditedRef = useRef(false)
  const toastTimeoutRef = useRef<number | undefined>(undefined)
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve())
  const pendingEditorSelectionRef = useRef<number | undefined>(undefined)
  const fullscreenReturnBlockRef = useRef<ReturnType<typeof parseScriptBlocks>[number] | undefined>(undefined)
  const [scriptDialog, setScriptDialog] = useState<ScriptActionDialog | undefined>()
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [publishState, setPublishState] = useState<PublishState>({ status: 'idle' })
  const [shareIndicators, setShareIndicators] = useState<Record<string, ShareIndicatorState>>({})
  const [theaterMenuOpen, setTheaterMenuOpen] = useState(false)
  const [theaterMenuPosition, setTheaterMenuPosition] = useState<{ top: number; left: number } | undefined>()
  const [tableMenuOpen, setTableMenuOpen] = useState(false)
  const [tableMenuPosition, setTableMenuPosition] = useState<{ top: number; left: number } | undefined>()
  const [tableInsertMenuOpen, setTableInsertMenuOpen] = useState(false)
  const [tableInsertMenuPosition, setTableInsertMenuPosition] = useState<{ top: number; left: number } | undefined>()
  const [tableInsertSize, setTableInsertSize] = useState({ rows: 3, cols: 3 })
  const [appMenuOpen, setAppMenuOpen] = useState(false)
  const [appMenuPosition, setAppMenuPosition] = useState<{ top: number; left: number } | undefined>()
  const [projectPickerOpen, setProjectPickerOpen] = useState(false)
  const [projectPickerEntries, setProjectPickerEntries] = useState<ProjectEntry[]>([])
  const [storeLoading, setStoreLoading] = useState(false)
  const [toolbarState, setToolbarState] = useState<ToolbarState>(emptyToolbarState)
  const [tableContextActive, setTableContextActive] = useState(false)
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
  const [currentEditorCueRefIds, setCurrentEditorCueRefIds] = useState<string[]>([])

  const markdownFiles = useMemo(() => flattenMarkdownFiles(project.scripts), [project.scripts])
  const activeFile = useMemo(() => findMarkdownNode(project.scripts, activePath), [activePath, project.scripts])
  const activeAppDocument = useMemo(() => getAppDocument(activePath), [activePath])
  const activeStoreTab = activePath === STORE_TAB_PATH
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
  const activeMarkdown = activeStoreTab
    ? ''
    : activeAppDocument
    ? activeAppDocumentMarkdown
    : drafts[activePath] ?? activeFile?.content ?? ''
  const [editorMarkdown, setEditorMarkdown] = useState(activeMarkdown)
  const activeCharacterMarkdown = activeAppDocument || activeStoreTab ? activeMarkdown : editorMarkdown || activeMarkdown
  const activeCharacters = useMemo(
    () => charactersFromMarkdown(activeCharacterMarkdown, project.characters),
    [activeCharacterMarkdown, project.characters],
  )
  const activeCueRefIds = useMemo(
    () => uniqueValues([...markerRefIdsFromMarkdown(activeMarkdown, 'cue'), ...editorCueRefIds]),
    [activeMarkdown, editorCueRefIds],
  )
  const blocks = useMemo(() => parseScriptBlocks(activeMarkdown), [activeMarkdown])
  const performanceBlocks = useMemo(
    () => assignCueBlocks(blocks.filter((block) => isFullscreenBlock(block.type)), project.cues, activePath, activeCueRefIds),
    [activeCueRefIds, activePath, blocks, project.cues],
  )
  const activePerformanceBlocks = isFullscreen && fullscreenBlocks.length > 0 ? fullscreenBlocks : performanceBlocks
  const currentBlock = activePerformanceBlocks[fullscreenIndex] ?? activePerformanceBlocks[0]
  const currentScene = isFullscreen ? currentBlock?.sceneId ?? activeEditorSceneId : activeEditorSceneId
  const selectedNoteType =
    project.noteTypes.find((noteType) => noteType.id === selectedNoteTypeId) ?? defaultNoteType(project.noteTypes)
  const noteMenuTypes = useMemo(() => {
    const general = project.noteTypes.find((noteType) => noteType.id === 'general')
    const remaining = project.noteTypes.filter((noteType) => noteType.id !== 'general')
    return general ? [general, ...remaining] : remaining
  }, [project.noteTypes])
  const selectedMediaIsProtectedRoot = selectedMediaNode ? isProtectedMediaRoot(selectedMediaNode) : false
  const activeFilePath = activeFile?.path ?? ''
  const userEmail = user?.email ?? 'Utente autenticato'
  const activeCharactersRef = useRef(activeCharacters)
  const currentSceneRef = useRef(currentScene)
  const draftsRef = useRef(drafts)
  const projectRef = useRef(project)
  const projectScriptsRef = useRef(project.scripts)
  const activeFilePathRef = useRef(activeFilePath)
  const activePathRef = useRef(activePath)
  const openTabsRef = useRef(openTabs)
  const selectedScriptPathRef = useRef(selectedScriptPath)
  const selectedMediaPathRef = useRef(selectedMediaPath)
  const expandedPathsRef = useRef(expandedPaths)
  const leftTabRef = useRef(leftTab)
  const appLifecycleStateRef = useRef<Record<string, unknown>>({})
  const cueDropActionsRef = useRef({
    insertExistingCue: (_cue: MediaCue, _position: number) => {},
    createCueFromAsset: (_asset: MediaAsset, _position: number) => {},
  })
  projectScriptsRef.current = project.scripts
  projectRef.current = project
  activeFilePathRef.current = activeFilePath
  activePathRef.current = activePath
  openTabsRef.current = openTabs
  selectedScriptPathRef.current = selectedScriptPath
  selectedMediaPathRef.current = selectedMediaPath
  expandedPathsRef.current = expandedPaths
  leftTabRef.current = leftTab
  activeCharactersRef.current = activeCharacters
  currentSceneRef.current = currentScene
  appLifecycleStateRef.current = {
    projectId: project.id,
    activePath,
    openTabs,
    leftTab,
    selectedScriptPath,
    selectedMediaPath,
    noteMode,
    currentScene,
  }

  useEffect(() => {
    diagnosticLog('app-mounted', appLifecycleStateRef.current)
    return () => diagnosticLog('app-unmounted', appLifecycleStateRef.current)
  }, [])
  const lastEditorSelectionRef = useRef<number | undefined>(undefined)
  const editorAudioRef = useRef<HTMLAudioElement | null>(null)
  const editorAudioTimersRef = useRef<number[]>([])
  const editorPlayingCueRef = useRef<{ id: string; state: 'playing' | 'paused' } | undefined>(undefined)
  const editorHadFocusBeforeWindowBlurRef = useRef(false)
  const theaterMenuRef = useRef<HTMLDivElement>(null)
  const tableMenuRef = useRef<HTMLDivElement>(null)
  const tableInsertMenuRef = useRef<HTMLDivElement>(null)
  const appMenuRef = useRef<HTMLDivElement>(null)
  const pointerDropTargetRef = useRef<PointerDropTarget | undefined>(undefined)
  const moveMediaNodeRef = useRef<(sourcePath: string, targetFolderPath: string) => Promise<void>>(async () => undefined)
  const fileNotes = useMemo(
    () => project.notes.filter((note) => note.filePath === activePath),
    [activePath, project.notes],
  )
  const fileCues = useMemo(
    () => project.cues.filter((cue) => cue.filePath === activePath && activeCueRefIds.includes(cue.id)),
    [activeCueRefIds, activePath, project.cues],
  )
  const chipInspectorRef = useRef({ notes: fileNotes, cues: fileCues })

  const setShareIndicatorForPath = useCallback((path: string, state: ShareIndicatorState) => {
    setShareIndicators((current) => ({ ...current, [path]: state }))
  }, [])

  const showStatus = useCallback((message: string, duration = 3600) => {
    setStorageStatus(message)
    setToastMessage(message)
    setExportResult(undefined)
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current)
    if (duration > 0) {
      toastTimeoutRef.current = window.setTimeout(() => setToastMessage(''), duration)
    }
  }, [])

  const persistUiStateNow = useCallback((selection = lastEditorSelectionRef.current) => {
    if (!startupProjectReadyRef.current) return
    const state = {
      projectId: projectRef.current.id,
      activePath: activePathRef.current,
      openTabs: openTabsRef.current,
      selectedScriptPath: selectedScriptPathRef.current,
      selectedMediaPath: selectedMediaPathRef.current,
      expandedPaths: expandedPathsRef.current,
      leftTab: leftTabRef.current,
      editorSelection: selection,
    }
    savePersistedUiState(state)
    diagnosticLog('ui-state-persisted', state)
  }, [])

  const selectLeftTab = useCallback((nextTab: PersistedUiState['leftTab']) => {
    leftTabRef.current = nextTab
    setLeftTab(nextTab)
    persistUiStateNow()
  }, [persistUiStateNow])

  const saveProjectFolderQueued = useCallback((nextProject: Project) => {
    if (!desktopStorageReady || !startupProjectReady) return Promise.resolve<string | undefined>(undefined)
    const saveTask = saveQueueRef.current.then(() => storage.saveProjectFolder(nextProject))
    saveQueueRef.current = saveTask.catch(() => undefined)
    return saveTask
  }, [desktopStorageReady, startupProjectReady])

  useEffect(() => {
    ;(window as CharacterOptionsWindow).__STAGEDESK_CHARACTER_OPTIONS__ = activeCharacters
    window.dispatchEvent(new CustomEvent('stagedesk-characters-updated'))
  }, [activeCharacters])

  useEffect(() => {
    chipInspectorRef.current = { notes: fileNotes, cues: fileCues }
  }, [fileCues, fileNotes])

  useEffect(() => {
    let active = true
    if (!user || !activeFile || activeAppDocument) {
      return undefined
    }

    const checkSharedFile = async () => {
      setShareIndicatorForPath(activeFile.path, { status: 'checking' })
      try {
        const { data, error } = await supabase
          .from(SCRIPT_SHARE_TABLE)
          .select('uid, published_at, updated_at')
          .eq('owner_id', user.id)
          .eq('project_id', project.id)
          .eq('script_path', activeFile.path)
          .maybeSingle()
        if (error) throw error
        if (!active) return
        const shareUid = data?.uid
        const shared = Boolean(shareUid)
        setShareIndicatorForPath(activeFile.path, shared
          ? { status: 'shared', url: shareUrlForUid(shareUid as string) }
          : { status: 'not-shared' })
      } catch (error) {
        if (!active) return
        setShareIndicatorForPath(activeFile.path, {
          status: 'error',
          message: publishErrorMessage(error),
        })
      }
    }

    void checkSharedFile()
    return () => {
      active = false
    }
  }, [activeAppDocument, activeFile, project.id, setShareIndicatorForPath, user])

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
    diagnosticLog('ui-selection-state', {
      activePath,
      openTabs,
      leftTab,
      selectedScriptPath,
      selectedMediaPath,
      selectedCueId,
      noteMode,
      currentScene,
    })
  }, [activePath, currentScene, leftTab, noteMode, openTabs, selectedCueId, selectedMediaPath, selectedScriptPath])

  useEffect(() => {
    draftsRef.current = drafts
  }, [drafts])

  useEffect(() => {
    startupProjectReadyRef.current = startupProjectReady
  }, [startupProjectReady])

  useEffect(() => {
    if (!startupProjectReady) return
    persistUiStateNow()
  }, [
    activePath,
    expandedPaths,
    leftTab,
    openTabs,
    persistUiStateNow,
    project.id,
    selectedMediaPath,
    selectedScriptPath,
    startupProjectReady,
  ])

  useEffect(() => {
    const persistBeforePageLifecycleChange = (event: Event) => {
      diagnosticLog(`app-${event.type}`, {
        visibilityState: document.visibilityState,
        activePath: activePathRef.current,
        openTabs: openTabsRef.current,
        leftTab: leftTabRef.current,
      })
      persistUiStateNow()
    }
    window.addEventListener('blur', persistBeforePageLifecycleChange)
    window.addEventListener('pagehide', persistBeforePageLifecycleChange)
    window.addEventListener('beforeunload', persistBeforePageLifecycleChange)
    return () => {
      window.removeEventListener('blur', persistBeforePageLifecycleChange)
      window.removeEventListener('pagehide', persistBeforePageLifecycleChange)
      window.removeEventListener('beforeunload', persistBeforePageLifecycleChange)
    }
  }, [persistUiStateNow])

  useEffect(() => {
    if (!isTauriRuntime()) return
    let disposed = false
    let unlistenResize: (() => void) | undefined
    let unlistenMove: (() => void) | undefined
    let saveTimeout = 0

    const setupWindowPersistence = async () => {
      try {
        const windowApi = await import('@tauri-apps/api/window')
        const appWindow = windowApi.getCurrentWindow()
        const savedState = loadPersistedWindowState()
        if (savedState && !disposed) {
          if (savedState.width > 0 && savedState.height > 0) {
            await appWindow.setSize(new windowApi.LogicalSize(savedState.width, savedState.height))
          }
          if (Number.isFinite(savedState.x) && Number.isFinite(savedState.y)) {
            await appWindow.setPosition(new windowApi.LogicalPosition(savedState.x, savedState.y))
          }
        }

        const saveWindowState = async () => {
          if (disposed) return
          try {
            const [size, position] = await Promise.all([appWindow.innerSize(), appWindow.outerPosition()])
            savePersistedWindowState({
              width: size.width,
              height: size.height,
              x: position.x,
              y: position.y,
            })
          } catch {
            // Window state persistence is best-effort and must never interrupt editing.
          }
        }
        const scheduleSave = () => {
          if (saveTimeout) window.clearTimeout(saveTimeout)
          saveTimeout = window.setTimeout(() => void saveWindowState(), 240)
        }

        unlistenResize = await appWindow.onResized(scheduleSave)
        unlistenMove = await appWindow.onMoved(scheduleSave)
        await saveWindowState()
      } catch {
        // Older desktop runtimes may not expose all window APIs.
      }
    }

    void setupWindowPersistence()

    return () => {
      disposed = true
      if (saveTimeout) window.clearTimeout(saveTimeout)
      unlistenResize?.()
      unlistenMove?.()
    }
  }, [])

  useEffect(() => {
    setScriptValidationIssues([])
  }, [activePath, project.id])

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

    const startEditorCue = (cue: MediaCue, audio: HTMLAudioElement, assetUrl: string) => {
      window.dispatchEvent(new CustomEvent(STOP_PREVIEW_PLAYBACK_EVENT))
      if (editorPlayingCueRef.current?.id) dispatchEditorCueState(editorPlayingCueRef.current.id, 'stopped')
      if (shouldUseNativeAudioPlayback()) void stopNativeAudioAsset()
      clearAudioTimers(editorAudioTimersRef)
      audio.pause()
      setSelectedCueId(cue.id)
      const preparedSrc = prepareMediaSourceForCue(audio, cue, assetUrl)
      audio.preload = 'auto'
      audio.loop = Boolean(cue.options.loop)
      const targetVolume = cueTargetVolume(cue)
      if ((cue.options.fadeIn ?? 0) > 0) {
        audio.volume = 0
      } else {
        audio.volume = targetVolume
      }
      audio.onended = () => {
        editorPlayingCueRef.current = undefined
        dispatchEditorCueState(cue.id, 'stopped')
      }
      audio.onerror = () => {
        editorPlayingCueRef.current = { id: cue.id, state: 'paused' }
        dispatchEditorCueState(cue.id, 'paused')
        setStorageStatus(mediaElementErrorMessage(cue, audio.error))
      }
      const playPromise = audio.play()
      playPromise
        .then(() => {
          if (audio.src !== preparedSrc) return
          editorPlayingCueRef.current = { id: cue.id, state: 'playing' }
          dispatchEditorCueState(cue.id, 'playing')
          setStorageStatus(`Cue avviato: ${cue.title || cue.src}`)
          if ((cue.options.fadeIn ?? 0) > 0) {
            fadeAudioVolume(audio, targetVolume, cue.options.fadeIn ?? 0, editorAudioTimersRef)
          }
          void alignMediaForCue(audio, cue, preparedSrc).finally(() => {
            if (audio.src !== preparedSrc || editorPlayingCueRef.current?.id !== cue.id) return
            scheduleCueEnd(audio, cue, editorAudioTimersRef, () => {
              editorPlayingCueRef.current = undefined
              dispatchEditorCueState(cue.id, 'stopped')
            })
          })
        })
        .catch((error: unknown) => {
          editorPlayingCueRef.current = { id: cue.id, state: 'paused' }
          dispatchEditorCueState(cue.id, 'paused')
          setStorageStatus(playbackErrorMessage(cue, error))
        })
    }

    const startNativeEditorCue = (cue: MediaCue, audio: HTMLAudioElement, assetUrl: string, sourcePath?: string) => {
      window.dispatchEvent(new CustomEvent(STOP_PREVIEW_PLAYBACK_EVENT))
      if (editorPlayingCueRef.current?.id) dispatchEditorCueState(editorPlayingCueRef.current.id, 'stopped')
      clearAudioTimers(editorAudioTimersRef)
      editorAudioRef.current?.pause()
      setSelectedCueId(cue.id)
      editorPlayingCueRef.current = { id: cue.id, state: 'paused' }
      dispatchEditorCueState(cue.id, 'paused')
      setStorageStatus(`Cue pronto: ${cue.title || cue.src}`)

      void playNativeAudioAsset(cue, sourcePath)
        .then((playbackDuration) => {
          editorPlayingCueRef.current = { id: cue.id, state: 'playing' }
          dispatchEditorCueState(cue.id, 'playing')
          setStorageStatus(`Cue avviato: ${cue.title || cue.src}`)
          scheduleNativeCueEnd(cue, editorAudioTimersRef, playbackDuration, () => {
            editorPlayingCueRef.current = undefined
            dispatchEditorCueState(cue.id, 'stopped')
          })
        })
        .catch((error: unknown) => {
          if (isNativeProjectPathError(error)) {
            startEditorCue(cue, audio, assetUrl)
            return
          }
          editorPlayingCueRef.current = { id: cue.id, state: 'paused' }
          dispatchEditorCueState(cue.id, 'paused')
          setStorageStatus(nativePlaybackErrorMessage(cue, error))
        })
    }

    const stopEditorAudioImmediately = (cue: MediaCue) => {
      const audio = editorAudioRef.current
      clearAudioTimers(editorAudioTimersRef)
      if (shouldUseNativeAudioPlayback()) void stopNativeAudioAsset()
      if (!audio) {
        editorPlayingCueRef.current = undefined
        dispatchEditorCueState(cue.id, 'stopped')
        setStorageStatus(`Cue fermato: ${cue.title || cue.src}`)
        return
      }
      audio.onended = null
      audio.onerror = null
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
        if (shouldUseNativeAudioPlayback()) {
          void pauseNativeAudioAsset()
            .then(() => {
              editorPlayingCueRef.current = { id: cue.id, state: 'paused' }
              dispatchEditorCueState(cue.id, 'paused')
              setStorageStatus(`Cue in pausa: ${cue.title || cue.src}`)
            })
            .catch((error: unknown) => setStorageStatus(nativePlaybackErrorMessage(cue, error)))
        } else {
          audio.pause()
          editorPlayingCueRef.current = { id: cue.id, state: 'paused' }
          dispatchEditorCueState(cue.id, 'paused')
          setStorageStatus(`Cue in pausa: ${cue.title || cue.src}`)
        }
        return
      }

      if (editorPlayingCueRef.current?.id === cue.id && editorPlayingCueRef.current.state === 'paused') {
        clearAudioTimers(editorAudioTimersRef)
        if (shouldUseNativeAudioPlayback()) {
          scheduleNativeCueEnd(cue, editorAudioTimersRef, undefined, () => {
            editorPlayingCueRef.current = undefined
            dispatchEditorCueState(cue.id, 'stopped')
          })
          void resumeNativeAudioAsset()
            .then(() => {
              editorPlayingCueRef.current = { id: cue.id, state: 'playing' }
              dispatchEditorCueState(cue.id, 'playing')
              setStorageStatus(`Cue ripreso: ${cue.title || cue.src}`)
            })
            .catch((error: unknown) => setStorageStatus(nativePlaybackErrorMessage(cue, error)))
          return
        }
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
          .catch((error: unknown) => setStorageStatus(playbackErrorMessage(cue, error)))
        return
      }

      const asset = findTreeNode(projectRef.current.media, cue.src)
      const assetUrl = asset ? mediaAssetUrl(asset, projectRef.current.rootPath) : undefined
      if (!assetUrl) {
        setStorageStatus(`Cue non disponibile: importa di nuovo il file ${cue.src.split('/').pop()}`)
        return
      }

      if (shouldUseNativeAudioPlayback()) {
        startNativeEditorCue(cue, audio, assetUrl, asset?.sourcePath)
        return
      }

      startEditorCue(cue, audio, assetUrl)
    }

    const stopCueFromEditor = (event: Event) => {
      const { id } = (event as CustomEvent<{ id?: string }>).detail ?? {}
      const current = editorPlayingCueRef.current
      if (!id || (current?.id && current.id !== id)) return
      const cue = projectRef.current.cues.find((item) => item.id === id)
      if (!cue) return
      stopEditorAudioImmediately(cue)
    }

    const stopEditorPlaybackFromOutside = () => {
      const current = editorPlayingCueRef.current
      if (!current?.id) return
      const cue = projectRef.current.cues.find((item) => item.id === current.id)
      if (cue) {
        stopEditorAudioImmediately(cue)
        return
      }
      clearAudioTimers(editorAudioTimersRef)
      if (shouldUseNativeAudioPlayback()) void stopNativeAudioAsset()
      editorAudioRef.current?.pause()
      editorPlayingCueRef.current = undefined
      dispatchEditorCueState(current.id, 'stopped')
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
    window.addEventListener(STOP_EDITOR_PLAYBACK_EVENT, stopEditorPlaybackFromOutside)
    window.addEventListener('script-cue-delete', deleteCueFromEditor)

    return () => {
      window.removeEventListener('script-note-update', updateNoteFromEditor)
      window.removeEventListener('script-note-delete', deleteNoteFromEditor)
      window.removeEventListener('script-cue-toggle', toggleCueFromEditor)
      window.removeEventListener('script-cue-stop', stopCueFromEditor)
      window.removeEventListener(STOP_EDITOR_PLAYBACK_EVENT, stopEditorPlaybackFromOutside)
      window.removeEventListener('script-cue-delete', deleteCueFromEditor)
      clearAudioTimers(editorAudioTimersRef)
      if (shouldUseNativeAudioPlayback()) void stopNativeAudioAsset()
    }
  }, [])

  useEffect(() => {
    if (!theaterMenuOpen && !tableMenuOpen && !tableInsertMenuOpen && !appMenuOpen) return

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (theaterMenuOpen && !theaterMenuRef.current?.contains(event.target as Node)) {
        setTheaterMenuOpen(false)
        setTheaterMenuPosition(undefined)
      }
      if (tableMenuOpen && !tableMenuRef.current?.contains(event.target as Node)) {
        setTableMenuOpen(false)
        setTableMenuPosition(undefined)
      }
      if (tableInsertMenuOpen && !tableInsertMenuRef.current?.contains(event.target as Node)) {
        setTableInsertMenuOpen(false)
        setTableInsertMenuPosition(undefined)
      }
      if (appMenuOpen && !appMenuRef.current?.contains(event.target as Node)) {
        setAppMenuOpen(false)
        setAppMenuPosition(undefined)
      }
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTheaterMenuOpen(false)
        setTheaterMenuPosition(undefined)
        setTableMenuOpen(false)
        setTableMenuPosition(undefined)
        setTableInsertMenuOpen(false)
        setTableInsertMenuPosition(undefined)
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
  }, [appMenuOpen, tableInsertMenuOpen, tableMenuOpen, theaterMenuOpen])

  useEffect(() => {
    if (!toolbarState.table && !tableContextActive && tableMenuOpen) {
      setTableMenuOpen(false)
      setTableMenuPosition(undefined)
    }
  }, [tableContextActive, tableMenuOpen, toolbarState.table])

  useEffect(() => {
    let cancelled = false

    const initializeProjectStorage = async () => {
      try {
        diagnosticLog('project-storage-init-start')
        const path = await storage.projectFolderPath()
        diagnosticLog('project-storage-current-path', { path })
        if (!cancelled) {
          setStorageStatus(path ? `Cartella progetto: ${compactPath(path)}` : 'Apertura ultimo progetto...')
        }
      } catch (error) {
        if (!cancelled) setStorageStatus(`Storage progetto non disponibile: ${String(error)}`)
      } finally {
        diagnosticLog('project-storage-init-ready', { cancelled })
        if (!cancelled) setDesktopStorageReady(true)
      }
    }

    void initializeProjectStorage()

    return () => {
      cancelled = true
    }
  }, [])

  const editor = useEditor({
    extensions: [StarterKit, linkExtension, tableExtensions, ScriptNote, ScriptDialogue, ScriptChip],
    content: markdownToHtml(activeMarkdown),
    onCreate({ editor: currentEditor }) {
      diagnosticLog('editor-created', {
        activePath: activePathRef.current,
        selection: currentEditor.state.selection.from,
      })
      setEditorMarkdown(editorJsonToMarkdown(currentEditor.getJSON()))
      syncToolbarState(currentEditor, setToolbarState)
      syncOutlineState(currentEditor, setActiveOutline, setActiveOutlineId)
      syncBookmarkState(currentEditor, setActiveBookmarks, setActiveBookmarkId)
      syncEditorSceneState(currentEditor, setActiveEditorSceneId)
      syncEditorCueRefs(currentEditor, setEditorCueRefIds)
      syncEditorCueRefsAtSelection(currentEditor, setCurrentEditorCueRefIds)
    },
    onSelectionUpdate({ editor: currentEditor }) {
      diagnosticLog('editor-selection-update', {
        activePath: activePathRef.current,
        selection: currentEditor.state.selection.from,
        scene: editorSceneIdAtPosition(currentEditor.state.doc, currentEditor.state.selection.from),
      })
      lastEditorSelectionRef.current = currentEditor.state.selection.from
      persistUiStateNow(currentEditor.state.selection.from)
      syncToolbarState(currentEditor, setToolbarState)
      syncOutlineState(currentEditor, setActiveOutline, setActiveOutlineId)
      syncBookmarkState(currentEditor, setActiveBookmarks, setActiveBookmarkId)
      syncEditorSceneState(currentEditor, setActiveEditorSceneId)
      syncEditorCueRefs(currentEditor, setEditorCueRefIds)
      syncEditorCueRefsAtSelection(currentEditor, setCurrentEditorCueRefIds)
    },
    onTransaction({ editor: currentEditor }) {
      diagnosticLog('editor-transaction', {
        activePath: activePathRef.current,
        selection: currentEditor.state.selection.from,
        docSize: currentEditor.state.doc.content.size,
      })
      setEditorMarkdown((current) => {
        const next = editorJsonToMarkdown(currentEditor.getJSON())
        return current === next ? current : next
      })
      syncToolbarState(currentEditor, setToolbarState)
      syncOutlineState(currentEditor, setActiveOutline, setActiveOutlineId)
      syncBookmarkState(currentEditor, setActiveBookmarks, setActiveBookmarkId)
      syncEditorSceneState(currentEditor, setActiveEditorSceneId)
      syncEditorCueRefs(currentEditor, setEditorCueRefIds)
      syncEditorCueRefsAtSelection(currentEditor, setCurrentEditorCueRefIds)
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
      handleTextInput(view, from, to, text) {
        if (text !== ':') return false
        if (
          convertNoteColonToGeneralNote(
            view,
            from,
            to,
            activeFilePathRef.current,
            currentSceneRef.current ?? '',
            (note) => {
              persistProject({ ...projectRef.current, notes: [...projectRef.current.notes, note] })
              setSelectedNoteId(note.id)
              setSelectedNoteTypeId(note.type)
            },
          )
        ) {
          return true
        }
        return convertCharacterColonToDialogue(
          view,
          from,
          to,
          activeCharactersRef.current,
          currentSceneRef.current ?? '',
        )
      },
      handleDOMEvents: {
        dragover(_view, event) {
          if (!event.dataTransfer || !hasAnyEditorDragPayload(event.dataTransfer)) return false
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
          return true
        },
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
          if (!moveEditorNode(view, match, dropPosition)) return true
          clearGlobalDragPayload()
          setSelectedNoteId(note.id)
          showStatus(`Nota spostata: ${note.title}`)
          return true
        }

        const dialogueId = readDragPayload(dataTransfer, DIALOGUE_ID_DND_TYPE, DIALOGUE_ID_DND_PREFIX)
        if (dialogueId) {
          const match = nodeMatchByAttr(view.state.doc, 'scriptDialogue', 'id', dialogueId)
          if (!match) return false
          if (dropPosition >= match.position && dropPosition <= match.position + match.nodeSize) return true

          event.preventDefault()
          if (!moveEditorNode(view, match, dropPosition)) return true
          clearGlobalDragPayload()
          showStatus(`Battuta spostata`)
          return true
        }

        const cueId = readDragPayload(dataTransfer, CUE_ID_DND_TYPE, CUE_ID_DND_PREFIX)
        if (cueId) {
          const cue = projectRef.current.cues.find((item) => item.id === cueId && item.filePath === activeFilePathRef.current)
          if (!cue) return false
          event.preventDefault()
          if (!moveCueChip(view, cue.id, dropPosition)) {
            cueDropActionsRef.current.insertExistingCue(cue, dropPosition)
          }
          clearGlobalDragPayload()
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
          clearGlobalDragPayload()
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
  const editorEditingDisabled = !editor || Boolean(activeAppDocument) || activeStoreTab
  const activeDocumentTitle = activeFile?.name ?? activeAppDocument?.title ?? (activeStoreTab ? 'Store' : undefined)
  const selectedTableContext = editor ? currentTableContext(editor) : undefined
  const selectedCharacterTable = Boolean(selectedTableContext?.isCharacterTable)
  const selectedCharacterTableHeaderRow = Boolean(selectedTableContext?.isCharacterTable && selectedTableContext.isHeaderRow)
  const editorNoteCollapseSummaryValue = editorNoteCollapseSummary(editor)
  const allEditorNotesCollapsed =
    editorNoteCollapseSummaryValue.total > 0 &&
    editorNoteCollapseSummaryValue.collapsed === editorNoteCollapseSummaryValue.total
  const toggleAllNotesLabel = allEditorNotesCollapsed ? 'Espandi tutte le note' : 'Collassa tutte le note'

  const draftsWithCurrentEditorContent = useCallback(() => {
    const currentDrafts = { ...draftsRef.current }
    if (editor && activeFilePathRef.current && !activeAppDocument) {
      currentDrafts[activeFilePathRef.current] = editorJsonToMarkdown(editor.getJSON())
    }
    return currentDrafts
  }, [activeAppDocument, editor])

  const persistDraftsNow = useCallback(async () => {
    const currentDrafts = draftsWithCurrentEditorContent()
    diagnosticLog('draft-persist-start', {
      projectId: projectRef.current.id,
      activePath: activePathRef.current,
      draftPaths: Object.keys(currentDrafts),
      openTabs: openTabsRef.current,
    })
    if (Object.keys(currentDrafts).length === 0) {
      diagnosticLog('draft-persist-skipped', { reason: 'no-drafts' })
      return projectRef.current
    }

    const nextProject = applyDraftsToProject(projectRef.current, currentDrafts)
    projectRef.current = nextProject
    projectScriptsRef.current = nextProject.scripts
    setProject(nextProject)
    setDrafts({})
    draftsRef.current = {}
    storage.save(nextProject)

    try {
      const path = await saveProjectFolderQueued(nextProject)
      if (path) setStorageStatus(`Cartella progetto salvata: ${compactPath(path)}`)
    } catch (error) {
      setStorageStatus(`Salvataggio progetto non riuscito: ${String(error)}`)
      diagnosticLog('draft-persist-error', { message: String(error) })
    }

    diagnosticLog('draft-persist-complete', {
      projectId: nextProject.id,
      activePath: activePathRef.current,
      openTabs: openTabsRef.current,
    })

    return nextProject
  }, [draftsWithCurrentEditorContent, saveProjectFolderQueued])

  // During pagehide/beforeunload, network and Tauri IPC requests are not reliable.
  // Keep a synchronous recovery copy so a reload cannot discard the current editor.
  const persistDraftsSynchronously = useCallback(() => {
    const currentDrafts = draftsWithCurrentEditorContent()
    if (Object.keys(currentDrafts).length === 0) return projectRef.current

    const nextProject = applyDraftsToProject(projectRef.current, currentDrafts)
    projectRef.current = nextProject
    projectScriptsRef.current = nextProject.scripts
    storage.save(nextProject)
    diagnosticLog('draft-persist-sync', {
      projectId: nextProject.id,
      activePath: activePathRef.current,
      draftPaths: Object.keys(currentDrafts),
      openTabs: openTabsRef.current,
    })
    return nextProject
  }, [draftsWithCurrentEditorContent])

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

  const setCurrentBlockAsHeading = useCallback((level: 1 | 2 | 3) => {
    if (!editor) return
    setTheaterMenuOpen(false)
    setTheaterMenuPosition(undefined)
    const label = level === 1 ? 'Atto' : level === 2 ? 'Scena' : 'Sezione'
    const shouldInsertLabel =
      editor.state.selection.empty &&
      editor.state.selection.$from.parent.isTextblock &&
      editor.state.selection.$from.parent.textContent.trim() === ''
    const chain = editor.chain().focus().setHeading({ level })
    if (shouldInsertLabel) {
      chain.insertContent(label).run()
      return
    }
    chain.run()
  }, [editor])

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

  const focusValidationIssue = (issue: ScriptValidationIssue) => {
    if (!editor) return
    const position = editorPositionForValidationIssue(editor, issue)
    editor.chain().focus(position).setTextSelection(position).scrollIntoView().run()
  }

  useEffect(() => {
    if (!editor) return

    const syncAfterEditorEvent = () => {
      window.requestAnimationFrame(() => {
        syncToolbarState(editor, setToolbarState)
        syncOutlineState(editor, setActiveOutline, setActiveOutlineId)
        syncBookmarkState(editor, setActiveBookmarks, setActiveBookmarkId)
        syncEditorSceneState(editor, setActiveEditorSceneId)
        syncEditorCueRefs(editor, setEditorCueRefIds)
        syncEditorCueRefsAtSelection(editor, setCurrentEditorCueRefIds)
      })
    }

    const editorElement = editor.view.dom
    editorElement.addEventListener('click', syncAfterEditorEvent)
    editorElement.addEventListener('mouseup', syncAfterEditorEvent)
    editorElement.addEventListener('keyup', syncAfterEditorEvent)
    editorElement.addEventListener('focus', syncAfterEditorEvent)
    editor.on('selectionUpdate', syncAfterEditorEvent)
    editor.on('transaction', syncAfterEditorEvent)

    return () => {
      editorElement.removeEventListener('click', syncAfterEditorEvent)
      editorElement.removeEventListener('mouseup', syncAfterEditorEvent)
      editorElement.removeEventListener('keyup', syncAfterEditorEvent)
      editorElement.removeEventListener('focus', syncAfterEditorEvent)
      editor.off('selectionUpdate', syncAfterEditorEvent)
      editor.off('transaction', syncAfterEditorEvent)
    }
  }, [editor])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!activeAppDocument && !activeStoreTab)
  }, [activeAppDocument, activeStoreTab, editor])

  useEffect(() => {
    if (!editor || activeAppDocument) return

    const rememberEditorFocus = () => {
      editorHadFocusBeforeWindowBlurRef.current = editor.view.hasFocus()
      if (editor.view.hasFocus()) lastEditorSelectionRef.current = editor.state.selection.from
    }

    window.addEventListener('blur', rememberEditorFocus)
    return () => {
      window.removeEventListener('blur', rememberEditorFocus)
    }
  }, [activeAppDocument, editor])

  useEffect(() => {
    if (!editor) return

    if (activeStoreTab) {
      editor.commands.setContent('', { emitUpdate: false })
      setEditorMarkdown('')
      setActiveOutline([])
      setActiveOutlineId('')
      setActiveBookmarks([])
      setActiveBookmarkId('')
      setEditorCueRefIds([])
      setCurrentEditorCueRefIds([])
      setActiveEditorSceneId('')
      return
    }

    if (activeAppDocument) {
      editor.commands.setContent(markdownToHtml(activeAppDocumentMarkdown, { preserveEmptyParagraphs: false }), { emitUpdate: false })
      setEditorMarkdown(activeAppDocumentMarkdown)
      syncToolbarState(editor, setToolbarState)
      syncOutlineState(editor, setActiveOutline, setActiveOutlineId)
      syncBookmarkState(editor, setActiveBookmarks, setActiveBookmarkId)
      syncEditorCueRefs(editor, setEditorCueRefIds)
      syncEditorCueRefsAtSelection(editor, setCurrentEditorCueRefIds)
      syncEditorSceneState(editor, setActiveEditorSceneId)
      return
    }

    if (!activeFilePath) {
      editor.commands.setContent('', { emitUpdate: false })
      setEditorMarkdown('')
      setActiveOutline([])
      setActiveOutlineId('')
      setActiveBookmarks([])
      setActiveBookmarkId('')
      setEditorCueRefIds([])
      setCurrentEditorCueRefIds([])
      setActiveEditorSceneId('')
      return
    }

    const content =
      draftsRef.current[activeFilePath] ??
      findMarkdownNode(projectScriptsRef.current, activeFilePath)?.content ??
      ''
    editor.commands.setContent(markdownToHtml(content), { emitUpdate: false })
    setEditorMarkdown(content)
    const pendingSelection = pendingEditorSelectionRef.current
    if (pendingSelection !== undefined) {
      const safePosition = Math.max(1, Math.min(pendingSelection, editor.state.doc.content.size))
      editor.commands.setTextSelection(safePosition)
      lastEditorSelectionRef.current = safePosition
      pendingEditorSelectionRef.current = undefined
    }
    syncToolbarState(editor, setToolbarState)
    syncOutlineState(editor, setActiveOutline, setActiveOutlineId)
    syncBookmarkState(editor, setActiveBookmarks, setActiveBookmarkId)
    syncEditorCueRefs(editor, setEditorCueRefIds)
    syncEditorCueRefsAtSelection(editor, setCurrentEditorCueRefIds)
    syncEditorSceneState(editor, setActiveEditorSceneId)
  }, [activeAppDocument, activeAppDocumentMarkdown, activeFilePath, activeStoreTab, editor, project.id])

  useEffect(() => {
    if (!editor || activeAppDocument || activeStoreTab || !activeFilePath) {
      setActiveEditorSceneId('')
      return
    }
    syncEditorSceneState(editor, setActiveEditorSceneId)
  }, [activeAppDocument, activeFilePath, activeStoreTab, editor])

  useEffect(() => {
    if (!editor || !activeFilePath) return

    const markActiveFileDirty = () => {
      if (!startupProjectReady) startupUserEditedRef.current = true
      const draft = editorJsonToMarkdown(editor.getJSON())
      const cueIds = markerRefIdsFromMarkdown(draft, 'cue')
      const noteIds = markerRefIdsFromMarkdown(draft, 'note')
      setEditorMarkdown((current) => (current === draft ? current : draft))
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
  }, [activeFilePath, editor, startupProjectReady])

  useEffect(() => {
    if (!project.settings.autosave) return
    const projectToSave = applyDraftsToProject(project, drafts)
    storage.save(projectToSave)
  }, [drafts, project])

  useEffect(() => {
    if (!project.settings.autosave) return

    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') void persistDraftsNow()
    }

    document.addEventListener('visibilitychange', flushWhenHidden)
    return () => {
      document.removeEventListener('visibilitychange', flushWhenHidden)
    }
  }, [persistDraftsNow, project.settings.autosave])

  useEffect(() => {
    if (!project.settings.autosave) return

    const persistOnPageExit = (event: Event) => {
      if (event.type === 'pagehide' || event.type === 'beforeunload') {
        persistDraftsSynchronously()
      }
    }

    window.addEventListener('pagehide', persistOnPageExit)
    window.addEventListener('beforeunload', persistOnPageExit)
    return () => {
      window.removeEventListener('pagehide', persistOnPageExit)
      window.removeEventListener('beforeunload', persistOnPageExit)
    }
  }, [persistDraftsSynchronously, project.settings.autosave])

  useEffect(() => {
    if (!project.settings.autosave) return
    const entries = Object.entries(drafts)
    if (entries.length === 0) return

    const timeout = window.setTimeout(() => {
      setProject((current) => {
        const nextProject = applyDraftsToProject(current, Object.fromEntries(entries))
        storage.save(nextProject)
        saveProjectFolderQueued(nextProject)
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
  }, [drafts, project.settings.autosave, saveProjectFolderQueued])

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
    saveProjectFolderQueued(nextProject)
      .then((path) => {
        if (path) setStorageStatus(`Cartella progetto salvata: ${compactPath(path)}`)
      })
      .catch((error) => setStorageStatus(`Salvataggio progetto non riuscito: ${String(error)}`))
  }

  const stopEditorAndPreviewPlayback = (statusMessage?: string) => {
    const currentEditorCue = editorPlayingCueRef.current
    window.dispatchEvent(new CustomEvent(STOP_PREVIEW_PLAYBACK_EVENT))
    clearAudioTimers(editorAudioTimersRef)
    if (editorAudioRef.current) {
      editorAudioRef.current.onended = null
      editorAudioRef.current.onerror = null
      editorAudioRef.current.pause()
      editorAudioRef.current.removeAttribute('src')
      editorAudioRef.current.load()
    }
    if (currentEditorCue?.id) {
      window.dispatchEvent(new CustomEvent('script-cue-state', { detail: { id: currentEditorCue.id, state: 'stopped' } }))
    }
    editorPlayingCueRef.current = undefined
    if (shouldUseNativeAudioPlayback()) void stopNativeAudioAsset()
    if (statusMessage) setStorageStatus(statusMessage)
  }

  const startFullscreenWithValidation = () => {
    if (!editor || activeAppDocument) return
    const markdown = editorJsonToMarkdown(editor.getJSON())
    const issues = validateScriptForFullscreen(markdown, projectRef.current)
    setScriptValidationIssues(issues)

    if (issues.length > 0) {
      showStatus(`${issues.length} anomalie rilevate: correggi il copione prima del fullscreen`, 8000)
      return
    }

    stopEditorAndPreviewPlayback('Playback editor e anteprime interrotto. Avvio fullscreen...')
    const nextCueRefIds = uniqueValues([...markerRefIdsFromMarkdown(markdown, 'cue'), ...editorCueRefIds])
    const nextPerformanceBlocks = assignCueBlocks(
      parseScriptBlocks(markdown).filter((block) => isFullscreenBlock(block.type)),
      projectRef.current.cues,
      activePathRef.current,
      nextCueRefIds,
    )
    setExecutedCueIds([])
    setFullscreenBlocks(nextPerformanceBlocks)
    setFullscreenIndex(fullscreenIndexAtEditorPosition(editor, nextPerformanceBlocks))
    setFullscreen(true)
  }

  const focusEditorBlockFromFullscreen = useCallback((block: PerformanceBlock | undefined) => {
    if (!editor || !block) return false

    if (block.type === 'dialogue') {
      const match = nodeMatchByAttr(editor.state.doc, 'scriptDialogue', 'id', block.id)
      if (!match) return false
      const transaction = editor.state.tr
        .setSelection(NodeSelection.create(editor.state.doc, match.position))
        .scrollIntoView()
      editor.view.dispatch(transaction)
      lastEditorSelectionRef.current = match.position
      editor.view.focus()
      const textarea = editor.view.dom.querySelector<HTMLTextAreaElement>(`[data-dialogue-id="${block.id}"] textarea`)
      if (!textarea) return false
      textarea.focus()
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
      textarea.scrollIntoView({ block: 'center', inline: 'nearest' })
      return true
    }

    if (block.type === 'media' && block.cueId) {
      const match = chipMatchByRef(editor.state.doc, 'cue', block.cueId)
      if (!match) return false
      editor.chain().focus().setNodeSelection(match.position).scrollIntoView().run()
      lastEditorSelectionRef.current = match.position
      return true
    }

    return false
  }, [editor])

  const closeFullscreenAndRestoreEditor = () => {
    const block = activePerformanceBlocks[fullscreenIndex]
    fullscreenReturnBlockRef.current = block
    setFullscreen(false)
  }

  useEffect(() => {
    if (isFullscreen || !editor || !fullscreenReturnBlockRef.current) return
    let cancelled = false
    let attempts = 0
    const restore = () => {
      if (cancelled) return
      const restored = focusEditorBlockFromFullscreen(fullscreenReturnBlockRef.current)
      attempts += 1
      if (restored || attempts >= 18) {
        fullscreenReturnBlockRef.current = undefined
        return
      }
      window.requestAnimationFrame(restore)
    }
    window.requestAnimationFrame(restore)
    return () => {
      cancelled = true
    }
  }, [editor, focusEditorBlockFromFullscreen, isFullscreen])

  const activateProject = (nextProject: typeof project) => {
    nextProject = normalizeProject(nextProject)
    const markdownPaths = flattenMarkdownFiles(nextProject.scripts).map((file) => file.path)
    const savedUiState = loadPersistedUiState(nextProject.id)
    const validOpenTabs = savedUiState?.openTabs.filter((path) => markdownPaths.includes(path) || isAppDocumentPath(path)) ?? []
    const nextPath =
      savedUiState?.activePath && (markdownPaths.includes(savedUiState.activePath) || isAppDocumentPath(savedUiState.activePath))
        ? savedUiState.activePath
        : validOpenTabs[0] ?? markdownPaths[0] ?? ''
    const scriptPath =
      savedUiState?.selectedScriptPath && findTreeNode(nextProject.scripts, savedUiState.selectedScriptPath)
        ? savedUiState.selectedScriptPath
        : nextPath && !isAppDocumentPath(nextPath)
          ? nextPath
          : markdownPaths[0] ?? SCRIPT_ROOT_PATH
    const mediaPath =
      savedUiState?.selectedMediaPath && (savedUiState.selectedMediaPath === '/media' || findTreeNode(nextProject.media, savedUiState.selectedMediaPath))
        ? savedUiState.selectedMediaPath
        : nextProject.media[0]?.path ?? '/media'
    diagnosticLog('project-activate', {
      projectId: nextProject.id,
      projectName: nextProject.name,
      rootPath: nextProject.rootPath,
      savedUiState: savedUiState
        ? {
            activePath: savedUiState.activePath,
            openTabs: savedUiState.openTabs,
            selectedScriptPath: savedUiState.selectedScriptPath,
            selectedMediaPath: savedUiState.selectedMediaPath,
            leftTab: savedUiState.leftTab,
            editorSelection: savedUiState.editorSelection,
          }
        : undefined,
      resolved: { activePath: nextPath, openTabs: validOpenTabs, scriptPath, mediaPath },
    })
    const savedExpandedPaths =
      savedUiState?.expandedPaths.filter((path) => path === SCRIPT_ROOT_PATH || path === '/media' || findTreeNode(nextProject.scripts, path) || findTreeNode(nextProject.media, path)) ?? []
    pendingEditorSelectionRef.current = savedUiState?.activePath === nextPath ? savedUiState.editorSelection : undefined
    setProject(nextProject)
    setDrafts({})
    const resolvedOpenTabs = validOpenTabs.length > 0 ? validOpenTabs : nextPath ? [nextPath] : []
    const resolvedExpandedPaths = uniqueValues([SCRIPT_ROOT_PATH, '/media', ...savedExpandedPaths, ...nextProject.media.map((asset) => asset.path)])
    const resolvedLeftTab = savedUiState?.leftTab ?? leftTabRef.current
    activePathRef.current = nextPath
    openTabsRef.current = resolvedOpenTabs
    selectedScriptPathRef.current = scriptPath
    selectedMediaPathRef.current = mediaPath
    expandedPathsRef.current = resolvedExpandedPaths
    leftTabRef.current = resolvedLeftTab
    setActivePath(nextPath)
    setOpenTabs(resolvedOpenTabs)
    setSelectedScriptPath(scriptPath)
    setSelectedMediaPath(mediaPath)
    setExpandedPaths(resolvedExpandedPaths)
    setLeftTab(resolvedLeftTab)
    setSelectedNoteId(nextProject.notes[0]?.id ?? '')
    setSelectedNoteTypeId(defaultNoteType(nextProject.noteTypes)?.id ?? '')
    setSelectedCueId(nextProject.cues[0]?.id ?? '')
    setSearch('')
    setShareIndicators({})
    setFullscreenIndex(0)
    setExecutedCueIds([])
  }

  useEffect(() => {
    if (!desktopStorageReady || startupProjectLoadedRef.current) return
    startupProjectLoadedRef.current = true
    let cancelled = false

    storage.openLastProjectFolder()
      .then((opened) => {
        diagnosticLog('open-last-project-result', {
          cancelled,
          found: Boolean(opened?.project),
          path: opened?.path,
          projectId: opened?.project?.id,
        })
        return opened
      })
      .then((opened) => {
        if (cancelled) return
        if (opened?.project && isProject(opened.project)) {
          if (startupUserEditedRef.current) {
            setStorageStatus('Ultimo progetto non aperto: modifiche locali già presenti')
            return
          }
          activateProject(opened.project)
          setStorageStatus(`Ultimo progetto aperto: ${compactPath(opened.path)}`)
          return
        }
        setStorageStatus('Nessuna cartella progetto aperta')
      })
      .catch((error) => {
        if (!cancelled) setStorageStatus(`Apertura ultimo progetto non riuscita: ${String(error)}`)
      })
      .finally(() => {
        if (!cancelled) setStartupProjectReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [desktopStorageReady])

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

    setProjectPickerOpen(true)
    storage.listProjectFolders()
      .then((entries) => {
        setProjectPickerEntries(entries)
      })
      .catch((error) => {
        setProjectPickerEntries([])
        setStorageStatus(`Elenco progetti non disponibile: ${String(error)}`)
      })
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

  const refreshProjectPickerEntries = () =>
    storage.listProjectFolders()
      .then(setProjectPickerEntries)
      .catch((error) => setStorageStatus(`Aggiornamento lista progetti non riuscito: ${String(error)}`))

  const renameProjectEntry = (entry: ProjectEntry, name: string) => {
    const nextName = name.trim()
    if (!nextName || nextName === entry.name) return
    storage.renameProjectFolder(entry.path, nextName)
      .then((renamed) => {
        setStorageStatus(`Progetto rinominato: ${nextName}`)
        setProjectPickerEntries((current) =>
          current.map((item) => item.path === entry.path ? { ...item, name: renamed.name, path: renamed.path } : item),
        )
        if (project.rootPath === entry.path) {
          const renamedProject = { ...projectRef.current, name: nextName, rootPath: renamed.path }
          projectRef.current = renamedProject
          setProject(renamedProject)
          storage.save(renamedProject)
        }
      })
      .catch((error) => setStorageStatus(`Rinomina progetto non riuscita: ${String(error)}`))
  }

  const deleteProjectEntry = (entry: ProjectEntry) => {
    if (!confirm(`Eliminare definitivamente il progetto "${entry.name}"?`)) return
    storage.deleteProjectFolder(entry.path)
      .then(() => {
        setProjectPickerEntries((current) => current.filter((item) => item.path !== entry.path))
        setStorageStatus(`Progetto eliminato: ${entry.name}`)
        if (project.rootPath === entry.path) {
          const nextProject = storage.reset()
          activateProject(nextProject)
        }
        void refreshProjectPickerEntries()
      })
      .catch((error) => setStorageStatus(`Eliminazione progetto non riuscita: ${String(error)}`))
  }

  const openMarkdownTab = (path: string) => {
    diagnosticLog('tab-open-script', { path, previousActivePath: activePathRef.current, openTabs: openTabsRef.current })
    const nextTabs = openTabsRef.current.includes(path) ? openTabsRef.current : [...openTabsRef.current, path]
    openTabsRef.current = nextTabs
    activePathRef.current = path
    selectedScriptPathRef.current = path
    setOpenTabs(nextTabs)
    setActivePath(path)
    setSelectedScriptPath(path)
    persistUiStateNow()
  }

  const openAppDocumentTab = (path: string) => {
    if (!isAppDocumentPath(path)) return
    diagnosticLog('tab-open-document', { path, previousActivePath: activePathRef.current, openTabs: openTabsRef.current })
    const nextTabs = openTabsRef.current.includes(path) ? openTabsRef.current : [...openTabsRef.current, path]
    openTabsRef.current = nextTabs
    activePathRef.current = path
    setOpenTabs(nextTabs)
    setActivePath(path)
    persistUiStateNow()
  }

  const openStoreTab = () => {
    diagnosticLog('tab-open-store', { previousActivePath: activePathRef.current, openTabs: openTabsRef.current })
    setProjectPickerOpen(false)
    setProjectPickerEntries([])
    setStoreLoading(true)
    const nextTabs = openTabsRef.current.includes(STORE_TAB_PATH) ? openTabsRef.current : [...openTabsRef.current, STORE_TAB_PATH]
    openTabsRef.current = nextTabs
    activePathRef.current = STORE_TAB_PATH
    setOpenTabs(nextTabs)
    setActivePath(STORE_TAB_PATH)
    persistUiStateNow()
  }

  const updateFileTabOverflow = () => {
    const element = fileTabbarRef.current
    if (!element) return
    const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth)
    setFileTabOverflow({
      left: element.scrollLeft > 1,
      right: element.scrollLeft < maxScroll - 1,
    })
  }

  const scrollFileTabs = (direction: -1 | 1) => {
    fileTabbarRef.current?.scrollBy({
      left: direction * Math.max(180, fileTabbarRef.current.clientWidth * 0.7),
      behavior: 'smooth',
    })
  }

  useEffect(() => {
    const element = fileTabbarRef.current
    if (!element) return

    updateFileTabOverflow()
    element.addEventListener('scroll', updateFileTabOverflow, { passive: true })
    const observer = new ResizeObserver(updateFileTabOverflow)
    observer.observe(element)

    return () => {
      element.removeEventListener('scroll', updateFileTabOverflow)
      observer.disconnect()
    }
  }, [activePath, openTabs, project.scripts, storeLoading])

  const closeMarkdownTab = (path: string) => {
    diagnosticLog('tab-close-request', { path, activePath: activePathRef.current, openTabs: openTabsRef.current })
    const tabFile = findMarkdownNode(project.scripts, path)
    if (
      scriptPathHasUnsavedChanges(path) &&
      !confirm(`Chiudere ${tabFile?.name ?? path} senza salvare le modifiche?`)
    ) {
      return
    }

    if (scriptPathHasUnsavedChanges(path)) discardUnsavedPath(path)

    const currentTabs = openTabsRef.current
    const nextTabs = currentTabs.filter((item) => item !== path)
    let nextActivePath = activePathRef.current
    let nextSelectedScriptPath = selectedScriptPathRef.current
    if (nextActivePath === path) {
      const closedIndex = currentTabs.indexOf(path)
      nextActivePath = nextTabs[Math.max(0, closedIndex - 1)] ?? nextTabs[0] ?? ''
      if (nextActivePath && !isAppDocumentPath(nextActivePath) && nextActivePath !== STORE_TAB_PATH) {
        nextSelectedScriptPath = nextActivePath
      }
    }
    openTabsRef.current = nextTabs
    activePathRef.current = nextActivePath
    selectedScriptPathRef.current = nextSelectedScriptPath
    setOpenTabs(nextTabs)
    setActivePath(nextActivePath)
    setSelectedScriptPath(nextSelectedScriptPath)
    persistUiStateNow()
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
    const folderPath = selectedScriptNode?.kind === 'folder' ? selectedScriptNode.path : parentPath(selectedScriptPath) || SCRIPT_ROOT_PATH
    const path = childPath(folderPath, safeName)
    const file: ProjectTreeNode = {
      id: crypto.randomUUID(),
      name: safeName,
      path,
      kind: 'markdown',
      content: `| Personaggio | Interprete | Presenza | Note |\n| --- | --- | --- | --- |\n| PERSONAGGIO 1 | Da assegnare | In scena | Primo personaggio della scena. |\n\n# ${stripMarkdownExtension(safeName)}\n\n## Scena 1\n\n::regia{id="note-characters" type="characters" color="blue" title="Personaggi in scena" sceneId="scena-1" anchorId="note-characters"}\nIn scena: PERSONAGGIO 1.\n::\n\n### Sinossi\n\n::battuta{id="battuta-1" characterId="personaggio-1" character="PERSONAGGIO 1" sceneId="scena-1"}\nBattuta 1\n::\n`,
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
    const folderPath = selectedScriptNode?.kind === 'folder' ? selectedScriptNode.path : parentPath(selectedScriptPath) || SCRIPT_ROOT_PATH
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
    if (!selectedScriptNode || selectedScriptNode.path === SCRIPT_ROOT_PATH) return
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
    if (!nodeToRename || nodeToRename.path === SCRIPT_ROOT_PATH) return
    const nextPath = childPath(parentPath(nodeToRename.path) || SCRIPT_ROOT_PATH, name)
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
    if (!selectedScriptNode || selectedScriptNode.path === SCRIPT_ROOT_PATH) {
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
    if (!nodeToDelete || nodeToDelete.path === SCRIPT_ROOT_PATH) {
      return
    }

    const scripts = removeTreeNode(project.scripts, nodeToDelete.path)
    const nextPath =
      activePath === nodeToDelete.path || activePath.startsWith(`${nodeToDelete.path}/`)
        ? flattenMarkdownFiles(scripts)[0]?.path ?? ''
        : activePath
    persistProject({ ...project, scripts })
    setActivePath(nextPath)
    setSelectedScriptPath(nextPath || SCRIPT_ROOT_PATH)
    setOpenTabs((current) => {
      const nextTabs = current.filter((path) => path !== nodeToDelete.path && !path.startsWith(`${nodeToDelete.path}/`))
      return nextPath && !nextTabs.includes(nextPath) ? [nextPath, ...nextTabs] : nextTabs
    })
    setDrafts((current) => removeDraftPath(current, nodeToDelete.path))
  }

  const duplicateSelectedScriptNode = () => {
    if (!selectedScriptNode || selectedScriptNode.path === SCRIPT_ROOT_PATH) return
    const parent = parentPath(selectedScriptNode.path) || SCRIPT_ROOT_PATH
    const copyName = duplicateName(selectedScriptNode.name)
    const copyPath = childPath(parent, copyName)
    let copy = cloneTreeNode(selectedScriptNode, copyPath, copyName)
    const sourceFiles = flattenMarkdownFiles([selectedScriptNode])
    const copiedFiles = flattenMarkdownFiles([copy])
    const copiedNotes: DirectorNote[] = []
    const copiedCues: MediaCue[] = []

    for (const sourceFile of sourceFiles) {
      const targetPath = sourceFile.path === selectedScriptNode.path
        ? copyPath
        : sourceFile.path.replace(`${selectedScriptNode.path}/`, `${copyPath}/`)
      const targetFile = copiedFiles.find((file) => file.path === targetPath)
      if (!targetFile) continue

      const noteIds = new Map<string, string>()
      for (const note of project.notes.filter((item) => item.filePath === sourceFile.path)) {
        const id = duplicateScriptEntityId(note.id)
        noteIds.set(note.id, id)
        copiedNotes.push({
          ...note,
          id,
          filePath: targetPath,
          anchorId: duplicateScriptEntityId(note.anchorId),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }

      const cueIds = new Map<string, string>()
      for (const cue of project.cues.filter((item) => item.filePath === sourceFile.path)) {
        const id = duplicateScriptEntityId(cue.id)
        cueIds.set(cue.id, id)
        copiedCues.push({
          ...cue,
          id,
          filePath: targetPath,
          anchorId: duplicateScriptEntityId(cue.anchorId),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }

      const sourceContent = draftsRef.current[sourceFile.path] ?? sourceFile.content ?? ''
      const content = remapScriptReferenceIds(sourceContent, noteIds, cueIds)
      copy = updateTreeNode([copy], targetPath, (node) => ({ ...node, content, dirty: false }))[0]
    }

    const scripts = insertTreeChild(project.scripts, parent, copy)
    const nextProject = {
      ...project,
      scripts,
      notes: [...project.notes, ...copiedNotes],
      cues: [...project.cues, ...copiedCues],
    }
    persistProject(nextProject)
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
    if (!selectedMediaNode || isProtectedMediaRoot(selectedMediaNode)) return
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
    if (nodeToRename.path === nextPath) return
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
    const persistRename = () => {
      persistProject({ ...project, media, cues })
      setSelectedMediaPath(nextPath)
      showStatus(`Media rinominato: ${name}`)
    }

    if (hasProjectStorageRoot(project.rootPath)) {
      storage.moveMediaAsset(nodeToRename.path, nextPath)
        .then(persistRename)
        .catch((error) => setStorageStatus(`Rinomina media non riuscita: ${String(error)}`))
      return
    }

    persistRename()
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

    const applyDelete = () => {
      const currentProject = applyDraftsToProject(project, draftsWithCurrentEditorContent())
      const removedCueIds = currentProject.cues
        .filter((cue) => isPathInside(cue.src, nodeToDelete.path))
        .map((cue) => cue.id)
      const media = removeTreeNode(currentProject.media, nodeToDelete.path)
      const cues = currentProject.cues.filter((cue) => !removedCueIds.includes(cue.id))
      const scripts = removeCueReferencesFromScripts(currentProject.scripts, removedCueIds)
      removeCueReferencesFromEditor(removedCueIds)
      persistProject({ ...currentProject, media, cues, scripts })
      setSelectedMediaPath(parentPath(nodeToDelete.path) || '/media')
      if (selectedCueId && !cues.some((cue) => cue.id === selectedCueId)) {
        setSelectedCueId(cues[0]?.id ?? '')
      }
      showStatus(`Media eliminato: ${nodeToDelete.name}`)
    }

    if (hasProjectStorageRoot(project.rootPath)) {
      storage.deleteMediaAsset(nodeToDelete.path)
        .then(applyDelete)
        .catch((error) => setStorageStatus(`Eliminazione media non riuscita: ${String(error)}`))
      return
    }

    applyDelete()
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
  moveMediaNodeRef.current = moveMediaNode

  useEffect(() => {
    const clearPointerTarget = () => {
      const target = pointerDropTargetRef.current
      if (target?.kind === 'editor') target.element.classList.remove(POINTER_EDITOR_TARGET_CLASS)
      if (target?.kind === 'media') target.element.classList.remove(POINTER_MEDIA_TARGET_CLASS)
      pointerDropTargetRef.current = undefined
      setPointerDropIndicator(undefined)
    }

    const setPointerTarget = (target: PointerDropTarget | undefined) => {
      const current = pointerDropTargetRef.current
      if (current?.element === target?.element && current?.kind === target?.kind) {
        pointerDropTargetRef.current = target
        if (target?.kind === 'editor' && editor) {
          setPointerDropIndicator(editorDropIndicator(editor.view, target.position))
        }
        return
      }
      clearPointerTarget()
      if (!target) return
      target.element.classList.add(target.kind === 'editor' ? POINTER_EDITOR_TARGET_CLASS : POINTER_MEDIA_TARGET_CLASS)
      pointerDropTargetRef.current = target
      if (target.kind === 'editor' && editor) {
        setPointerDropIndicator(editorDropIndicator(editor.view, target.position))
      }
    }

    const clearPointerDrag = () => {
      clearPointerTarget()
      clearGlobalDragPayload()
      setPointerDragPreview(undefined)
      document.body.classList.remove(POINTER_DRAGGING_CLASS)
      document.documentElement.classList.remove(POINTER_DRAGGING_CLASS)
    }

    const editorDropTarget = (event: InternalDragEvent, payload: StagedeskDragPayload): PointerDropTarget | undefined => {
      if (!editor || !isEditorDragPayload(payload.type)) return undefined
      const view = editor.view
      const pointTarget = document.elementFromPoint(event.clientX, event.clientY)
      if (!pointTarget || !view.dom.contains(pointTarget)) return undefined
      const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
      if (position === undefined) return undefined
      const element = editorBlockElementAtPosition(view, position)
      return { kind: 'editor', position, element }
    }

    const mediaDropTarget = (event: InternalDragEvent, payload: StagedeskDragPayload): PointerDropTarget | undefined => {
      if (payload.type !== MEDIA_PATH_DND_TYPE) return undefined
      const pointTarget = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null
      if (!pointTarget) return undefined

      const folderElement = pointTarget.closest<HTMLElement>('[data-media-drop-path][data-media-kind="folder"]')
      if (folderElement) {
        const folderPath = folderElement.dataset.mediaDropPath ?? ''
        if (folderPath && folderPath !== payload.value && parentPath(payload.value) !== folderPath) {
          return { kind: 'media', folderPath, element: folderElement }
        }
      }

      const rootElement = pointTarget.closest<HTMLElement>('[data-media-drop-root="true"]')
      if (rootElement && parentPath(payload.value) !== '/media') {
        return { kind: 'media', folderPath: '/media', element: rootElement }
      }

      return undefined
    }

    const onPointerMove = (event: InternalDragEvent) => {
      const payload = readAnyGlobalDragPayload()
      if (!payload) {
        clearPointerTarget()
        setPointerDragPreview(undefined)
        document.body.classList.remove(POINTER_DRAGGING_CLASS)
        document.documentElement.classList.remove(POINTER_DRAGGING_CLASS)
        return
      }

      const distance = pointerDragDistance(payload, event)
      if (!payload.pointerActive && distance < 6) return
      payload.pointerActive = true
      writeGlobalDragPayload(payload.type, payload.value, payload)
      document.body.classList.add(POINTER_DRAGGING_CLASS)
      document.documentElement.classList.add(POINTER_DRAGGING_CLASS)
      setPointerDragPreview(dragPreviewFromPayload(payload, event))
      if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) {
        document.activeElement.blur()
      }
      window.getSelection()?.removeAllRanges()
      event.preventDefault()

      const target = editorDropTarget(event, payload) ?? mediaDropTarget(event, payload)
      setPointerTarget(target)
    }

    const onPointerUp = (event: InternalDragEvent) => {
      const payload = readAnyGlobalDragPayload()
      if (!payload) {
        clearPointerDrag()
        return
      }

      const target = payload.pointerActive
        ? editorDropTarget(event, payload) ?? mediaDropTarget(event, payload) ?? pointerDropTargetRef.current
        : pointerDropTargetRef.current
      if (payload.pointerActive && target?.kind === 'editor' && editor) {
        event.preventDefault()
        const handled = handleEditorPointerDrop(
          editor.view,
          payload,
          target.position,
          projectRef.current,
          activeFilePathRef.current,
          cueDropActionsRef.current,
          setSelectedNoteId,
          setSelectedCueId,
          showStatus,
        )
        clearPointerDrag()
        if (handled) return
      }

      if (payload.pointerActive && target?.kind === 'media' && payload.type === MEDIA_PATH_DND_TYPE) {
        event.preventDefault()
        const sourcePath = payload.value
        clearPointerDrag()
        if (sourcePath && sourcePath !== target.folderPath && parentPath(sourcePath) !== target.folderPath) {
          void moveMediaNodeRef.current(sourcePath, target.folderPath)
        }
        return
      }

      clearPointerDrag()
    }

    const onPointerCancel = () => clearPointerDrag()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clearPointerDrag()
    }

    window.addEventListener('pointermove', onPointerMove, { passive: false })
    window.addEventListener('pointerup', onPointerUp, { passive: false })
    window.addEventListener('pointercancel', onPointerCancel)
    window.addEventListener('mousemove', onPointerMove, { passive: false })
    window.addEventListener('mouseup', onPointerUp, { passive: false })
    window.addEventListener('blur', onPointerCancel)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
      window.removeEventListener('mousemove', onPointerMove)
      window.removeEventListener('mouseup', onPointerUp)
      window.removeEventListener('blur', onPointerCancel)
      window.removeEventListener('keydown', onKeyDown)
      clearPointerDrag()
    }
  }, [editor, showStatus])

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

  const dialogueCharacters = useMemo(
    () => activeCharacters.length > 0
      ? activeCharacters
      : [{ id: 'personaggio-1', name: 'PERSONAGGIO 1' }],
    [activeCharacters],
  )

  const insertActorDialogueForCharacter = useCallback((selectedCharacter: CharacterOption) => {
    if (!editor || !activeFile) return
    const dialogueId = `battuta-${crypto.randomUUID().slice(0, 8)}`
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: 'scriptDialogue',
          attrs: {
            id: dialogueId,
            characterId: selectedCharacter.id,
            character: selectedCharacter.name,
            text: 'Nuova battuta.',
            sceneId: currentScene ?? '',
          },
        },
        { type: 'paragraph' },
      ])
      .run()
    setTheaterMenuOpen(false)
    setTheaterMenuPosition(undefined)
    showStatus(`Battuta inserita: ${selectedCharacter.name}`)
  }, [activeFile, currentScene, editor, showStatus])

  const toggleTheaterMenu = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (theaterMenuOpen) {
      setTheaterMenuOpen(false)
      setTheaterMenuPosition(undefined)
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    setTheaterMenuPosition({
      top: rect.bottom + 4,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 286)),
    })
    setTheaterMenuOpen(true)
  }

  const toggleTableMenu = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (tableMenuOpen) {
      setTableMenuOpen(false)
      setTableMenuPosition(undefined)
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    setTableMenuPosition({
      top: rect.bottom + 4,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 246)),
    })
    setTableMenuOpen(true)
  }

  const toggleTableInsertMenu = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (tableInsertMenuOpen) {
      setTableInsertMenuOpen(false)
      setTableInsertMenuPosition(undefined)
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    setTableInsertSize({ rows: 3, cols: 3 })
    setTableInsertMenuPosition({
      top: rect.bottom + 4,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 236)),
    })
    setTableInsertMenuOpen(true)
  }

  const syncTableContextFromTarget = (target: EventTarget | null) => {
    const element = target instanceof HTMLElement ? target : null
    setTableContextActive(Boolean(element?.closest('table')))
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

  const toggleAllEditorNotes = () => {
    if (!editor || editorEditingDisabled) return
    const summary = editorNoteCollapseSummary(editor)
    if (summary.total === 0) {
      showStatus('Nessuna nota nel file attivo')
      return
    }

    const nextCollapsed = summary.collapsed !== summary.total
    const updatedNoteIds: string[] = []
    const transaction = editor.state.tr
    editor.state.doc.descendants((node, position) => {
      if (node.type.name !== 'scriptNote') return
      const attrs: Record<string, unknown> = { ...node.attrs, collapsed: nextCollapsed }
      const noteId = String(attrs.refId ?? '')
      if (noteId) updatedNoteIds.push(noteId)
      transaction.setNodeMarkup(position, undefined, attrs)
    })
    if (!transaction.docChanged) return

    editor.view.dispatch(transaction)
    const now = new Date().toISOString()
    setProject((current) => ({
      ...current,
      notes: current.notes.map((note) =>
        updatedNoteIds.includes(note.id)
          ? { ...note, collapsed: nextCollapsed, updatedAt: now }
          : note,
      ),
    }))
    showStatus(nextCollapsed ? 'Note collassate' : 'Note espanse')
  }

  const insertEditorTable = (rows: number, cols: number) => {
    if (!editor || editorEditingDisabled) return
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()
    setTableInsertMenuOpen(false)
    setTableInsertMenuPosition(undefined)
    setTableContextActive(true)
    showStatus(`Tabella ${rows} x ${cols} inserita`)
  }

  const addCurrentTableRow = () => {
    if (!editor || !selectionIsInsideNode(editor, 'table')) {
      showStatus('Posiziona il cursore nella tabella personaggi')
      return
    }
    editor.chain().focus().addRowAfter().run()
    showStatus('Riga tabella aggiunta')
  }

  const deleteCurrentTableRow = () => {
    if (!editor || !selectionIsInsideNode(editor, 'table')) {
      showStatus('Posiziona il cursore nella tabella personaggi')
      return
    }
    const tableContext = currentTableContext(editor)
    if (tableContext.isCharacterTable && tableContext.isHeaderRow) {
      showStatus('La riga intestazione della tabella personaggi non può essere eliminata')
      return
    }
    editor.chain().focus().deleteRow().run()
    showStatus('Riga tabella eliminata')
  }

  const deleteCurrentTable = () => {
    if (!editor || !selectionIsInsideNode(editor, 'table')) {
      showStatus('Posiziona il cursore nella tabella personaggi')
      return
    }
    if (currentTableContext(editor).isCharacterTable) {
      showStatus('La tabella personaggi non può essere eliminata')
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

  const removeCueReferencesFromEditor = (cueIds: string[]) => {
    if (!editor || cueIds.length === 0) return
    const idSet = new Set(cueIds)
    const matches: ScriptNodeMatch[] = []
    editor.state.doc.descendants((node, position) => {
      if (node.type.name !== 'scriptChip' || node.attrs.kind !== 'cue' || !idSet.has(String(node.attrs.refId ?? ''))) {
        return
      }
      const match: ScriptChipMatch = { position, nodeSize: node.nodeSize, attrs: node.attrs, node }
      matches.push(standaloneBlockAroundInlineNode(editor.state.doc, match) ?? match)
    })
    if (matches.length === 0) return

    const transaction = matches
      .filter((match, index, items) => items.findIndex((item) => item.position === match.position) === index)
      .sort((left, right) => right.position - left.position)
      .reduce(
        (currentTransaction, match) => currentTransaction.delete(match.position, match.position + match.nodeSize),
        editor.state.tr,
      )
    editor.view.dispatch(transaction.scrollIntoView())
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
    const assetsWithFiles = files.map((file) => ({
      file,
      asset: {
        id: crypto.randomUUID(),
        name: file.name,
        path: childPath(folderPath, file.name),
        kind: mediaKind(file.type, file.name),
        size: file.size,
        objectUrl: hasProjectStorageRoot(project.rootPath) ? undefined : URL.createObjectURL(file),
      } satisfies MediaAsset,
    }))

    void Promise.all(
      assetsWithFiles.map(({ asset, file }) =>
        hasProjectStorageRoot(project.rootPath)
          ? storage.writeMediaAsset(asset.path, file).then(() => asset)
          : Promise.resolve(asset),
      ),
    )
      .then((assets) => {
        persistProject({ ...project, media: insertTreeChildren(project.media, folderPath, assets) })
        if (assets[0]) setSelectedMediaPath(assets[0].path)
        expandPath(folderPath)
        showStatus(`${assets.length} media importati`)
      })
      .catch((error) => setStorageStatus(`Import media non riuscito: ${String(error)}`))
    event.target.value = ''
  }

  const insertCueChip = (cue: MediaCue, position?: number, removeExisting = false) => {
    if (!editor) return

    if (removeExisting) {
      const existing = chipMatchByRef(editor.state.doc, 'cue', cue.id)
      if (existing) {
        const movable = standaloneBlockAroundInlineNode(editor.state.doc, existing) ?? existing
        const transaction = editor.state.tr.delete(movable.position, movable.position + movable.nodeSize)
        editor.view.dispatch(transaction)
        if (position !== undefined && movable.position < position) {
          position = Math.max(0, position - movable.nodeSize)
        }
      }
    }

    const chipNode = editor.schema.nodes.scriptChip.create({
      kind: 'cue',
      label: cueChipLabel(cue),
      refId: cue.id,
      color: cue.type,
    })
    const contentNode = editor.schema.nodes.paragraph.create(null, [chipNode])

    if (position !== undefined) {
      const safePosition = insertionPositionForNode(editor.state.doc, position, contentNode)
      if (safePosition === undefined) return
      const transaction = editor.state.tr.insert(safePosition, contentNode)
      editor.view.dispatch(transaction.setSelection(selectionNear(transaction.doc, safePosition + contentNode.nodeSize, -1)))
      return
    }
    editor.chain().focus().insertContent({
      type: 'paragraph',
      content: [{ type: 'scriptChip', attrs: { kind: 'cue', label: cueChipLabel(cue), refId: cue.id, color: cue.type } }],
    }).run()
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

  const filteredCues = useMemo(
    () => fileCues
      .filter((cue) => {
        if (noteMode === 'all') return true
        if (noteMode === 'scene') return currentScene ? sceneIdsMatch(cue.sceneId, currentScene) : false
        return currentEditorCueRefIds.includes(cue.id)
      })
      .filter((cue) => (search ? `${cue.title} ${cue.src} ${cue.description}`.toLowerCase().includes(search.toLowerCase()) : true)),
    [currentEditorCueRefIds, currentScene, fileCues, noteMode, search],
  )

  useEffect(() => {
    if (filteredCues.length === 0) {
      setCuePage(0)
      return
    }

    const selectedIndex = filteredCues.findIndex((cue) => cue.id === selectedCueId)
    if (selectedIndex < 0) {
      setSelectedCueId(filteredCues[0].id)
      setCuePage(0)
      return
    }

    const selectedPage = Math.floor(selectedIndex / CUE_PAGE_SIZE)
    if (selectedPage !== cuePageRef.current) setCuePage(selectedPage)
  }, [filteredCues, selectedCueId])

  const cuePageCount = Math.max(1, Math.ceil(filteredCues.length / CUE_PAGE_SIZE))
  const cuePageStart = Math.min(cuePage, cuePageCount - 1) * CUE_PAGE_SIZE
  const paginatedCues = filteredCues.slice(cuePageStart, cuePageStart + CUE_PAGE_SIZE)

  useEffect(() => {
    setCuePage(0)
  }, [activePath, currentScene, noteMode, search])

  useEffect(() => {
    diagnosticLog('cue-filter-state', {
      activePath,
      mode: noteMode,
      currentScene,
      fileCueIds: fileCues.map((cue) => cue.id),
      fileCueScenes: fileCues.map((cue) => ({ id: cue.id, sceneId: cue.sceneId })),
      contextualCueIds: currentEditorCueRefIds,
      filteredCueIds: filteredCues.map((cue) => cue.id),
      selectedCueId,
    })
  }, [activePath, currentEditorCueRefIds, currentScene, fileCues, filteredCues, noteMode, selectedCueId])

  const visibleSelectedCue = filteredCues.find((cue) => cue.id === selectedCueId)
  const visibleSelectedCueAsset = visibleSelectedCue ? findTreeNode(project.media, visibleSelectedCue.src) : undefined

  const exportActiveFile = async (mode: 'complete' | 'clean') => {
    try {
      const markdown = buildActiveExtendedMarkdown() ?? ''
      await persistDraftsNow()
    const baseName = stripMarkdownExtension(activeFile?.name ?? 'la locandiera')
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

  const loadShareState = async (file: ProjectTreeNode | undefined = activeFile) => {
    if (!user || !file || activeAppDocument) {
      setPublishState({ status: 'error', error: 'Apri un file copione del progetto prima di condividere.' })
      return
    }

    try {
      const { data, error } = await supabase
        .from(SCRIPT_SHARE_TABLE)
        .select('uid, storage_path, published_at')
        .eq('owner_id', user.id)
        .eq('project_id', project.id)
        .eq('script_path', file.path)
        .maybeSingle()
      if (error) throw error
      if (!data?.uid) {
        setPublishState({ status: 'idle' })
        return
      }
      const pin = window.localStorage.getItem(`${SHARE_PIN_STORAGE_PREFIX}${data.uid}`) ?? undefined
      setPublishState({
        status: 'published',
        shareUid: data.uid,
        storagePath: data.storage_path ?? undefined,
        pin,
        pinAvailable: Boolean(pin),
        url: shareUrlForUid(data.uid),
        publishedAt: data.published_at,
      })
    } catch (error) {
      setPublishState({ status: 'error', error: publishErrorMessage(error) })
    }
  }

  const openPublishDialog = () => {
    setPublishDialogOpen(true)
    void loadShareState()
  }

  const publishScriptJson = async (mode: 'publish' | 'update' = 'publish', resetPin = false) => {
    if (!activeFile || activeAppDocument) {
      setPublishState({ status: 'error', error: 'Apri un file copione del progetto prima di condividere.' })
      return
    }
    if (!user) {
      setPublishState({ status: 'error', error: 'Utente non autenticato.' })
      return
    }

    const markdown = buildActiveExtendedMarkdown() ?? editorMarkdown
    const payload = buildPublishedScriptPayload(project, activeFile, markdown, activeCharacters)
    const nextPin = resetPin || !publishState.shareUid
      ? generateSharePin()
      : publishState.pin
    setPublishState((current) => ({ ...current, status: 'publishing', error: undefined }))

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      if (!sessionData.session?.user?.id) {
        throw new Error('Sessione Supabase non disponibile: esegui nuovamente l’accesso.')
      }
      const { data, error } = await supabase.rpc('upsert_script_share', {
        p_share_uid: publishState.shareUid ?? null,
        p_project_id: project.id,
        p_script_path: activeFile.path,
        p_project_name: project.name,
        p_script_name: activeFile.name,
        p_payload: payload,
        p_pin: nextPin ?? null,
        p_reset_pin: resetPin,
      })
      if (error) throw error
      const shareUid = typeof data?.uid === 'string' ? data.uid : publishState.shareUid
      if (!shareUid) throw new Error('UID condivisione non restituito da Supabase.')

      const storagePath = `${user.id}/${shareUid}.json`
      const { error: uploadError } = await supabase.storage
        .from(SCRIPT_SHARE_BUCKET)
        .upload(storagePath, JSON.stringify(payload, null, 2), {
          contentType: 'application/json',
          upsert: true,
        })
      if (uploadError) throw uploadError

      const { error: metadataError } = await supabase.rpc('upsert_script_share', {
        p_share_uid: shareUid,
        p_project_id: project.id,
        p_script_path: activeFile.path,
        p_project_name: project.name,
        p_script_name: activeFile.name,
        p_payload: payload,
        p_storage_path: storagePath,
        p_pin: null,
        p_reset_pin: false,
      })
      if (metadataError) throw metadataError
      if (nextPin) window.localStorage.setItem(`${SHARE_PIN_STORAGE_PREFIX}${shareUid}`, nextPin)
      const url = shareUrlForUid(shareUid)
      setPublishState({
        status: 'published',
        url,
        shareUid,
        storagePath,
        pin: nextPin,
        pinAvailable: Boolean(nextPin),
        publishedAt: typeof data?.publishedAt === 'string' ? data.publishedAt : payload.publishedAt,
      })
      setShareIndicatorForPath(activeFile.path, { status: 'shared', url })
      showStatus(resetPin ? 'PIN condivisione reimpostato' : mode === 'update' ? 'Condivisione aggiornata' : 'File condiviso')
    } catch (error) {
      const message = publishErrorMessage(error)
      setPublishState((current) => ({ ...current, status: 'error', error: message }))
      setShareIndicatorForPath(activeFile.path, { status: 'error', message })
      showStatus(`Condivisione non riuscita: ${message}`, 12000)
    }
  }

  const unpublishScriptJson = async () => {
    if (!user || !activeFile) return
    if (!publishState.shareUid) return
    setPublishState((current) => ({ ...current, status: 'removing', error: undefined }))
    try {
      const storagePath = publishState.storagePath ?? `${user.id}/${publishState.shareUid}.json`
      const { error: storageError } = await supabase.storage
        .from(SCRIPT_SHARE_BUCKET)
        .remove([storagePath])
      if (storageError) throw storageError
      const { error } = await supabase
        .from(SCRIPT_SHARE_TABLE)
        .delete()
        .eq('owner_id', user.id)
        .eq('uid', publishState.shareUid)
      if (error) throw error
      window.localStorage.removeItem(`${SHARE_PIN_STORAGE_PREFIX}${publishState.shareUid}`)
      setPublishState({ status: 'idle' })
      setShareIndicatorForPath(activeFile.path, { status: 'not-shared' })
      showStatus('Condivisione interrotta')
    } catch (error) {
      const message = publishErrorMessage(error)
      setPublishState((current) => ({ ...current, status: 'error', error: message }))
      setShareIndicatorForPath(activeFile.path, { status: 'error', message })
      showStatus(`Interruzione condivisione non riuscita: ${message}`, 12000)
    }
  }

  const copyPublishedLink = async () => {
    if (!publishState.url) return
    try {
      await navigator.clipboard.writeText(publishState.url)
      showStatus('Link condivisione copiato')
    } catch (error) {
      showStatus(`Copia link non riuscita: ${String(error)}`)
    }
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
        onClose={closeFullscreenAndRestoreEditor}
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
          <div className="topbar-meta">
            <p className="storage-status">{storageStatus}</p>
          </div>
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
            className="topbar-icon-button primary fullscreen-launch-button"
            title="Fullscreen"
            aria-label="Fullscreen"
            onClick={startFullscreenWithValidation}
            disabled={editorEditingDisabled}
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
                  className={activePath === 'app://documentation' ? 'active' : ''}
                  onClick={() => {
                    setAppMenuOpen(false)
                    setAppMenuPosition(undefined)
                    openAppDocumentTab('app://documentation')
                  }}
                >
                  <BookOpen size={15} />
                  Documentazione
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
              onClick={() => selectLeftTab('outline')}
            >
              <ListTree size={16} />
              <span className="sr-only">Indice documento</span>
            </button>
            <button
              type="button"
              className={leftTab === 'script' ? 'active' : ''}
              title="Copioni"
              aria-label="Copioni"
              onClick={() => selectLeftTab('script')}
            >
              <BookOpen size={16} />
              <span className="sr-only">Copioni</span>
            </button>
            <button
              type="button"
              className={leftTab === 'media' ? 'active' : ''}
              title="Media"
              aria-label="Media"
              onClick={() => selectLeftTab('media')}
            >
              <Images size={16} />
              <span className="sr-only">Media</span>
            </button>
            <button
              type="button"
              className={leftTab === 'bookmarks' ? 'active' : ''}
              title="Bookmark"
              aria-label="Bookmark"
              onClick={() => selectLeftTab('bookmarks')}
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
                <button
                  type="button"
                  title={selectedMediaIsProtectedRoot ? 'Le cartelle root della raccolta non possono essere rinominate' : 'Rinomina selezione'}
                  onClick={renameSelectedMediaNode}
                  disabled={!selectedMediaNode || selectedMediaIsProtectedRoot}
                >
                  <Pencil size={16} />
                </button>
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
                data-media-drop-root="true"
                onDragOver={(event) => {
                  if (!hasDragPayload(event.dataTransfer, MEDIA_PATH_DND_TYPE)) return
                  event.preventDefault()
                  event.stopPropagation()
                  event.dataTransfer.dropEffect = 'move'
                  event.currentTarget.classList.add('drop-target')
                }}
                onDragLeave={(event) => event.currentTarget.classList.remove('drop-target')}
                onDrop={(event) => {
                  const sourcePath = readDragPayload(event.dataTransfer, MEDIA_PATH_DND_TYPE, MEDIA_PATH_DND_PREFIX)
                  event.currentTarget.classList.remove('drop-target')
                  if (!sourcePath) return
                  event.preventDefault()
                  event.stopPropagation()
                  clearGlobalDragPayload()
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
                <MediaPreview
                  asset={selectedMediaNode}
                  projectRootPath={project.rootPath}
                  onCue={insertCue}
                  onStatus={setStorageStatus}
                />
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
          <div className="file-tabbar-shell">
            {fileTabOverflow.left ? (
              <button
                type="button"
                className="file-tab-scroll-button file-tab-scroll-button-left"
                aria-label="Mostra tab precedenti"
                title="Mostra tab precedenti"
                onClick={() => scrollFileTabs(-1)}
              >
                <ChevronLeft size={15} />
              </button>
            ) : null}
            <div className="file-tabbar" ref={fileTabbarRef}>
              {openTabs.length > 0 ? (
                openTabs.map((path) => {
                  const tabFile = findMarkdownNode(project.scripts, path)
                  const isStoreTab = path === STORE_TAB_PATH
                  const tabTitle = tabFile?.name ?? getAppDocument(path)?.title ?? (isStoreTab ? 'Store' : path.split('/').pop())
                  return (
                    <button
                      type="button"
                      key={path}
                      className={path === activePath ? fileTabClass(tabFile, true, isAppDocumentPath(path) || isStoreTab) : fileTabClass(tabFile, false, isAppDocumentPath(path) || isStoreTab)}
                      onClick={() => {
                        activePathRef.current = path
                        if (!isAppDocumentPath(path) && !isStoreTab) selectedScriptPathRef.current = path
                        setActivePath(path)
                        if (!isAppDocumentPath(path) && !isStoreTab) setSelectedScriptPath(path)
                        persistUiStateNow()
                      }}
                    >
                      {isStoreTab && storeLoading ? <RefreshCw size={13} className="file-tab-loading spin-icon" aria-hidden="true" /> : null}
                      <span className="file-tab-name">{stripMarkdownExtension(tabTitle ?? '')}</span>
                      {tabFile ? <ShareStatusIndicator state={shareIndicators[path] ?? { status: 'disabled' }} /> : null}
                      {tabFile?.dirty ? <span className="dirty-dot" aria-label="modificato" /> : null}
                      <span
                        role="button"
                        tabIndex={0}
                        className="file-tab-close"
                        aria-label={`Chiudi ${tabTitle}`}
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
            {fileTabOverflow.right ? (
              <button
                type="button"
                className="file-tab-scroll-button file-tab-scroll-button-right"
                aria-label="Mostra tab successivi"
                title="Mostra tab successivi"
                onClick={() => scrollFileTabs(1)}
              >
                <ChevronRight size={15} />
              </button>
            ) : null}
          </div>
          {activeStoreTab ? (
            <div className="store-tab-view" data-loading={storeLoading}>
              {storeLoading ? (
                <div className="store-loading" role="status">
                  <RefreshCw size={18} className="spin-icon" />
                  <span>Caricamento store...</span>
                </div>
              ) : null}
              <iframe title="StageDesk Store" src={STORE_URL} onLoad={() => setStoreLoading(false)} />
            </div>
          ) : (
            <>
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
              <span className="toolbar-inline-divider" aria-hidden="true" />
              <button
                type="button"
                title={toggleAllNotesLabel}
                aria-label={toggleAllNotesLabel}
                onClick={toggleAllEditorNotes}
                disabled={editorEditingDisabled || editorNoteCollapseSummaryValue.total === 0}
              >
                {allEditorNotesCollapsed ? <BookOpen size={15} /> : <PanelTopClose size={15} />}
              </button>
              <div className="toolbar-menu table-insert-toolbar-menu" ref={tableInsertMenuRef}>
                <button
                  type="button"
                  className="toolbar-menu-trigger icon-only table-insert-menu-trigger"
                  title="Inserisci tabella"
                  aria-label="Inserisci tabella"
                  aria-haspopup="menu"
                  aria-expanded={tableInsertMenuOpen}
                  onClick={toggleTableInsertMenu}
                  disabled={editorEditingDisabled}
                >
                  <Table2 size={15} />
                </button>
                {tableInsertMenuOpen ? (
                  <div
                    className="toolbar-menu-popover table-insert-popover floating"
                    role="menu"
                    style={tableInsertMenuPosition}
                  >
                    <div className="table-insert-size">
                      {tableInsertSize.rows} x {tableInsertSize.cols}
                    </div>
                    <div className="table-insert-picker" role="grid" aria-label="Dimensione tabella">
                      {Array.from({ length: 8 }, (_, rowIndex) =>
                        Array.from({ length: 8 }, (_, colIndex) => {
                          const rows = rowIndex + 1
                          const cols = colIndex + 1
                          const selected = rows <= tableInsertSize.rows && cols <= tableInsertSize.cols
                          return (
                            <button
                              type="button"
                              key={`${rows}-${cols}`}
                              role="gridcell"
                              className={selected ? 'selected' : ''}
                              title={`Inserisci tabella ${rows} x ${cols}`}
                              aria-label={`Inserisci tabella ${rows} x ${cols}`}
                              onMouseEnter={() => setTableInsertSize({ rows, cols })}
                              onFocus={() => setTableInsertSize({ rows, cols })}
                              onClick={() => insertEditorTable(rows, cols)}
                            />
                          )
                        }),
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <span className="toolbar-divider" aria-hidden="true" />
            <div className="toolbar-menu" ref={theaterMenuRef}>
              <button
                type="button"
                className="toolbar-menu-trigger icon-only theater-menu-trigger"
                title="Strumenti teatro"
                aria-label="Strumenti teatro"
                aria-haspopup="menu"
                aria-expanded={theaterMenuOpen}
                onClick={toggleTheaterMenu}
              >
                <Drama size={16} />
              </button>
              {theaterMenuOpen ? (
                <div className="toolbar-menu-popover theater-menu-popover floating" role="menu" style={theaterMenuPosition}>
                  <div className="theater-submenu">
                    <div className="theater-submenu-trigger" role="menuitem" tabIndex={0}>
                      <ListTree size={14} />
                      <span>Struttura</span>
                      <ChevronRight size={14} />
                    </div>
                    <div className="theater-submenu-panel" role="menu" aria-label="Struttura">
                      <button
                        type="button"
                        role="menuitem"
                        className={toolbarState.heading1 ? 'active' : ''}
                        disabled={editorEditingDisabled}
                        onClick={() => setCurrentBlockAsHeading(1)}
                      >
                        <Heading1 size={14} />
                        <span className="menu-item-label">Atto</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className={toolbarState.heading2 ? 'active' : ''}
                        disabled={editorEditingDisabled}
                        onClick={() => setCurrentBlockAsHeading(2)}
                      >
                        <Heading2 size={14} />
                        <span className="menu-item-label">Scena</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className={toolbarState.heading3 ? 'active' : ''}
                        disabled={editorEditingDisabled}
                        onClick={() => setCurrentBlockAsHeading(3)}
                      >
                        <Heading3 size={14} />
                        <span className="menu-item-label">Sezione</span>
                      </button>
                    </div>
                  </div>
                  <div className="theater-submenu">
                    <div className="theater-submenu-trigger" role="menuitem" tabIndex={0}>
                      <BookOpen size={14} />
                      <span>Note</span>
                      <ChevronRight size={14} />
                    </div>
                    <div className="theater-submenu-panel" role="menu" aria-label="Note">
                      {noteMenuTypes.map((noteType) => (
                        <Fragment key={noteType.id}>
                          <button
                            type="button"
                            role="menuitem"
                            className={noteType.id === selectedNoteType?.id ? 'active' : ''}
                            disabled={editorEditingDisabled}
                            onClick={() => {
                              setTheaterMenuOpen(false)
                              setTheaterMenuPosition(undefined)
                              insertNote(noteType)
                            }}
                          >
                            <span className={`note-dot ${noteType.color}`} />
                            {noteType.label}
                          </button>
                          {noteType.id === 'general' || noteType.id === 'tone' ? (
                            <span className="theater-menu-separator" aria-hidden="true" />
                          ) : null}
                        </Fragment>
                      ))}
                    </div>
                  </div>
                  <div className="theater-submenu">
                    <div className="theater-submenu-trigger" role="menuitem" tabIndex={0}>
                      <Quote size={14} />
                      <span>Battuta</span>
                      <ChevronRight size={14} />
                    </div>
                    <div className="theater-submenu-panel" role="menu" aria-label="Battuta">
                      {dialogueCharacters.map((character) => (
                        <button
                          type="button"
                          role="menuitem"
                          key={character.id}
                          disabled={editorEditingDisabled}
                          onClick={() => insertActorDialogueForCharacter(character)}
                        >
                          <Quote size={14} />
                          <span className="menu-item-label">{character.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="theater-submenu">
                    <div className="theater-submenu-trigger" role="menuitem" tabIndex={0}>
                      <Download size={14} />
                      <span>Export</span>
                      <ChevronRight size={14} />
                    </div>
                    <div className="theater-submenu-panel" role="menu" aria-label="Export">
                      <button
                        type="button"
                        role="menuitem"
                        disabled={!activeFile}
                        onClick={() => {
                          setTheaterMenuOpen(false)
                          setTheaterMenuPosition(undefined)
                          void exportActiveFile('complete')
                        }}
                      >
                        <Download size={14} />
                        Completo
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={!activeFile}
                        onClick={() => {
                          setTheaterMenuOpen(false)
                          setTheaterMenuPosition(undefined)
                          void exportActiveFile('clean')
                        }}
                      >
                        <Eraser size={14} />
                        Pulito
                      </button>
                    </div>
                  </div>
                  <span className="theater-menu-separator" aria-hidden="true" />
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!activeFile || Boolean(activeAppDocument)}
                    onClick={() => {
                      setTheaterMenuOpen(false)
                      setTheaterMenuPosition(undefined)
                      openPublishDialog()
                    }}
                  >
                    <CloudUpload size={14} />
                    Condividi
                  </button>
                </div>
              ) : null}
            </div>
            {toolbarState.table || tableContextActive ? (
              <div className="toolbar-menu" ref={tableMenuRef}>
                <button
                  type="button"
                  className="toolbar-menu-trigger icon-only table-menu-trigger"
                  title="Azioni tabella"
                  aria-label="Azioni tabella"
                  aria-haspopup="menu"
                  aria-expanded={tableMenuOpen}
                  onClick={toggleTableMenu}
                  disabled={editorEditingDisabled}
                >
                  <Rows3 size={16} />
                </button>
                {tableMenuOpen ? (
                  <div className="toolbar-menu-popover table-menu-popover floating" role="menu" style={tableMenuPosition}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setTableMenuOpen(false)
                        setTableMenuPosition(undefined)
                        addCurrentTableRow()
                      }}
                      disabled={editorEditingDisabled}
                    >
                      <Plus size={14} />
                      Aggiungi riga
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setTableMenuOpen(false)
                        setTableMenuPosition(undefined)
                        deleteCurrentTableRow()
                      }}
                      disabled={editorEditingDisabled || selectedCharacterTableHeaderRow}
                    >
                      <PanelTopClose size={14} />
                      Elimina riga
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setTableMenuOpen(false)
                        setTableMenuPosition(undefined)
                        deleteCurrentTable()
                      }}
                      disabled={editorEditingDisabled || selectedCharacterTable}
                    >
                      <Trash2 size={14} />
                      Elimina tabella
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <div
            className="editor-scroll-area"
            onPointerUp={(event) => syncTableContextFromTarget(event.target)}
            onKeyUp={() => setTableContextActive(editor ? selectionIsInsideNode(editor, 'table') : false)}
          >
            <EditorContent editor={editor} />
          </div>
          {scriptValidationIssues.length > 0 ? (
            <section className="script-debugger" aria-label="Controllo copione">
              <div className="script-debugger-header">
                <AlertTriangle size={16} />
                <strong>Controllo copione</strong>
                <span>{scriptValidationIssues.length} anomalie</span>
              </div>
              <div className="script-debugger-list">
                {scriptValidationIssues.map((issue) => (
                  <button
                    type="button"
                    key={issue.id}
                    className={`script-debugger-item ${issue.severity}`}
                    onClick={() => focusValidationIssue(issue)}
                  >
                    <span className="script-debugger-line">Riga {issue.line}</span>
                    <span className="script-debugger-type">{issue.type}</span>
                    <span className="script-debugger-message">{issue.message}</span>
                    <span className="script-debugger-source">
                      <HighlightedIssueLine line={issue.lineText} highlight={issue.highlight} />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
            </>
          )}
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
            {paginatedCues.map((cue) => (
              <button
                type="button"
                key={cue.id}
                title="Trascina nell'editor o clicca per selezionare"
                className={cue.id === selectedCueId ? 'note-card active' : 'note-card'}
                onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
                  writeGlobalDragPayload(CUE_ID_DND_TYPE, cue.id, pointerPayloadFromEvent(event, {
                    label: cue.title || cue.src.split('/').pop() || 'Cue',
                    detail: cue.src,
                    tone: 'cue',
                  }))
                }}
                onMouseDown={(event: ReactMouseEvent<HTMLButtonElement>) => {
                  writeGlobalDragPayload(CUE_ID_DND_TYPE, cue.id, pointerPayloadFromEvent(event, {
                    label: cue.title || cue.src.split('/').pop() || 'Cue',
                    detail: cue.src,
                    tone: 'cue',
                  }))
                }}
                onDragStart={(event: ReactDragEvent<HTMLButtonElement>) => {
                  event.dataTransfer.effectAllowed = 'move'
                  writeDragPayload(event.dataTransfer, CUE_ID_DND_TYPE, CUE_ID_DND_PREFIX, cue.id)
                }}
                onDragEnd={clearGlobalDragPayload}
                onClick={() => selectCueFromInspector(cue)}
              >
                <span className="note-dot blue" />
                <strong>{cue.title || cue.src.split('/').pop()}</strong>
                <span>{cue.autoplay ? 'Autoplay' : 'Manuale'} · {cue.src}</span>
              </button>
            ))}
          </div>
          {cuePageCount > 1 ? (
            <div className="cue-pagination" aria-label="Paginazione cue">
              <span>{cuePageStart + 1}-{Math.min(cuePageStart + CUE_PAGE_SIZE, filteredCues.length)} di {filteredCues.length}</span>
              <div className="cue-pagination-actions">
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Cue precedenti"
                  title="Cue precedenti"
                  disabled={cuePage === 0}
                  onClick={() => setCuePage((current) => Math.max(0, current - 1))}
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Cue successivi"
                  title="Cue successivi"
                  disabled={cuePage >= cuePageCount - 1}
                  onClick={() => setCuePage((current) => Math.min(cuePageCount - 1, current + 1))}
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          ) : null}

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
              <CueMediaPreview
                cue={visibleSelectedCue}
                asset={visibleSelectedCueAsset}
                projectRootPath={project.rootPath}
                onStatus={setStorageStatus}
              />
              <button type="button" className="danger" onClick={deleteSelectedCue}><Trash2 size={16} />Elimina cue</button>
            </section>
          ) : (
            <p className="empty-state">
              {filteredCues.length === 0
                ? noteMode === 'context' ? 'Nessun cue contestuale nel blocco corrente.' : 'Nessun cue nel filtro corrente.'
                : 'Nessun cue selezionato.'}
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
      {projectPickerOpen ? (
        <ProjectPickerModal
          entries={projectPickerEntries}
          onCancel={() => {
            setProjectPickerOpen(false)
            setProjectPickerEntries([])
          }}
          onImport={openStoreTab}
          onOpen={(entry) => {
            setProjectPickerOpen(false)
            setProjectPickerEntries([])
            void openProjectFolder(entry.path)
          }}
          onRename={(entry, name) => renameProjectEntry(entry, name)}
          onDelete={(entry) => deleteProjectEntry(entry)}
        />
      ) : null}
      {pointerDropIndicator ? (
        <div
          className="pointer-drop-indicator"
          style={{
            transform: `translate3d(${pointerDropIndicator.x}px, ${pointerDropIndicator.y}px, 0)`,
            width: pointerDropIndicator.width,
          }}
          aria-hidden="true"
        >
          <span>{pointerDropIndicator.label}</span>
        </div>
      ) : null}
      {pointerDragPreview ? (
        <div
          className="pointer-drag-preview"
          data-tone={pointerDragPreview.tone}
          style={{ transform: `translate3d(${pointerDragPreview.x}px, ${pointerDragPreview.y}px, 0)` }}
          aria-hidden="true"
        >
          <span className="pointer-drag-preview-kind">{dragPreviewKindLabel(pointerDragPreview.tone)}</span>
          <strong>{pointerDragPreview.label}</strong>
          {pointerDragPreview.detail ? <span>{pointerDragPreview.detail}</span> : null}
        </div>
      ) : null}
      {publishDialogOpen ? (
        <PublishScriptModal
          state={publishState}
          disabled={!activeFile || Boolean(activeAppDocument)}
          onClose={() => setPublishDialogOpen(false)}
          onPublish={() => void publishScriptJson('publish')}
          onUpdate={() => void publishScriptJson('update')}
          onResetPin={() => void publishScriptJson('update', true)}
          onUnpublish={() => void unpublishScriptJson()}
          onCopyLink={() => void copyPublishedLink()}
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

function ShareStatusIndicator({ state }: { state: ShareIndicatorState }) {
  if (state.status === 'disabled') return null
  const title =
    state.status === 'shared'
      ? 'File condiviso'
      : state.status === 'not-shared'
        ? 'File non condiviso'
        : state.status === 'checking'
          ? 'Verifica condivisione in corso'
          : state.message || 'Stato condivisione non disponibile'
  return (
    <span className="share-status-indicator" data-state={state.status} title={title} aria-label={title}>
      {state.status === 'shared' ? <CloudCheck size={14} /> : null}
      {state.status === 'not-shared' ? <CloudOff size={14} /> : null}
      {state.status === 'checking' ? <RefreshCw size={14} /> : null}
      {state.status === 'error' ? <AlertTriangle size={14} /> : null}
    </span>
  )
}

function PublishScriptModal({
  state,
  disabled,
  onClose,
  onPublish,
  onUpdate,
  onResetPin,
  onUnpublish,
  onCopyLink,
}: {
  state: PublishState
  disabled: boolean
  onClose: () => void
  onPublish: () => void
  onUpdate: () => void
  onResetPin: () => void
  onUnpublish: () => void
  onCopyLink: () => void
}) {
  const busy = state.status === 'publishing' || state.status === 'removing'
  const [qrUrl, setQrUrl] = useState('')

  useEffect(() => {
    let active = true
    if (!state.url) {
      setQrUrl('')
      return undefined
    }
    QRCode.toDataURL(state.url, { margin: 1, width: 180 })
      .then((url) => {
        if (active) setQrUrl(url)
      })
      .catch(() => {
        if (active) setQrUrl('')
      })
    return () => {
      active = false
    }
  }, [state.url])

  const statusLabel =
    state.status === 'publishing'
      ? 'Condivisione in corso'
      : state.status === 'removing'
        ? 'Rimozione in corso'
        : state.status === 'published'
          ? 'Condiviso'
          : state.status === 'error'
            ? 'Errore'
            : 'Non condiviso'

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="action-modal publish-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-script-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="publish-modal-header">
          <div>
            <span className="publish-kicker">StageDesk Share</span>
            <h2 id="publish-script-title">Condividi file</h2>
            <p>Prepara il file attivo per le app attori con personaggi, scene e battute.</p>
          </div>
          <button type="button" className="publish-close" aria-label="Chiudi" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        {state.url ? (
          <div className="publish-qr">
            {qrUrl ? <img src={qrUrl} alt="QR code del link condiviso" /> : <div className="publish-qr-placeholder" aria-hidden="true" />}
          </div>
        ) : null}
        <div className="publish-summary" data-state={state.status}>
          <span className="publish-status-dot" />
          <div>
            <strong>{statusLabel}</strong>
            <span>
              {state.status === 'published' && state.publishedAt
                ? `Ultima versione: ${formatDateTime(state.publishedAt)}`
              : state.status === 'error'
                  ? state.error
              : state.status === 'idle'
                ? 'Il file non risulta condiviso in questa sessione.'
                : 'Attendere il completamento dell’operazione.'}
            </span>
          </div>
        </div>
        {state.url ? (
          <div className="publish-share">
            <label>
              Link condivisione
              <div className="publish-link-row">
                <input readOnly value={state.url} onFocus={(event) => event.currentTarget.select()} />
                <button type="button" onClick={onCopyLink}>
                  <Copy size={14} />
                  Copia
                </button>
              </div>
            </label>
            <label className="publish-pin-field">
              PIN attore
              <div className="publish-link-row">
                <input readOnly value={state.pin ?? ''} placeholder={state.pinAvailable ? '' : 'Non disponibile: reimposta il PIN'} />
                <button type="button" disabled={busy} onClick={onResetPin}>
                  <RefreshCw size={14} />
                  Reimposta
                </button>
              </div>
            </label>
          </div>
        ) : null}
        <div className="publish-actions">
          <button type="button" className="publish-primary" disabled={disabled || busy} onClick={onPublish}>
            <CloudUpload size={15} />
            Condividi
          </button>
          <button type="button" disabled={disabled || busy || !state.url} onClick={onUpdate}>
            <RefreshCw size={15} />
            Aggiorna
          </button>
          <button type="button" className="publish-danger" disabled={disabled || busy || !state.shareUid} onClick={onUnpublish}>
            <CloudOff size={15} />
            Interrompi
          </button>
        </div>
      </section>
    </div>
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
  onImport,
  onOpen,
  onRename,
  onDelete,
}: {
  entries: ProjectEntry[]
  onCancel: () => void
  onImport: () => void
  onOpen: (entry: ProjectEntry) => void
  onRename: (entry: ProjectEntry, name: string) => void
  onDelete: (entry: ProjectEntry) => void
}) {
  const [openMenuPath, setOpenMenuPath] = useState('')
  const [renameEntry, setRenameEntry] = useState<ProjectEntry | undefined>()
  const [renameValue, setRenameValue] = useState('')
  const [projectSearch, setProjectSearch] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 6
  const filteredEntries = useMemo(() => {
    const query = projectSearch.trim().toLowerCase()
    if (!query) return entries
    return entries.filter((entry) =>
      `${entry.name} ${entry.path}`.toLowerCase().includes(query),
    )
  }, [entries, projectSearch])
  const pageCount = Math.max(1, Math.ceil(filteredEntries.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const pageEntries = filteredEntries.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
  useEffect(() => {
    setPage(0)
    setOpenMenuPath('')
  }, [projectSearch])
  useEffect(() => {
    if (page >= pageCount) setPage(pageCount - 1)
  }, [page, pageCount])
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (renameEntry) return
      if (openMenuPath) {
        setOpenMenuPath('')
        return
      }
      onCancel()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onCancel, openMenuPath, renameEntry])
  const submitRename = () => {
    if (!renameEntry) return
    onRename(renameEntry, renameValue)
    setRenameEntry(undefined)
    setRenameValue('')
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="action-modal project-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-picker-title"
        onMouseDown={(event) => {
          const target = event.target
          if (target instanceof Element && !target.closest('.project-picker-menu, .project-picker-more')) {
            setOpenMenuPath('')
          }
          event.stopPropagation()
        }}
      >
        <div className="project-picker-header">
          <h2 id="project-picker-title">Apri progetto</h2>
          <p>Clicca su un progetto per aprirlo oppure su Importa per aprire lo store.</p>
        </div>
        <label className="project-picker-search">
          <Search size={15} />
          <input
            value={projectSearch}
            onChange={(event) => setProjectSearch(event.target.value)}
            placeholder="Cerca progetto"
          />
        </label>
        <div className="project-picker-list">
          {pageEntries.map((entry) => (
            <div className={`project-picker-row${openMenuPath === entry.path ? ' menu-open' : ''}`} key={entry.path}>
              <button type="button" className="project-picker-open" onClick={() => onOpen(entry)}>
                <FolderOpen size={15} />
                <span>
                  <strong>{entry.name}</strong>
                  <small>{compactPath(entry.path)}</small>
                </span>
              </button>
              <div className="project-picker-actions">
                <button
                  type="button"
                  className="project-picker-more"
                  title="Azioni progetto"
                  aria-label={`Azioni progetto ${entry.name}`}
                  aria-haspopup="menu"
                  aria-expanded={openMenuPath === entry.path}
                  onClick={() => setOpenMenuPath((current) => current === entry.path ? '' : entry.path)}
                >
                  <MoreVertical size={16} />
                </button>
                {openMenuPath === entry.path ? (
                  <div className="project-picker-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpenMenuPath('')
                        setRenameEntry(entry)
                        setRenameValue(entry.name)
                      }}
                    >
                      <Pencil size={14} />
                      Rinomina
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="danger"
                      onClick={() => {
                        setOpenMenuPath('')
                        onDelete(entry)
                      }}
                    >
                      <Trash2 size={14} />
                      Elimina
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {pageEntries.length === 0 ? (
            <p className="project-picker-empty">Nessun progetto trovato.</p>
          ) : null}
        </div>
        <div className="project-picker-pagination">
          <span>
            {filteredEntries.length === 0
              ? '0 progetti'
              : `${(currentPage * pageSize) + 1}-${Math.min((currentPage + 1) * pageSize, filteredEntries.length)} di ${filteredEntries.length}`}
          </span>
          <div>
            <button
              type="button"
              aria-label="Pagina precedente"
              title="Pagina precedente"
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={currentPage === 0}
            >
              <ChevronRight size={15} className="project-pagination-prev-icon" />
            </button>
            <button
              type="button"
              aria-label="Pagina successiva"
              title="Pagina successiva"
              onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
              disabled={currentPage >= pageCount - 1}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
        {renameEntry ? (
          <div className="project-rename-panel">
            <label>
              <span>Rinomina progetto</span>
              <input
                autoFocus
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submitRename()
                  if (event.key === 'Escape') {
                    setRenameEntry(undefined)
                    setRenameValue('')
                  }
                }}
              />
            </label>
            <div className="project-rename-actions">
              <button type="button" onClick={() => {
                setRenameEntry(undefined)
                setRenameValue('')
              }}>
                Annulla
              </button>
              <button type="button" className="primary" disabled={!renameValue.trim() || renameValue.trim() === renameEntry.name} onClick={submitRename}>
                Rinomina
              </button>
            </div>
          </div>
        ) : null}
        <div className="modal-actions project-picker-footer">
          <button type="button" className="project-import-button" onClick={onImport}>
            <Download size={15} />
            Importa
          </button>
          <button type="button" className="project-cancel-button" onClick={onCancel}>Annulla</button>
        </div>
      </section>
    </div>
  )
}

function HighlightedIssueLine({ line, highlight }: { line: string; highlight: string }) {
  if (!highlight) return <>{line || 'Riga vuota'}</>
  const index = line.toLowerCase().indexOf(highlight.toLowerCase())
  if (index < 0) return <>{line}</>
  return (
    <>
      {line.slice(0, index)}
      <mark>{line.slice(index, index + highlight.length)}</mark>
      {line.slice(index + highlight.length)}
    </>
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
    <div className="document-outline" aria-label={`Indice di ${stripMarkdownExtension(activeFileName)}`}>
      <div className="outline-file-name">{stripMarkdownExtension(activeFileName)}</div>
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
    <div className="document-outline" aria-label={`Bookmark di ${stripMarkdownExtension(activeFileName)}`}>
      <div className="outline-file-name">{stripMarkdownExtension(activeFileName)}</div>
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
              <span className="node-name">{node.kind === 'markdown' ? stripMarkdownExtension(node.name) : node.name}</span>
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
              draggable={false}
              data-media-drop-path={asset.path}
              data-media-kind={asset.kind}
              className={asset.path === selectedPath ? 'tree-node media-node selected' : 'tree-node media-node'}
              onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
                if (asset.kind !== 'folder') writeGlobalDragPayload(MEDIA_PATH_DND_TYPE, asset.path, pointerPayloadFromEvent(event, {
                  label: asset.name,
                  detail: asset.path,
                  tone: 'media',
                }))
              }}
              onMouseDown={(event: ReactMouseEvent<HTMLDivElement>) => {
                if (asset.kind !== 'folder') writeGlobalDragPayload(MEDIA_PATH_DND_TYPE, asset.path, pointerPayloadFromEvent(event, {
                  label: asset.name,
                  detail: asset.path,
                  tone: 'media',
                }))
              }}
              onDragStart={(event: ReactDragEvent<HTMLDivElement>) => {
                if (asset.kind === 'folder') return
                event.dataTransfer.effectAllowed = 'copyMove'
                writeDragPayload(event.dataTransfer, MEDIA_PATH_DND_TYPE, MEDIA_PATH_DND_PREFIX, asset.path)
              }}
              onDragEnd={clearGlobalDragPayload}
              onDragOver={(event: ReactDragEvent<HTMLDivElement>) => {
                if (!isFolder) return
                if (!hasDragPayload(event.dataTransfer, MEDIA_PATH_DND_TYPE)) return
                event.preventDefault()
                event.stopPropagation()
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
                if (sourcePath === asset.path || parentPath(sourcePath) === asset.path) return
                clearGlobalDragPayload()
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
                  <FilePlus2 size={13} />
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
  onStatus,
}: {
  asset: MediaAsset
  projectRootPath: string
  onCue: (asset: MediaAsset) => void
  onStatus: (message: string) => void
}) {
  const assetUrl = useResolvedMediaAssetUrl(asset, projectRootPath, onStatus)
  const previewCue = useMemo(() => mediaAssetPreviewCue(asset), [asset])
  return (
    <section className="media-preview-card">
      <div className="media-preview-header">
        <strong>{asset.name}</strong>
        <button type="button" title="Inserisci come cue" onClick={() => onCue(asset)}><FilePlus2 size={13} /></button>
      </div>
      {assetUrl && asset.kind === 'image' ? <img src={assetUrl} alt="" /> : null}
      {assetUrl && asset.kind === 'video' ? (
        <PreviewMediaControls cue={previewCue} assetUrl={assetUrl} onStatus={onStatus} />
      ) : null}
      {assetUrl && (asset.kind === 'audio' || asset.kind === 'music') ? (
        <PreviewMediaControls cue={previewCue} assetUrl={assetUrl} nativeSourcePath={asset.sourcePath} onStatus={onStatus} compact />
      ) : null}
      {!assetUrl ? <p className="empty-state">Anteprima non disponibile: file media non trovato nel progetto.</p> : null}
    </section>
  )
}

function CueMediaPreview({
  cue,
  asset,
  projectRootPath,
  onStatus,
}: {
  cue: MediaCue
  asset: MediaAsset | undefined
  projectRootPath: string
  onStatus: (message: string) => void
}) {
  const assetUrl = useResolvedMediaAssetUrl(asset, projectRootPath, onStatus)
  if (!asset || !assetUrl) {
    return <p className="empty-state">Anteprima non disponibile: file media non trovato nel progetto.</p>
  }

  if (cue.type === 'image') {
    return <img className="media-preview visual" src={assetUrl} alt={cue.title || cue.src} />
  }

  if (cue.type === 'video' || cue.type === 'audio' || cue.type === 'music') {
    return <PreviewMediaControls cue={cue} assetUrl={assetUrl} nativeSourcePath={asset.sourcePath} onStatus={onStatus} compact />
  }

  return <p className="empty-state">Anteprima non disponibile per questo tipo di cue.</p>
}

function PreviewMediaControls({
  cue,
  assetUrl,
  nativeSourcePath,
  onStatus,
  compact = false,
}: {
  cue: MediaCue
  assetUrl: string
  nativeSourcePath?: string
  onStatus: (message: string) => void
  compact?: boolean
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const timersRef = useRef<number[]>([])
  const previewOwnsNativeAudioRef = useRef(false)
  const previewIdRef = useRef(`preview-${Math.random().toString(36).slice(2)}`)
  const [state, setState] = useState<'idle' | 'playing' | 'paused'>('idle')
  const [status, setStatus] = useState('Anteprima pronta')
  const isNativeAudio = shouldUseNativeAudioPlayback() && isAudioCue(cue)
  const label = cue.title || cue.src
  const previewLifecycleRef = useRef({ cue, isNativeAudio, previewId: previewIdRef.current })
  previewLifecycleRef.current = { cue, isNativeAudio, previewId: previewIdRef.current }

  const setPreviewStatus = useCallback((message: string) => {
    setStatus(message)
    onStatus(message)
  }, [onStatus])

  const stopPreview = useCallback((silent = false, updateState = true, reason: PreviewStopReason = 'user') => {
    const media = cue.type === 'video' ? videoRef.current : audioRef.current
    const hasActivePlayback = previewOwnsNativeAudioRef.current || Boolean(media && !media.paused)
    if (reason !== 'global-playback-switch' || state !== 'idle' || hasActivePlayback) {
      playbackLog('preview', reason === 'component-unmount' ? 'cleanup-stop' : 'stop-requested', cue, {
        silent,
        updateState,
        reason,
        previewId: previewIdRef.current,
        backend: playbackBackendName(isNativeAudio),
      })
    }
    clearAudioTimers(timersRef)
    if (isNativeAudio && previewOwnsNativeAudioRef.current) {
      previewOwnsNativeAudioRef.current = false
      void stopNativeAudioAsset()
    }
    if (media) {
      media.onended = null
      media.pause()
      try {
        media.currentTime = Math.max(0, cue.options.startAt ?? 0)
      } catch {
        // Some media backends reject currentTime until metadata is loaded.
      }
    }
    if (updateState) {
      setState('idle')
      if (!silent) setPreviewStatus(`Anteprima fermata: ${label}`)
    }
  }, [cue, isNativeAudio, label, setPreviewStatus, state])
  const stopPreviewRef = useRef(stopPreview)

  useEffect(() => {
    stopPreviewRef.current = stopPreview
  }, [stopPreview])

  const finishPreview = useCallback(() => {
    playbackLog('preview', 'finished', cue, { backend: playbackBackendName(isNativeAudio) })
    clearAudioTimers(timersRef)
    previewOwnsNativeAudioRef.current = false
    const media = cue.type === 'video' ? videoRef.current : audioRef.current
    if (media) {
      media.onended = null
      media.pause()
      try {
        media.currentTime = Math.max(0, cue.options.startAt ?? 0)
      } catch {
        // Some media backends reject currentTime until metadata is loaded.
      }
    }
    setState('idle')
    setPreviewStatus(`Anteprima terminata: ${label}`)
  }, [cue, isNativeAudio, label, setPreviewStatus])

  useEffect(() => {
    const mounted = previewLifecycleRef.current
    playbackLog('preview', 'mounted', mounted.cue, {
      previewId: mounted.previewId,
      backend: playbackBackendName(mounted.isNativeAudio),
    })
    return () => {
      playbackLog('preview', 'unmounted', mounted.cue, {
        previewId: mounted.previewId,
        backend: playbackBackendName(mounted.isNativeAudio),
      })
    }
  }, [])

  useEffect(() => {
    const stopOnGlobalRequest = (event: Event) => {
      const detail = (event as CustomEvent<StopPreviewPlaybackDetail>).detail
      if (detail?.sourceId === previewIdRef.current) return
      stopPreviewRef.current(true, true, 'global-playback-switch')
    }
    window.addEventListener(STOP_PREVIEW_PLAYBACK_EVENT, stopOnGlobalRequest)
    return () => {
      window.removeEventListener(STOP_PREVIEW_PLAYBACK_EVENT, stopOnGlobalRequest)
    }
  }, [])

  useEffect(() => {
    return () => {
      stopPreviewRef.current(true, false, 'component-unmount')
    }
  }, [assetUrl, cue.id])

  const playPreview = () => {
    playbackLog('preview', 'play-requested', cue, {
      backend: playbackBackendName(isNativeAudio),
      assetUrl,
      nativeSourcePath,
      isTauri: isTauriRuntime(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      userActivation: playbackUserActivationSnapshot(),
    })
    window.dispatchEvent(new CustomEvent<StopPreviewPlaybackDetail>(STOP_PREVIEW_PLAYBACK_EVENT, {
      detail: { sourceId: previewIdRef.current },
    }))
    window.dispatchEvent(new CustomEvent(STOP_EDITOR_PLAYBACK_EVENT))
    clearAudioTimers(timersRef)

    const playWithMediaElement = () => {
      const media = cue.type === 'video' ? videoRef.current : audioRef.current
      if (!media) {
        playbackLog('preview', 'media-element-missing', cue, { cueType: cue.type })
        return
      }
      media.loop = Boolean(cue.options.loop)
      media.volume = cueTargetVolume(cue)
      media.onended = finishPreview
      media.onerror = () => {
        const message = mediaElementErrorMessage(cue, media.error)
        playbackLog('preview', 'media-element-error-event', cue, {
          message,
          media: mediaElementSnapshot(media),
          error: mediaErrorDetails(media.error),
        })
      }
      if (isAudioCue(cue)) {
        const preparedSrc = prepareMediaSourceForCue(media, cue, assetUrl)
        playbackLog('preview', 'media-element-play-call', cue, {
          preparedSrc,
          media: mediaElementSnapshot(media),
        })
        media.preload = 'auto'
        void media.play()
          .then(() => {
            if (media.src !== preparedSrc) return
            playbackLog('preview', 'media-element-play-started', cue, { media: mediaElementSnapshot(media) })
            scheduleMediaPauseMonitor(media, timersRef, finishPreview)
            setState('playing')
            setPreviewStatus(`Anteprima in esecuzione: ${label}`)
            void alignMediaForCue(media, cue, preparedSrc).finally(() => {
              if (media.src !== preparedSrc || media.paused) return
              scheduleCueEnd(media, cue, timersRef, finishPreview)
            })
          })
          .catch((error: unknown) => {
            playbackLog('preview', 'media-element-play-rejected', cue, {
              error: playbackErrorDetails(error),
              media: mediaElementSnapshot(media),
            })
            if (isPlaybackNotAllowed(error)) {
              const previousMuted = media.muted
              media.muted = true
              playbackLog('preview', 'media-element-muted-unlock-call', cue, { media: mediaElementSnapshot(media) })
              void media.play()
                .then(() => {
                  if (media.src !== preparedSrc) return
                  media.muted = previousMuted
                  playbackLog('preview', 'media-element-muted-unlock-started', cue, { media: mediaElementSnapshot(media) })
                  scheduleMediaPauseMonitor(media, timersRef, finishPreview)
                  setState('playing')
                  setPreviewStatus(`Anteprima in esecuzione: ${label}`)
                  void alignMediaForCue(media, cue, preparedSrc).finally(() => {
                    if (media.src !== preparedSrc || media.paused) return
                    scheduleCueEnd(media, cue, timersRef, finishPreview)
                  })
                })
                .catch((unlockError: unknown) => {
                  media.muted = previousMuted
                  playbackLog('preview', 'media-element-muted-unlock-rejected', cue, {
                    error: playbackErrorDetails(unlockError),
                    media: mediaElementSnapshot(media),
                  })
                  setState('idle')
                  setPreviewStatus(playbackErrorMessage(cue, unlockError))
                })
              return
            }
            setState('idle')
            setPreviewStatus(playbackErrorMessage(cue, error))
          })
        return
      }

      void prepareMediaForCue(media, cue, assetUrl)
        .then((preparedSrc) => {
          playbackLog('preview', 'media-element-prepared', cue, {
            preparedSrc,
            media: mediaElementSnapshot(media),
          })
          if (media.src !== preparedSrc) return false
          scheduleCueEnd(media, cue, timersRef, finishPreview)
          return media.play().then(() => true)
        })
        .then((started) => {
          if (!started) return
          playbackLog('preview', 'media-element-play-started', cue, { media: mediaElementSnapshot(media) })
          scheduleMediaPauseMonitor(media, timersRef, finishPreview)
          setState('playing')
          setPreviewStatus(`Anteprima in esecuzione: ${label}`)
        })
        .catch((error: unknown) => {
          playbackLog('preview', 'media-element-play-rejected', cue, {
            error: playbackErrorDetails(error),
            media: mediaElementSnapshot(media),
          })
          setState('idle')
          setPreviewStatus(playbackErrorMessage(cue, error))
        })
    }

    if (isNativeAudio) {
      playbackLog('preview', 'native-play-call', cue, { sourcePath: nativeSourcePath })
      void playNativeAudioAsset(cue, nativeSourcePath)
        .then((playbackDuration) => {
          playbackLog('preview', 'native-play-started', cue, { playbackDuration })
          previewOwnsNativeAudioRef.current = true
          setState('playing')
          setPreviewStatus(`Anteprima in esecuzione: ${label}`)
          scheduleNativeCueEnd(cue, timersRef, playbackDuration, () => {
            previewOwnsNativeAudioRef.current = false
            finishPreview()
          })
        })
        .catch((error: unknown) => {
          playbackLog('preview', 'native-play-rejected', cue, {
            error: playbackErrorDetails(error),
            fallbackToMediaElement: Boolean(assetUrl),
          })
          if (assetUrl) {
            playbackLog('preview', 'native-fallback-media-element', cue, { assetUrl })
            playWithMediaElement()
            return
          }
          setState('idle')
          setPreviewStatus(nativePlaybackErrorMessage(cue, error))
        })
      return
    }

    playWithMediaElement()
  }

  const pausePreview = () => {
    playbackLog('preview', 'pause-requested', cue, { backend: playbackBackendName(isNativeAudio) })
    clearAudioTimers(timersRef)
    if (isNativeAudio) {
      void pauseNativeAudioAsset()
        .then(() => {
          setState('paused')
          setPreviewStatus(`Anteprima in pausa: ${label}`)
        })
        .catch((error: unknown) => setPreviewStatus(nativePlaybackErrorMessage(cue, error)))
      return
    }
    const media = cue.type === 'video' ? videoRef.current : audioRef.current
    if (!media) return
    media.pause()
    playbackLog('preview', 'media-element-paused', cue, { media: mediaElementSnapshot(media) })
    setState('paused')
    setPreviewStatus(`Anteprima in pausa: ${label}`)
  }

  const resumePreview = () => {
    playbackLog('preview', 'resume-requested', cue, { backend: playbackBackendName(isNativeAudio) })
    clearAudioTimers(timersRef)
    if (isNativeAudio) {
      void resumeNativeAudioAsset()
        .then(() => {
          previewOwnsNativeAudioRef.current = true
          setState('playing')
          setPreviewStatus(`Anteprima ripresa: ${label}`)
          scheduleNativeCueEnd(cue, timersRef, undefined, () => {
            previewOwnsNativeAudioRef.current = false
            finishPreview()
          })
        })
        .catch((error: unknown) => {
          playbackLog('preview', 'native-resume-rejected', cue, { error: playbackErrorDetails(error) })
          setState('paused')
          setPreviewStatus(nativePlaybackErrorMessage(cue, error))
        })
      return
    }
    const media = cue.type === 'video' ? videoRef.current : audioRef.current
    if (!media) return
    media.onended = finishPreview
    scheduleCueEnd(media, cue, timersRef, finishPreview)
    void media.play()
      .then(() => {
        playbackLog('preview', 'media-element-resumed', cue, { media: mediaElementSnapshot(media) })
        scheduleMediaPauseMonitor(media, timersRef, finishPreview)
        setState('playing')
        setPreviewStatus(`Anteprima ripresa: ${label}`)
      })
      .catch((error: unknown) => {
        playbackLog('preview', 'media-element-resume-rejected', cue, {
          error: playbackErrorDetails(error),
          media: mediaElementSnapshot(media),
        })
        setState('paused')
        setPreviewStatus(playbackErrorMessage(cue, error))
      })
  }

  const togglePreview = () => {
    if (state === 'playing') {
      pausePreview()
      return
    }
    if (state === 'paused') {
      resumePreview()
      return
    }
    playPreview()
  }

  const togglePreviewFromClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    togglePreview()
  }

  const playerClassName = [
    'preview-player',
    compact ? 'compact' : '',
    state === 'playing' ? 'is-playing' : '',
    state === 'paused' ? 'is-paused' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={playerClassName}>
      {cue.type === 'video' ? (
        <video ref={videoRef} className="media-preview visual" src={assetUrl} preload="metadata" playsInline />
      ) : (
        <audio ref={audioRef} className="sr-only" src={assetUrl} preload="metadata" />
      )}
      <div className="preview-player-controls">
        <button
          type="button"
          className="preview-play-button"
          onClick={togglePreviewFromClick}
          title={state === 'playing' ? 'Pausa anteprima' : 'Esegui anteprima'}
        >
          {state === 'playing' ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button
          type="button"
          className="preview-stop-button"
          onClick={() => stopPreview()}
          title="Ferma anteprima"
          disabled={state === 'idle'}
        >
          <Square size={13} />
        </button>
        <span className={state === 'playing' ? 'preview-status playing' : 'preview-status'}>
          <span className="preview-status-text">{status}</span>
          <span className="preview-equalizer" aria-hidden="true" />
        </span>
      </div>
    </div>
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

const removeCueReferencesFromScripts = (nodes: ProjectTreeNode[], cueIds: string[]): ProjectTreeNode[] => {
  if (cueIds.length === 0) return nodes
  return nodes.map((node) => {
    if (node.kind === 'markdown') {
      const content = node.content ?? ''
      const nextContent = removeCueMarkersFromMarkdown(content, cueIds)
      return nextContent === content ? node : { ...node, content: nextContent, dirty: true }
    }
    return {
      ...node,
      children: node.children ? removeCueReferencesFromScripts(node.children, cueIds) : undefined,
    }
  })
}

const removeCueMarkersFromMarkdown = (markdown: string, cueIds: string[]) =>
  cueIds.reduce((content, cueId) => {
    const escapedId = escapeRegExp(cueId)
    return content
      .replace(new RegExp(`::media\\{[^}]*id="${escapedId}"[^}]*\\}[\\s\\S]*?::\\n?`, 'g'), '')
      .replace(new RegExp(`^\\[CUE[\\s:][^\\]]+\\]\\s+\\{#${escapedId}(?:\\s+[^}]*)?\\}\\s*\\n?`, 'gm'), '')
      .replace(/\n{3,}/g, '\n\n')
  }, markdown)

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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

const duplicateScriptEntityId = (id: string) => `${id}-copy-${crypto.randomUUID().slice(0, 8)}`

const remapScriptReferenceIds = (
  markdown: string,
  noteIds: Map<string, string>,
  cueIds: Map<string, string>,
) => {
  const replaceIds = (value: string, patterns: RegExp[], ids: Map<string, string>) =>
    patterns.reduce(
      (current, pattern) => current.replace(pattern, (_match, prefix: string, id: string) => `${prefix}${ids.get(id) ?? id}`),
      value,
    )

  const withNotes = replaceIds(
    markdown,
    [
      /(::regia\{[^}]*\bid=")([^"]+)(?=")/g,
      /(\[NOTA:[^\n]*\{#)([^\s}]+)/g,
    ],
    noteIds,
  )
  return replaceIds(
    withNotes,
    [
      /(::media\{[^}]*\bid=")([^"]+)(?=")/g,
      /(\[CUE[^\n]*\{#)([^\s}]+)/g,
    ],
    cueIds,
  )
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

const mediaAssetPreviewCue = (asset: MediaAsset): MediaCue => ({
  id: `preview-${asset.id}`,
  type: asset.kind === 'music' || asset.kind === 'image' || asset.kind === 'video' ? asset.kind : 'audio',
  src: asset.path,
  title: asset.name,
  description: '',
  autoplay: false,
  anchorId: `preview-${asset.id}`,
  filePath: '',
  sceneId: '',
  options: { volume: 70, fadeIn: 0, fadeOut: 0, loop: false },
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
})

function useResolvedMediaAssetUrl(
  asset: MediaAsset | undefined,
  projectRootPath: string,
  onStatus?: (message: string) => void,
) {
  const fallbackUrl = asset ? mediaAssetUrl(asset, projectRootPath) : undefined
  const [resolvedUrl, setResolvedUrl] = useState('')
  const [resolvedKey, setResolvedKey] = useState('')
  const assetKey = asset ? `${projectRootPath}|${asset.path}|${asset.sourcePath ?? ''}` : ''

  useEffect(() => {
    let cancelled = false
    let objectUrl = ''
    setResolvedUrl('')
    setResolvedKey('')
    if (!asset || asset.kind === 'folder') return

    if (!isTauriRuntime()) {
      if (isLocalDevRuntime()) return

      void readBrowserMediaAssetObjectUrl(asset.path)
        .then((url) => {
          if (cancelled) {
            if (url) URL.revokeObjectURL(url)
            return
          }
          if (!url) return
          objectUrl = url
          setResolvedUrl(url)
          setResolvedKey(assetKey)
        })
        .catch((error: unknown) => {
          if (!cancelled) onStatus?.(`Anteprima non disponibile: ${String(error)}`)
        })

      return () => {
        cancelled = true
        if (objectUrl) URL.revokeObjectURL(objectUrl)
      }
    }

    void readMediaAssetDataUrl(asset)
      .then((url) => {
        if (cancelled) return
        setResolvedUrl(url)
        setResolvedKey(assetKey)
      })
      .catch((error: unknown) => {
        if (!cancelled) onStatus?.(`Anteprima non disponibile: ${String(error)}`)
      })

    return () => {
      cancelled = true
    }
  }, [asset, assetKey, onStatus])

  if (!asset) return undefined
  if (resolvedKey === assetKey && resolvedUrl) return resolvedUrl
  if (isTauriRuntime() && asset.sourcePath && !hasProjectStorageRoot(projectRootPath)) return undefined
  return fallbackUrl
}

const compactPath = (path: string) => {
  const parts = path.split('/')
  if (parts.length <= 3) return path
  return `.../${parts.slice(-3).join('/')}`
}

const isTauriRuntime = () =>
  typeof window !== 'undefined' && Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)

const shouldUseNativeAudioPlayback = () => isTauriRuntime()

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

const convertNoteColonToGeneralNote = (
  view: EditorView,
  from: number,
  to: number,
  filePath: string,
  sceneId: string,
  onNoteCreated: (note: DirectorNote) => void,
) => {
  if (from !== to || !filePath) return false
  const { $from } = view.state.selection
  const paragraph = $from.parent
  if (paragraph.type.name !== 'paragraph') return false

  const textBefore = paragraph.textBetween(0, $from.parentOffset, ' ', ' ').trim()
  const textAfter = paragraph.textBetween($from.parentOffset, paragraph.content.size, ' ', ' ').trim()
  if (normalizeCharacterName(textBefore) !== 'nota' || textAfter) return false

  const nodeType = view.state.schema.nodes.scriptNote
  if (!nodeType) return false

  const note: DirectorNote = {
    id: `note-${crypto.randomUUID().slice(0, 8)}`,
    type: 'general',
    color: 'cyan',
    title: 'Nota generale',
    content: '',
    collapsed: false,
    filePath,
    anchorId: crypto.randomUUID(),
    sceneId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const paragraphStart = $from.before($from.depth)
  const paragraphEnd = paragraphStart + paragraph.nodeSize
  const noteNode = nodeType.create({
    type: note.type,
    color: note.color,
    title: note.title,
    content: note.content,
    refId: note.id,
    collapsed: false,
  })
  const transaction = view.state.tr.replaceWith(paragraphStart, paragraphEnd, noteNode)
  transaction.setSelection(NodeSelection.create(transaction.doc, paragraphStart))
  transaction.scrollIntoView()
  view.dispatch(transaction)
  onNoteCreated(note)
  focusScriptNoteTextarea(view, note.id)
  return true
}

const focusScriptNoteTextarea = (view: EditorView, noteId: string, attempts = 0) => {
  window.requestAnimationFrame(() => {
    const textarea = view.dom.querySelector<HTMLTextAreaElement>(`[data-ref-id="${noteId}"] textarea`)
    if (textarea) {
      textarea.focus()
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
      textarea.scrollIntoView({ block: 'center', inline: 'nearest' })
      return
    }
    if (attempts < 8) focusScriptNoteTextarea(view, noteId, attempts + 1)
  })
}

const convertCharacterColonToDialogue = (
  view: EditorView,
  from: number,
  to: number,
  characters: CharacterOption[],
  sceneId: string,
) => {
  if (from !== to) return false
  const { $from } = view.state.selection
  const paragraph = $from.parent
  if (paragraph.type.name !== 'paragraph') return false

  const textBefore = paragraph.textBetween(0, $from.parentOffset, ' ', ' ').trim()
  const textAfter = paragraph.textBetween($from.parentOffset, paragraph.content.size, ' ', ' ').trim()
  if (!textBefore || textAfter) return false

  const character = characters.find((item) => normalizeCharacterName(item.name) === normalizeCharacterName(textBefore))
  if (!character) return false

  const nodeType = view.state.schema.nodes.scriptDialogue
  if (!nodeType) return false

  const dialogueId = `battuta-${crypto.randomUUID().slice(0, 8)}`
  const paragraphStart = $from.before($from.depth)
  const paragraphEnd = paragraphStart + paragraph.nodeSize
  const dialogueNode = nodeType.create({
    id: dialogueId,
    characterId: character.id,
    character: character.name,
    text: '',
    sceneId,
  })
  const transaction = view.state.tr.replaceWith(paragraphStart, paragraphEnd, dialogueNode)
  transaction.setSelection(NodeSelection.create(transaction.doc, paragraphStart))
  transaction.scrollIntoView()
  view.dispatch(transaction)
  window.requestAnimationFrame(() => {
    const textarea = view.dom.querySelector<HTMLTextAreaElement>(`[data-dialogue-id="${dialogueId}"] textarea`)
    textarea?.focus()
  })
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
  node: ProseMirrorNode
}

type ScriptNodeMatch = ScriptChipMatch

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
  const directivePattern = new RegExp(`::${directiveName}\\{([^}]*)\\}`, 'g')
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
  if (text.startsWith(prefix)) return text.slice(prefix.length)

  const fallback = readGlobalDragPayload(type)
  return fallback ?? ''
}

const writeDragPayload = (dataTransfer: DataTransfer, type: string, prefix: string, value: string) => {
  dataTransfer.setData('text/plain', `${prefix}${value}`)
  dataTransfer.setData(type, value)
  writeGlobalDragPayload(type, value)
}

const hasDragPayload = (dataTransfer: DataTransfer, type: string) =>
  dragTypes(dataTransfer).some((item) => item.toLowerCase() === type.toLowerCase() || item === 'text/plain') ||
  Boolean(readGlobalDragPayload(type))

const hasAnyEditorDragPayload = (dataTransfer: DataTransfer) =>
  hasDragPayload(dataTransfer, NOTE_ID_DND_TYPE) ||
  hasDragPayload(dataTransfer, CUE_ID_DND_TYPE) ||
  hasDragPayload(dataTransfer, MEDIA_PATH_DND_TYPE) ||
  hasDragPayload(dataTransfer, DIALOGUE_ID_DND_TYPE)

const dragTypes = (dataTransfer: DataTransfer) => {
  try {
    return Array.from(dataTransfer.types ?? [])
  } catch {
    return []
  }
}

const pointerPayloadFromEvent = (
  event: ReactPointerEvent<HTMLElement> | ReactMouseEvent<HTMLElement>,
  metadata: Pick<StagedeskDragPayload, 'label' | 'detail' | 'tone'>,
) => ({
  startX: event.clientX,
  startY: event.clientY,
  pointerId: 'pointerId' in event ? event.pointerId : undefined,
  ...metadata,
})

const writeGlobalDragPayload = (type: string, value: string, options: Partial<StagedeskDragPayload> = {}) => {
  ;(window as StagedeskDragWindow)[STAGEDESK_DRAG_STATE_KEY] = {
    type,
    value,
    startedAt: Date.now(),
    ...options,
  }
}

const readGlobalDragPayload = (type: string) => {
  const payload = (window as StagedeskDragWindow)[STAGEDESK_DRAG_STATE_KEY]
  if (!payload || payload.type !== type) return undefined
  if (Date.now() - payload.startedAt > 12000) {
    clearGlobalDragPayload()
    return undefined
  }
  return payload.value
}

const readAnyGlobalDragPayload = () => {
  const payload = (window as StagedeskDragWindow)[STAGEDESK_DRAG_STATE_KEY]
  if (!payload) return undefined
  if (Date.now() - payload.startedAt > 12000) {
    clearGlobalDragPayload()
    return undefined
  }
  return payload
}

const clearGlobalDragPayload = () => {
  delete (window as StagedeskDragWindow)[STAGEDESK_DRAG_STATE_KEY]
}

const pointerDragDistance = (payload: StagedeskDragPayload, event: InternalDragEvent) => {
  if (payload.startX === undefined || payload.startY === undefined) return 999
  return Math.hypot(event.clientX - payload.startX, event.clientY - payload.startY)
}

const dragPreviewFromPayload = (payload: StagedeskDragPayload, event: InternalDragEvent): PointerDragPreview => ({
  x: event.clientX + 14,
  y: event.clientY + 14,
  label: payload.label || fallbackDragLabel(payload),
  detail: payload.detail,
  tone: payload.tone ?? dragToneFromType(payload.type),
})

const fallbackDragLabel = (payload: StagedeskDragPayload) => {
  if (payload.type === CUE_ID_DND_TYPE) return 'Cue'
  if (payload.type === NOTE_ID_DND_TYPE) return 'Nota'
  if (payload.type === DIALOGUE_ID_DND_TYPE) return 'Battuta'
  if (payload.type === MEDIA_PATH_DND_TYPE) return payload.value.split('/').pop() || 'Media'
  return 'Elemento'
}

const dragToneFromType = (type: string): PointerDragPreview['tone'] => {
  if (type === NOTE_ID_DND_TYPE) return 'note'
  if (type === MEDIA_PATH_DND_TYPE) return 'media'
  return 'cue'
}

const dragPreviewKindLabel = (tone: PointerDragPreview['tone']) => {
  if (tone === 'note') return 'Nota'
  if (tone === 'media') return 'Media'
  return 'Cue'
}

const editorDropIndicator = (view: EditorView, position: number): PointerDropIndicator => {
  const editorRect = view.dom.getBoundingClientRect()
  const coords = view.coordsAtPos(Math.max(0, Math.min(position, view.state.doc.content.size)))
  return {
    x: Math.max(12, editorRect.left + 12),
    y: Math.max(12, coords.top - 2),
    width: Math.max(140, editorRect.width - 24),
    label: 'Rilascia qui',
  }
}

const isEditorDragPayload = (type: string) =>
  type === NOTE_ID_DND_TYPE || type === CUE_ID_DND_TYPE || type === MEDIA_PATH_DND_TYPE || type === DIALOGUE_ID_DND_TYPE

const editorBlockElementAtPosition = (view: EditorView, position: number) => {
  const domAtPosition = view.domAtPos(Math.max(0, Math.min(position, view.state.doc.content.size)))
  const node = domAtPosition.node
  const element = node.nodeType === Node.ELEMENT_NODE
    ? (node as HTMLElement)
    : (node.parentElement as HTMLElement | null)
  return (
    element?.closest<HTMLElement>('[data-note-block="true"], p, h1, h2, h3, h4, h5, h6, blockquote, li, table') ??
    view.dom
  )
}

const handleEditorPointerDrop = (
  view: EditorView,
  payload: StagedeskDragPayload,
  dropPosition: number,
  project: Project,
  activeFilePath: string,
  cueDropActions: {
    insertExistingCue: (cue: MediaCue, position: number) => void
    createCueFromAsset: (asset: MediaAsset, position: number) => void
  },
  setSelectedNoteId: Dispatch<SetStateAction<string>>,
  setSelectedCueId: Dispatch<SetStateAction<string>>,
  showStatus: (message: string, duration?: number) => void,
) => {
  if (payload.type === DIALOGUE_ID_DND_TYPE) {
    const match = nodeMatchByAttr(view.state.doc, 'scriptDialogue', 'id', payload.value)
    if (!match) return false
    if (dropPosition >= match.position && dropPosition <= match.position + match.nodeSize) return true
    if (!moveEditorNode(view, match, dropPosition)) return true
    showStatus('Battuta spostata')
    return true
  }

  if (payload.type === NOTE_ID_DND_TYPE) {
    const note = project.notes.find((item) => item.id === payload.value && item.filePath === activeFilePath)
    const match = nodeMatchByRef(view.state.doc, 'scriptNote', payload.value)
    if (!note || !match) return false
    if (dropPosition >= match.position && dropPosition <= match.position + match.nodeSize) return true
    if (!moveEditorNode(view, match, dropPosition)) return true
    setSelectedNoteId(note.id)
    showStatus(`Nota spostata: ${note.title}`)
    return true
  }

  if (payload.type === CUE_ID_DND_TYPE) {
    const cue = project.cues.find((item) => item.id === payload.value && item.filePath === activeFilePath)
    if (!cue) return false
    if (!moveCueChip(view, cue.id, dropPosition)) {
      cueDropActions.insertExistingCue(cue, dropPosition)
    }
    setSelectedCueId(cue.id)
    showStatus(`Cue spostato: ${cue.title || cue.src}`)
    return true
  }

  if (payload.type === MEDIA_PATH_DND_TYPE) {
    const asset = findTreeNode(project.media, payload.value)
    if (!asset || asset.kind === 'folder') return false
    cueDropActions.createCueFromAsset(asset, dropPosition)
    return true
  }

  return false
}

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

const cueRefsAtEditorSelection = (editor: Editor) => {
  const { selection } = editor.state
  const { $from } = selection
  let block: ProseMirrorNode | undefined

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const candidate = $from.node(depth)
    if (candidate.isBlock) {
      block = candidate
      break
    }
  }

  if (!block && selection instanceof NodeSelection && selection.node?.isBlock) {
    block = selection.node
  }

  const ids: string[] = []
  block?.descendants((node) => {
    if (node.type.name === 'scriptChip' && node.attrs.kind === 'cue' && node.attrs.refId) {
      ids.push(String(node.attrs.refId))
    }
  })
  return uniqueValues(ids)
}

const syncEditorCueRefsAtSelection = (
  editor: Editor,
  setIds: Dispatch<SetStateAction<string[]>>,
) => {
  const next = cueRefsAtEditorSelection(editor)
  setIds((current) => arraysEqual(current, next) ? current : next)
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
  const selectedDialogueId = selectedScriptDialogueId(editor)
  if (selectedDialogueId) {
    const selectedIndex = performanceBlocks.findIndex((block) => block.id === selectedDialogueId)
    if (selectedIndex >= 0) return selectedIndex
  }

  const blockStart = editorSelectionBlockStart(editor)
  const currentLine = editorSourceLineUntilPosition(editor, blockStart)
  const blocks = parseScriptBlocks(editorJsonToMarkdown(editor.getJSON()))
  const currentBlock = blockAtSourceLine(blocks, currentLine)
  const targetBlock =
    scopedFullscreenBlockAtOrAfterLine(blocks, currentLine, currentBlock) ??
    blocks.find((block) => isFullscreenBlock(block.type) && (block.sourceLine ?? 0) >= currentLine)

  if (targetBlock) {
    const targetIndex = performanceBlocks.findIndex((block) =>
      block.position === targetBlock.position &&
      block.sourceLine === targetBlock.sourceLine &&
      block.type === targetBlock.type,
    )
    if (targetIndex >= 0) return targetIndex
  }

  const markdownBeforeCurrentBlock = editorMarkdownUntilPosition(editor, blockStart)
  const fullscreenBlocksBeforeCurrentBlock = parseScriptBlocks(markdownBeforeCurrentBlock).filter((block) =>
    isFullscreenBlock(block.type)
  )
  return Math.min(fullscreenBlocksBeforeCurrentBlock.length, performanceBlocks.length - 1)
}

const selectedScriptDialogueId = (editor: Editor) => {
  const selection = editor.state.selection
  const selectedNode = selection instanceof NodeSelection ? selection.node : undefined
  if (selectedNode?.type.name === 'scriptDialogue') return String(selectedNode.attrs.id ?? '')
  const nodeAtSelection = editor.state.doc.nodeAt(selection.from)
  if (nodeAtSelection?.type.name === 'scriptDialogue') return String(nodeAtSelection.attrs.id ?? '')
  return ''
}

const blockAtSourceLine = (blocks: PerformanceBlock[], sourceLine: number) => {
  const containing = blocks.find((block) =>
    (block.sourceLine ?? -1) <= sourceLine && (block.endLine ?? block.sourceLine ?? -1) >= sourceLine,
  )
  if (containing) return containing
  return [...blocks].reverse().find((block) => (block.sourceLine ?? -1) < sourceLine)
}

const scopedFullscreenBlockAtOrAfterLine = (
  blocks: PerformanceBlock[],
  sourceLine: number,
  currentBlock: PerformanceBlock | undefined,
) => {
  if (currentBlock && isFullscreenBlock(currentBlock.type)) return currentBlock

  const scopeBlock = currentBlock && isHeadingScopeBlock(currentBlock)
    ? currentBlock
    : [...blocks].reverse().find((block) =>
      isHeadingScopeBlock(block) && (block.sourceLine ?? -1) <= sourceLine,
    )
  const scopeEndLine = scopeBlock ? headingScopeEndLine(blocks, scopeBlock) : Number.POSITIVE_INFINITY

  return blocks.find((block) =>
    isFullscreenBlock(block.type) &&
    (block.sourceLine ?? 0) >= sourceLine &&
    (block.sourceLine ?? 0) < scopeEndLine,
  )
}

const isHeadingScopeBlock = (block: PerformanceBlock) =>
  block.type === 'title' || block.type === 'scene' || block.type === 'section'

const headingScopeRank = (block: PerformanceBlock) => {
  if (block.type === 'title') return 1
  if (block.type === 'scene') return 2
  return block.headingLevel ?? 3
}

const headingScopeEndLine = (blocks: PerformanceBlock[], scopeBlock: PerformanceBlock) => {
  const scopeRank = headingScopeRank(scopeBlock)
  const scopeLine = scopeBlock.sourceLine ?? 0
  const nextPeer = blocks.find((block) =>
    isHeadingScopeBlock(block) &&
    (block.sourceLine ?? 0) > scopeLine &&
    headingScopeRank(block) <= scopeRank,
  )
  return nextPeer?.sourceLine ?? Number.POSITIVE_INFINITY
}

const editorSelectionBlockStart = (editor: Editor) => {
  const { doc, selection } = editor.state
  const position = Math.max(0, Math.min(selection.from, doc.content.size))
  const nodeAtSelection = doc.nodeAt(position)
  if (nodeAtSelection?.isBlock) return position

  const { $from } = selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.isBlock) return $from.before(depth)
  }

  return position
}

const editorSourceLineUntilPosition = (editor: Editor, position: number) => {
  const markdown = editorMarkdownUntilPosition(editor, position)
  return markdown ? markdown.split('\n').length : 0
}

const editorMarkdownUntilPosition = (editor: Editor, position: number) => {
  const boundedPosition = Math.max(0, Math.min(position, editor.state.doc.content.size))
  return editorJsonToMarkdown(editor.state.doc.cut(0, boundedPosition).toJSON() as TiptapJsonNode)
}

const validateScriptForFullscreen = (markdown: string, project: Project): ScriptValidationIssue[] => {
  const issues: ScriptValidationIssue[] = []
  const lines = markdown.split('\n')
  const knownCharacterOptions = charactersFromMarkdown(markdown, project.characters)
  const knownCharacters = knownCharacterOptions.map((character) => character.name)
  const seenCharacters: string[] = []
  let h1Count = 0
  let inDirective = false
  let currentSection = ''

  const addIssue = (
    lineIndex: number,
    type: string,
    message: string,
    highlight: string,
    severity: ScriptValidationIssue['severity'] = 'error',
  ) => {
    issues.push({
      id: `${lineIndex + 1}-${type}-${issues.length}`,
      line: lineIndex + 1,
      lineText: lines[lineIndex] ?? '',
      type,
      message,
      highlight,
      severity,
    })
  }

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? ''
    const line = rawLine.trim()

    if (!line) continue
    if (/^::(regia|media)\{/.test(line)) {
      inDirective = true
      continue
    }
    if (inDirective) {
      if (line === '::') inDirective = false
      continue
    }
    if (isMarkdownTableLine(lines, index)) continue
    const structuredDialogue = parseStructuredDialogueMarker(line)
    if (structuredDialogue) {
      const character = structuredDialogue.character.trim()
      const spoken = structuredDialogue.text.trim()
      const normalizedCharacter = normalizeCharacterName(character)
      if (!spoken) {
        addIssue(index, 'Battuta', 'La battuta è vuota dopo il nome del personaggio.', character)
      }
      if (spoken === 'Nuova battuta.') {
        addIssue(index, 'Battuta', 'La battuta contiene ancora il testo provvisorio.', spoken, 'warning')
      }
      if (!structuredDialogue.id) {
        addIssue(index, 'Battuta', 'La battuta strutturata non ha un identificativo interno.', character, 'warning')
      }
      if (!structuredDialogue.characterId) {
        addIssue(index, 'Personaggio', 'La battuta strutturata non è collegata a un personaggio della tabella.', character)
      } else {
        const characterById = knownCharacterOptions.find((item) => item.id === structuredDialogue.characterId)
        const characterByName = knownCharacterOptions.find((item) => normalizeCharacterName(item.name) === normalizedCharacter)
        if (!characterById && !characterByName) {
          addIssue(index, 'Personaggio', 'Il personaggio della battuta non è presente nella tabella personaggi.', character)
        } else if (characterById && normalizeCharacterName(characterById.name) !== normalizedCharacter) {
          addIssue(index, 'Personaggio', `Nome personaggio non allineato alla tabella: "${characterById.name}".`, character, 'warning')
        }
      }
      if (!structuredDialogue.sceneId) {
        addIssue(index, 'Scena', 'La battuta strutturata non è associata a una scena.', character, 'warning')
      }
      const expectedName = closestKnownCharacter(character, [...knownCharacters, ...seenCharacters])
      if (expectedName && normalizeCharacterName(expectedName) !== normalizedCharacter) {
        addIssue(index, 'Personaggio', `Nome personaggio sospetto: forse intendevi "${expectedName}".`, character, 'warning')
      }
      if (!seenCharacters.some((name) => normalizeCharacterName(name) === normalizedCharacter)) {
        seenCharacters.push(character)
      }
      continue
    }
    if (/^\[NOTA:/.test(line) || /^\[CUE[:\s]/.test(line) || /^\[BOOKMARK:/.test(line)) continue
    if (/^> ?/.test(line)) continue
    if (/^-{3,}$/.test(line)) continue

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*$/)
    if (heading) {
      const level = heading[1].length
      const title = heading[2].trim()
      if (level === 1) {
        currentSection = ''
        h1Count += 1
        if (h1Count > 1) {
          addIssue(index, 'Struttura', 'È presente più di un titolo H1 nel file.', heading[1])
        }
      } else if (level === 2) {
        currentSection = ''
        if (!/^scena\b/i.test(title)) {
          addIssue(index, 'Struttura', 'Un titolo H2 deve indicare una scena, ad esempio "## Scena 1".', title)
        }
      } else if (level === 3) {
        currentSection = normalizeSectionTitle(title)
        if (/^personaggi\b/i.test(title) && !nextContentStartsTable(lines, index + 1)) {
          addIssue(index, 'Personaggi', 'La sezione Personaggi dovrebbe essere seguita da una tabella.', title, 'warning')
        }
      } else if (level > 3) {
        addIssue(index, 'Struttura', 'In modalità spettacolo sono previsti H1, H2 e H3: evita livelli inferiori.', heading[1])
      }
      continue
    }

    const dialogue = line.match(/^\*\*([^*:\n]+)\*\*:\s+(.+)$/) ?? line.match(/^\*\*([^*:\n]+):\*\*\s+(.+)$/)
    if (dialogue) {
      const character = dialogue[1].trim()
      const spoken = dialogue[2].trim()
      if (!spoken) {
        addIssue(index, 'Battuta', 'La battuta è vuota dopo il nome del personaggio.', rawLine.replace(spoken, '').trim())
      }
      const expectedName = closestKnownCharacter(character, [...knownCharacters, ...seenCharacters])
      if (expectedName && normalizeCharacterName(expectedName) !== normalizeCharacterName(character)) {
        addIssue(index, 'Personaggio', `Nome personaggio sospetto: forse intendevi "${expectedName}".`, character, 'warning')
      }
      if (!seenCharacters.some((name) => normalizeCharacterName(name) === normalizeCharacterName(character))) {
        seenCharacters.push(character)
      }
      continue
    }

    if (/^\*\*[^*]+\*\*\s+:/.test(line)) {
      addIssue(index, 'Tipografia', 'Rimuovi lo spazio prima dei due punti: usa "**PERSONAGGIO**: Battuta".', ':')
      continue
    }
    if (/^\*\*[^*]+\*\*:\S/.test(line)) {
      addIssue(index, 'Tipografia', 'Aggiungi uno spazio dopo i due punti: usa "**PERSONAGGIO**: Battuta".', ':')
      continue
    }
    if (/^[A-ZÀ-Ý0-9 '._-]{2,}\s*:/.test(line)) {
      addIssue(index, 'Battuta', 'Il nome del personaggio deve essere in grassetto: "**PERSONAGGIO**: Battuta".', line.split(':')[0])
      continue
    }
    if (/^[A-ZÀ-Ý0-9 '._-]{2,}$/.test(line)) {
      addIssue(index, 'Battuta', 'Evita il nome personaggio su riga separata: usa "**PERSONAGGIO**: Battuta".', line)
      continue
    }
    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      if (currentSection === 'sinossi') continue
      addIssue(index, 'Paragrafo', 'Lista non collegata a una nota o a una tabella personaggi.', line.slice(0, 2), 'warning')
      continue
    }
    if (currentSection === 'sinossi') continue

    addIssue(index, 'Paragrafo', 'Paragrafo scollegato: usa una battuta, una nota, una citazione, un cue o una sezione strutturata.', line)
  }

  if (h1Count === 0 && lines.some((line) => line.trim())) {
    issues.unshift({
      id: 'missing-h1',
      line: 1,
      lineText: lines[0] ?? '',
      type: 'Struttura',
      message: 'Manca un titolo H1 per il copione.',
      highlight: lines[0] ?? '',
      severity: 'error',
    })
  }

  return issues
}

const charactersFromMarkdown = (markdown: string, fallbackCharacters: CharacterOption[]): CharacterOption[] => {
  const tableCharacters = new Map<string, CharacterOption>()
  const rows = markdown.split('\n')
  for (let index = 0; index < rows.length - 1; index += 1) {
    if (!isCharacterTableHeader(rows[index], rows[index + 1])) continue
    const headers = splitMarkdownTableCells(rows[index]).map((cell) => normalizeCharacterHeader(cell))
    const idIndex = headers.indexOf('id')
    const nameIndex = headers.indexOf('personaggio')
    if (nameIndex < 0) continue
    index += 2
    while (index < rows.length && /^\s*\|/.test(rows[index] ?? '')) {
      const cells = splitMarkdownTableCells(rows[index])
      const name = cells[nameIndex]?.trim()
      const id = cells[idIndex]?.trim() || slug(name)
      if (isValidCharacterOption(id, name)) {
        tableCharacters.set(id, { id, name })
      }
      index += 1
    }
    if (tableCharacters.size > 0) return [...tableCharacters.values()]
  }

  const characters = new Map<string, CharacterOption>()
  for (const character of fallbackCharacters) {
    if (isValidCharacterOption(character.id, character.name) && !characters.has(character.id)) {
      characters.set(character.id, { id: character.id, name: character.name })
    }
  }

  return [...characters.values()]
}

const isCharacterTableHeader = (headerLine = '', separatorLine = '') => {
  const headers = splitMarkdownTableCells(headerLine).map((cell) => normalizeCharacterHeader(cell))
  return headers.includes('personaggio') &&
    /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(separatorLine)
}

const splitMarkdownTableCells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim().replace(/\\\|/g, '|'))

const normalizeCharacterHeader = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()

const isMarkdownTableSeparatorValue = (value: string) =>
  /^:?-{3,}:?$/.test(value.trim())

const isValidCharacterOption = (id: string, name: string) =>
  Boolean(
    id &&
    name &&
    !isMarkdownTableSeparatorValue(id) &&
    !isMarkdownTableSeparatorValue(name) &&
    normalizeCharacterHeader(id) !== 'id' &&
    normalizeCharacterHeader(name) !== 'personaggio',
  )

const parseStructuredDialogueMarker = (line: string) => {
  const match = line.match(/^\[BATTUTA:\s*([^\]]+)\]\s*(?:\{([^}]*)\})?$/)
  if (!match) return undefined
  const attrs = match[2] ?? ''
  return {
    character: match[1].trim(),
    id: readMarkdownMarkerId(attrs),
    characterId: readMarkdownAttr(attrs, 'characterId') ?? '',
    text: readMarkdownAttr(attrs, 'text') ?? '',
    sceneId: readMarkdownAttr(attrs, 'sceneId') ?? '',
  }
}

const readMarkdownMarkerId = (attrs: string) => {
  const match = attrs.match(/#([^\s}]+)/)
  return match?.[1] ?? ''
}

const readMarkdownAttr = (attrs: string, name: string) => {
  const match = attrs.match(new RegExp(`${name}="([^"]*)"`, 'i'))
  return match ? decodeMarkdownAttr(match[1]) : undefined
}

const isMarkdownTableLine = (lines: string[], index: number) => {
  const line = lines[index] ?? ''
  if (!/^\s*\|/.test(line)) return false
  if (/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)) return true
  return /^\s*\|/.test(lines[index + 1] ?? '') || /^\s*\|/.test(lines[index - 1] ?? '')
}

const nextContentStartsTable = (lines: string[], startIndex: number) => {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? ''
    if (!line) continue
    return /^\|/.test(line)
  }
  return false
}

const closestKnownCharacter = (character: string, candidates: string[]) => {
  const normalized = normalizeCharacterName(character)
  if (!normalized) return undefined
  let best: { name: string; distance: number } | undefined
  for (const candidate of candidates) {
    const candidateNormalized = normalizeCharacterName(candidate)
    if (!candidateNormalized || candidateNormalized === normalized) continue
    if (hasDifferentNumericSuffix(normalized, candidateNormalized)) continue
    const distance = levenshteinDistance(normalized, candidateNormalized)
    const limit = normalized.length <= 6 ? 1 : 2
    if (distance <= limit && (!best || distance < best.distance)) {
      best = { name: candidate, distance }
    }
  }
  return best?.name
}

const normalizeCharacterName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()

const hasDifferentNumericSuffix = (left: string, right: string) => {
  const leftMatch = left.match(/^(.+?)(\d+)$/)
  const rightMatch = right.match(/^(.+?)(\d+)$/)
  return Boolean(
    leftMatch &&
    rightMatch &&
    leftMatch[1] === rightMatch[1] &&
    leftMatch[2] !== rightMatch[2],
  )
}

const normalizeSectionTitle = (title: string) =>
  title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

const levenshteinDistance = (left: string, right: string) => {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => [index])
  for (let column = 1; column <= right.length; column += 1) rows[0][column] = column
  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1
      rows[row][column] = Math.min(
        rows[row - 1][column] + 1,
        rows[row][column - 1] + 1,
        rows[row - 1][column - 1] + cost,
      )
    }
  }
  return rows[left.length][right.length]
}

const editorPositionForValidationIssue = (editor: Editor, issue: ScriptValidationIssue) => {
  const targetText = validationSearchText(issue.lineText)
  let fallbackPosition = 1
  let blockIndex = 0
  const targetIndex = Math.max(0, issue.line - 1)

  editor.state.doc.descendants((node, position) => {
    if (!node.isBlock) return
    const text = validationSearchText(node.textContent ?? '')
    if (targetText && text === targetText) {
      fallbackPosition = position + 1
      return false
    }
    if (blockIndex <= targetIndex) fallbackPosition = position + 1
    blockIndex += 1
  })

  return fallbackPosition
}

const validationSearchText = (value: string) =>
  value
    .replace(/^#{1,6}\s+/, '')
    .replace(/^\*\*([^*]+)\*\*:\s*/, '$1: ')
    .replace(/^> ?/, '')
    .trim()

const syncEditorSceneState = (editor: Editor, setActiveSceneId: Dispatch<SetStateAction<string>>) => {
  const sceneId = editorSceneIdAtPosition(editor.state.doc, editor.state.selection.from)
  setActiveSceneId((current) => (current === sceneId ? current : sceneId))
}

function sceneIdsMatch(left: string | undefined, right: string | undefined) {
  if (!left || !right) return false
  if (left === right) return true
  const sceneKey = (value: string) => {
    const normalized = normalizeSectionTitle(value)
    const sceneIndex = normalized.indexOf('scena-')
    return sceneIndex >= 0 ? normalized.slice(sceneIndex) : normalized
  }
  return sceneKey(left) === sceneKey(right)
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
  const tableActive = editor.isActive('table') || selectionIsInsideNode(editor, 'table')

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
    table: tableActive,
  }
}

const selectionIsInsideNode = (editor: Editor, nodeType: string) => {
  const { $from } = editor.state.selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === nodeType) return true
  }
  return false
}

const currentTableContext = (editor: Editor) => {
  const { $from } = editor.state.selection
  let tableNode: ProseMirrorNode | undefined
  let rowNode: ProseMirrorNode | undefined
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (!rowNode && node.type.name === 'tableRow') rowNode = node
    if (!tableNode && node.type.name === 'table') tableNode = node
  }
  const isHeaderRow = Boolean(rowNode && tableRowIsHeader(rowNode))
  const isCharacterTable = Boolean(tableNode && tableIsCharacterTable(tableNode))
  return { tableNode, rowNode, isHeaderRow, isCharacterTable }
}

const tableRowIsHeader = (row: ProseMirrorNode) => {
  if (row.childCount === 0) return false
  for (let index = 0; index < row.childCount; index += 1) {
    if (row.child(index).type.name !== 'tableHeader') return false
  }
  return true
}

const tableIsCharacterTable = (table: ProseMirrorNode) => {
  if (table.childCount === 0) return false
  const cells = tableRowTexts(table.child(0)).map(normalizeTableHeaderText)
  return (
    cells[0] === 'personaggio' &&
    (cells[1] === 'attore' || cells[1] === 'interprete') &&
    cells[2] === 'presenza' &&
    cells[3] === 'note'
  )
}

const tableRowTexts = (row: ProseMirrorNode) => {
  const cells: string[] = []
  for (let index = 0; index < row.childCount; index += 1) {
    cells.push(row.child(index).textContent.trim())
  }
  return cells
}

const normalizeTableHeaderText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

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

const editorNoteCollapseSummary = (editor: Editor | null) => {
  const summary = { total: 0, collapsed: 0 }
  editor?.state.doc.descendants((node) => {
    if (node.type.name !== 'scriptNote') return
    summary.total += 1
    if (node.attrs.collapsed === true || node.attrs.collapsed === 'true') {
      summary.collapsed += 1
    }
  })
  return summary
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
  normalizeEditorMarkdownSpacing((doc.content ?? []).map((node) => blockJsonToMarkdown(node)).join('\n'))

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
  if (node.type === 'scriptDialogue') return dialogueMarkerFromAttrs(node.attrs)
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
  const label = sanitizeChipLabel(attrs?.label || attrs?.refId, 'Bookmark')
  const refId = String(attrs?.refId || '')
  return refId ? `[BOOKMARK: ${label}] {#${refId}}` : `[BOOKMARK: ${label}]`
}

const dialogueMarkerFromAttrs = (attrs?: Record<string, unknown>) => {
  const character = String(attrs?.character || 'PERSONAGGIO')
  const id = String(attrs?.id || `battuta-${crypto.randomUUID().slice(0, 8)}`)
  const characterId = String(attrs?.characterId || slug(character))
  const text = String(attrs?.text || '')
  const sceneId = String(attrs?.sceneId || '')
  const attrsText = [
    `#${id}`,
    `characterId="${escapeMarkdownAttr(characterId)}"`,
    `text="${escapeMarkdownAttr(text)}"`,
    sceneId ? `sceneId="${escapeMarkdownAttr(sceneId)}"` : '',
  ].filter(Boolean).join(' ')
  return `[BATTUTA: ${character}] {${attrsText}}`
}

const escapeMarkdownAttr = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/\n/g, '&#10;')

const decodeMarkdownAttr = (value: string) =>
  value.replace(/&#10;/g, '\n').replace(/&quot;/g, '"').replace(/&amp;/g, '&')

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
    match = { position: pos, nodeSize: node.nodeSize, attrs: node.attrs, node }
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

const nodeMatchByAttr = (
  doc: ProseMirrorDocNode,
  nodeType: string,
  attrName: string,
  attrValue: string,
): ScriptNodeMatch | undefined => {
  if (!attrValue) return undefined
  let match: ScriptNodeMatch | undefined
  doc.descendants((node, pos) => {
    if (match || node.type.name !== nodeType || String(node.attrs[attrName] ?? '') !== attrValue) return
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
      match = { position: pos, nodeSize: node.nodeSize, attrs: node.attrs, node }
      return
    }
    currentIndex += 1
  })
  return match
}

const insertionPositionForNode = (doc: ProseMirrorNode, position: number, node: ProseMirrorNode) => {
  const boundedPosition = Math.max(0, Math.min(position, doc.content.size))
  const directPosition = insertPoint(doc, boundedPosition, node.type)
  if (directPosition !== null && directPosition !== undefined) return directPosition

  const resolvedPosition = doc.resolve(boundedPosition)
  for (let depth = resolvedPosition.depth; depth >= 0; depth -= 1) {
    const afterPosition = depth > 0 ? resolvedPosition.after(depth) : doc.content.size
    const afterInsertPosition = insertPoint(doc, Math.min(afterPosition, doc.content.size), node.type)
    if (afterInsertPosition !== null && afterInsertPosition !== undefined) return afterInsertPosition

    const beforePosition = depth > 0 ? resolvedPosition.before(depth) : 0
    const beforeInsertPosition = insertPoint(doc, Math.max(0, beforePosition), node.type)
    if (beforeInsertPosition !== null && beforeInsertPosition !== undefined) return beforeInsertPosition
  }

  return undefined
}

const selectionNear = (doc: ProseMirrorNode, position: number, bias = 1) =>
  Selection.near(doc.resolve(Math.max(0, Math.min(position, doc.content.size))), bias)

const standaloneBlockAroundInlineNode = (doc: ProseMirrorNode, match: ScriptChipMatch): ScriptNodeMatch | undefined => {
  const resolvedPosition = doc.resolve(match.position)
  for (let depth = resolvedPosition.depth; depth > 0; depth -= 1) {
    const node = resolvedPosition.node(depth)
    if (!node.isBlock) continue
    if (node.childCount === 1 && node.firstChild === match.node) {
      return {
        position: resolvedPosition.before(depth),
        nodeSize: node.nodeSize,
        attrs: node.attrs,
        node,
      }
    }
    return undefined
  }

  return undefined
}

const moveEditorNode = (view: EditorView, match: ScriptNodeMatch, dropPosition: number) => {
  const insertPosition = insertionPositionForNode(view.state.doc, dropPosition, match.node)
  if (insertPosition === undefined) return false
  if (insertPosition >= match.position && insertPosition <= match.position + match.nodeSize) return true

  const transaction = view.state.tr.delete(match.position, match.position + match.nodeSize)
  const mappedPosition = transaction.mapping.map(insertPosition, match.position < insertPosition ? -1 : 1)
  const safePosition = insertionPositionForNode(transaction.doc, mappedPosition, match.node)
  if (safePosition === undefined) return false

  const nextTransaction = transaction.insert(safePosition, match.node)
  view.dispatch(nextTransaction.setSelection(selectionNear(nextTransaction.doc, safePosition + match.node.nodeSize, -1)))
  return true
}

const moveCueChip = (view: EditorView, cueId: string, dropPosition: number) => {
  const match = chipMatchByRef(view.state.doc, 'cue', cueId)
  if (!match) return false
  const movable = standaloneBlockAroundInlineNode(view.state.doc, match) ?? match
  return moveEditorNode(view, movable, dropPosition)
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
    const refId = block.cueId ?? cueRefIdFromBlockText(block.text ?? '')
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
  const shortcutFeedbackTimerRef = useRef<number | undefined>(undefined)
  const activePlaybackRef = useRef<{ cueId: string; assetUrl: string; type: 'audio' | 'video'; token: number } | undefined>(undefined)
  const playingCueRef = useRef<MediaCue | undefined>(undefined)
  const onCueExecutedRef = useRef(onCueExecuted)
  const [playingCueId, setPlayingCueId] = useState('')
  const [playbackToken, setPlaybackToken] = useState(0)
  const [mediaStatus, setMediaStatus] = useState('Pronto')
  const [nativeAudioPaused, setNativeAudioPaused] = useState(false)
  const [pressedShortcut, setPressedShortcut] = useState('')
  const stepCue = block?.cueId ? cues.find((cue) => cue.id === block.cueId) : undefined
  const stepAsset = stepCue ? findTreeNode(media, stepCue.src) : undefined
  const stepAssetUrl = stepAsset ? mediaAssetUrl(stepAsset, projectRootPath) : undefined
  const playingCue = cues.find((cue) => cue.id === playingCueId)
  const playingAsset = playingCue ? findTreeNode(media, playingCue.src) : undefined
  const playingAssetUrl = playingAsset ? mediaAssetUrl(playingAsset, projectRootPath) : undefined
  const playingAssetSourcePath = playingAsset?.sourcePath
  playingCueRef.current = playingCue
  onCueExecutedRef.current = onCueExecuted
  const visualCue = isVisualCue(stepCue) ? stepCue : undefined
  const playablePlayingCue = isPlayableCue(playingCue) ? playingCue : undefined
  const isCueStep = block?.type === 'media'
  const fullscreenLabel = fullscreenBlockLabel(block, isCueStep)
  const fullscreenText = isCueStep ? stepCue?.title || block?.text || 'Cue multimediale' : block?.text ?? 'Nessuna battuta disponibile.'
  const density = fullscreenText.length > 420 ? 'dense' : fullscreenText.length > 220 ? 'medium' : 'normal'

  const requestCuePlayback = useCallback((cueId: string) => {
    setPlayingCueId(cueId)
    setPlaybackToken((current) => current + 1)
  }, [])

  useEffect(() => {
    if (!stepCue || !stepCue.autoplay) return

    if (stepCue.type === 'image') {
      setMediaStatus(`Immagine visualizzata: ${stepCue.title || stepCue.src}`)
      onCueExecutedRef.current(stepCue.id)
      return
    }

    requestCuePlayback(stepCue.id)
  }, [index, requestCuePlayback, stepCue])

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
      activePlayback.type === playbackType &&
      activePlayback.token === playbackToken
    ) {
      return
    }
    activePlaybackRef.current = { cueId: cue.id, assetUrl, type: playbackType, token: playbackToken }
    clearAudioTimers(audioTimersRef)
    setNativeAudioPaused(false)

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
            .catch((mutedError: unknown) => {
              if (!cancelled) setMediaStatus(playbackErrorMessage(cue, mutedError))
            })
        })
      return () => {
        cancelled = true
        video.onended = null
        clearAudioTimers(audioTimersRef)
        if (activePlaybackRef.current?.cueId === cue.id) activePlaybackRef.current = undefined
      }
    }

    if (shouldUseNativeAudioPlayback()) {
      video?.pause()
      audio?.pause()
      void playNativeAudioAsset(cue, playingAssetSourcePath)
        .then((playbackDuration) => {
          if (cancelled) return
          onCueExecutedRef.current(cue.id)
          setNativeAudioPaused(false)
          setMediaStatus(`In esecuzione: ${cue.title || cue.src}`)
          scheduleNativeCueEnd(cue, audioTimersRef, playbackDuration, () => {
            activePlaybackRef.current = undefined
            setPlayingCueId('')
            setNativeAudioPaused(false)
            setMediaStatus(`Cue terminato: ${cue.title || cue.src}`)
          })
        })
        .catch((error: unknown) => {
          if (!cancelled) setMediaStatus(nativePlaybackErrorMessage(cue, error))
        })

      return () => {
        cancelled = true
        clearAudioTimers(audioTimersRef)
        if (activePlaybackRef.current?.cueId === cue.id) {
          activePlaybackRef.current = undefined
          void stopNativeAudioAsset()
        }
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
      .catch((error: unknown) => {
        if (!cancelled) setMediaStatus(playbackErrorMessage(cue, error))
      })

    return () => {
      cancelled = true
      audio.onended = null
      clearAudioTimers(audioTimersRef)
      if (activePlaybackRef.current?.cueId === cue.id) activePlaybackRef.current = undefined
    }
  }, [playbackToken, playingAssetSourcePath, playingAssetUrl, playingCueId])

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
      setNativeAudioPaused(false)
      requestCuePlayback(stepCue.id)
      return
    }

    if (isAudioCue(playablePlayingCue) && shouldUseNativeAudioPlayback()) {
      if (nativeAudioPaused) {
        clearAudioTimers(audioTimersRef)
        void resumeNativeAudioAsset()
          .then(() => {
            setNativeAudioPaused(false)
            setMediaStatus(`In esecuzione: ${playablePlayingCue.title || playablePlayingCue.src}`)
            scheduleNativeCueEnd(playablePlayingCue, audioTimersRef, undefined, () => {
              activePlaybackRef.current = undefined
              setPlayingCueId('')
              setNativeAudioPaused(false)
              setMediaStatus(`Cue terminato: ${playablePlayingCue.title || playablePlayingCue.src}`)
            })
          })
          .catch((error: unknown) => setMediaStatus(nativePlaybackErrorMessage(playablePlayingCue, error)))
      } else {
        clearAudioTimers(audioTimersRef)
        void pauseNativeAudioAsset()
        setNativeAudioPaused(true)
        setMediaStatus('Pausa')
      }
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
      if (shouldUseNativeAudioPlayback()) void stopNativeAudioAsset()
      setPlayingCueId('')
      activePlaybackRef.current = undefined
      setNativeAudioPaused(false)
      setMediaStatus('Media fermati')
      return
    }
    if (isAudioCue(playablePlayingCue) && shouldUseNativeAudioPlayback()) {
      clearAudioTimers(audioTimersRef)
      void stopNativeAudioAsset()
      activePlaybackRef.current = undefined
      setPlayingCueId('')
      setNativeAudioPaused(false)
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
      setNativeAudioPaused(false)
      setMediaStatus('Media fermati')
    })
  }

  const restartPlayback = () => {
    const cue = stepCue ?? playablePlayingCue
    if (!cue) return
    clearAudioTimers(audioTimersRef)
    if (cue.type === 'image') {
      setMediaStatus(`Immagine visualizzata: ${cue.title || cue.src}`)
      onCueExecuted(cue.id)
      setPlayingCueId('')
      activePlaybackRef.current = undefined
      return
    }
    if (!isPlayableCue(cue)) return
    setNativeAudioPaused(false)
    requestCuePlayback(cue.id)
    setMediaStatus(`Riavvio cue: ${cue.title || cue.src}`)
  }

  const showShortcutFeedback = (shortcut: string) => {
    setPressedShortcut(shortcut)
    if (shortcutFeedbackTimerRef.current) window.clearTimeout(shortcutFeedbackTimerRef.current)
    shortcutFeedbackTimerRef.current = window.setTimeout(() => {
      setPressedShortcut('')
      shortcutFeedbackTimerRef.current = undefined
    }, 180)
  }

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const handledKeys = ['arrowright', 'arrowleft', 'home', 'end', 'escape', ' ', 's', 'r']
      if (!handledKeys.includes(key)) return
      event.preventDefault()
      const shortcut = key === 'arrowleft'
        ? 'previous'
        : key === 'arrowright'
          ? 'next'
          : key === ' '
            ? 'space'
            : key
      showShortcutFeedback(shortcut)
      if (event.key === 'ArrowRight') onNext()
      if (event.key === 'ArrowLeft') onPrevious()
      if (event.key === 'Home') onHome()
      if (event.key === 'End') onEnd()
      if (event.key === 'Escape') onClose()
      if (event.key === ' ') {
        togglePlayback()
      }
      if (key === 's') stopPlayback()
      if (key === 'r') restartPlayback()
    }
    window.addEventListener('keydown', handleWindowKeyDown)
    return () => window.removeEventListener('keydown', handleWindowKeyDown)
  })

  const simulateFullscreenShortcut = (key: string, code = key) => {
    const shortcut = key === 'ArrowLeft'
      ? 'previous'
      : key === 'ArrowRight'
        ? 'next'
        : code === 'Space'
          ? 'space'
          : key.toLowerCase()
    showShortcutFeedback(shortcut)
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key,
      code,
      bubbles: true,
      cancelable: true,
    }))
  }

  return (
    <div className="fullscreen-view" tabIndex={0}>
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
      <div className="fullscreen-shortcuts" aria-label="Scorciatoie fullscreen">
        <button type="button" className={pressedShortcut === 'previous' ? 'is-pressed' : ''} onClick={() => simulateFullscreenShortcut('ArrowLeft')} title="Battuta precedente">
          <kbd className="shortcut-key-icon"><SkipBack size={13} strokeWidth={2.6} aria-hidden="true" /></kbd><span>Precedente</span>
        </button>
        <button type="button" className={pressedShortcut === 'next' ? 'is-pressed' : ''} onClick={() => simulateFullscreenShortcut('ArrowRight')} title="Battuta successiva">
          <kbd className="shortcut-key-icon"><SkipForward size={13} strokeWidth={2.6} aria-hidden="true" /></kbd><span>Avanti</span>
        </button>
        <button type="button" className={pressedShortcut === 'space' ? 'is-pressed' : ''} onClick={() => simulateFullscreenShortcut(' ', 'Space')} title="Spazio">
          <kbd>Spazio</kbd><span>Play/Pausa</span>
        </button>
        <button type="button" className={pressedShortcut === 's' ? 'is-pressed' : ''} onClick={() => simulateFullscreenShortcut('s')} title="S">
          <kbd>S</kbd><span>Stop</span>
        </button>
        <button type="button" className={pressedShortcut === 'r' ? 'is-pressed' : ''} onClick={() => simulateFullscreenShortcut('r')} title="R">
          <kbd>R</kbd><span>Riavvia</span>
        </button>
        <button type="button" className={pressedShortcut === 'home' ? 'is-pressed' : ''} onClick={() => simulateFullscreenShortcut('Home')} title="Home">
          <kbd>Home</kbd><span>Prima</span>
        </button>
        <button type="button" className={pressedShortcut === 'end' ? 'is-pressed' : ''} onClick={() => simulateFullscreenShortcut('End')} title="Fine">
          <kbd>Fine</kbd><span>Ultima</span>
        </button>
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

const loadPersistedUiState = (projectId: string): PersistedUiState | undefined => {
  if (typeof window === 'undefined') return undefined
  try {
    const rawState = window.localStorage.getItem(UI_STATE_STORAGE_KEY)
    if (!rawState) return undefined
    const state = JSON.parse(rawState) as Partial<PersistedUiState>
    if (state.projectId !== projectId) return undefined
    if (
      typeof state.activePath !== 'string' ||
      !Array.isArray(state.openTabs) ||
      typeof state.selectedScriptPath !== 'string' ||
      typeof state.selectedMediaPath !== 'string' ||
      !Array.isArray(state.expandedPaths)
    ) {
      return undefined
    }
    return {
      projectId,
      activePath: state.activePath,
      openTabs: state.openTabs.filter((path): path is string => typeof path === 'string'),
      selectedScriptPath: state.selectedScriptPath,
      selectedMediaPath: state.selectedMediaPath,
      expandedPaths: state.expandedPaths.filter((path): path is string => typeof path === 'string'),
      leftTab: ['outline', 'script', 'media', 'bookmarks'].includes(String(state.leftTab))
        ? state.leftTab as PersistedUiState['leftTab']
        : 'outline',
      editorSelection: typeof state.editorSelection === 'number' ? state.editorSelection : undefined,
    }
  } catch {
    window.localStorage.removeItem(UI_STATE_STORAGE_KEY)
    return undefined
  }
}

const savePersistedUiState = (state: PersistedUiState) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(UI_STATE_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // UI state persistence is best-effort and must never interrupt editing.
  }
}

type PersistedWindowState = {
  width: number
  height: number
  x: number
  y: number
}

const loadPersistedWindowState = (): PersistedWindowState | undefined => {
  if (typeof window === 'undefined') return undefined
  try {
    const rawState = window.localStorage.getItem(WINDOW_STATE_STORAGE_KEY)
    if (!rawState) return undefined
    const state = JSON.parse(rawState) as Partial<PersistedWindowState>
    if (
      typeof state.width !== 'number' ||
      typeof state.height !== 'number' ||
      typeof state.x !== 'number' ||
      typeof state.y !== 'number'
    ) {
      return undefined
    }
    return {
      width: state.width,
      height: state.height,
      x: state.x,
      y: state.y,
    }
  } catch {
    window.localStorage.removeItem(WINDOW_STATE_STORAGE_KEY)
    return undefined
  }
}

const savePersistedWindowState = (state: PersistedWindowState) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(WINDOW_STATE_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Window state persistence is best-effort.
  }
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
    const parameters = new URLSearchParams({ path: asset.path })
    if (asset.sourcePath) parameters.set('source', asset.sourcePath)
    return `/__project-storage/media?${parameters.toString()}`
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

const prepareMediaSourceForCue = (media: HTMLMediaElement, cue: MediaCue, assetUrl?: string) => {
  const preparedAssetUrl = assetUrl ? new URL(assetUrl, window.location.href).href : undefined
  if (preparedAssetUrl && media.src !== preparedAssetUrl) {
    media.src = preparedAssetUrl
    media.load()
  } else if (!media.src || media.readyState === 0) {
    media.load()
  }

  const startAt = Math.max(0, cue.options.startAt ?? 0)
  if (media.readyState >= 1 && Number.isFinite(startAt) && Math.abs(media.currentTime - startAt) > 0.05) {
    try {
      media.currentTime = startAt
    } catch {
      // Some WebKitGTK builds reject currentTime changes until metadata is fully available.
    }
  }

  return media.src
}

const alignMediaForCue = async (media: HTMLMediaElement, cue: MediaCue, preparedSrc: string) => {
  await waitForMediaReady(media, 1)
  if (media.src !== preparedSrc) return
  const startAt = Math.max(0, cue.options.startAt ?? 0)
  if (Number.isFinite(startAt) && Math.abs(media.currentTime - startAt) > 0.05) {
    media.currentTime = startAt
    await waitForMediaReady(media, 2)
  }
  await waitForMediaReady(media, 2)
}

const prepareMediaForCue = async (media: HTMLMediaElement, cue: MediaCue, assetUrl?: string) => {
  const preparedSrc = prepareMediaSourceForCue(media, cue, assetUrl)
  await alignMediaForCue(media, cue, preparedSrc)
  return preparedSrc
}

const isPlaybackNotAllowed = (error: unknown) =>
  error instanceof DOMException
    ? error.name === 'NotAllowedError'
    : error instanceof Error && error.name === 'NotAllowedError'

const playbackErrorMessage = (cue: MediaCue, error: unknown) => {
  const label = cue.title || cue.src
  const errorName = error instanceof DOMException ? error.name : error instanceof Error ? error.name : ''
  const errorMessage = error instanceof Error ? error.message : typeof error === 'string' ? error : ''

  if (errorName === 'NotAllowedError') return `Cue pronto, avvio bloccato dal browser: ${label}`
  if (errorName === 'NotSupportedError') {
    return `Cue non riproducibile: ${label}. Verifica che il file sia un MP3/WAV supportato dal sistema.`
  }
  if (/not supported|format|decode|demux|codec/i.test(errorMessage)) {
    return `Cue non riproducibile: ${label}. Formato o codec audio non supportato dal sistema.`
  }
  if (errorMessage.trim()) return `Cue non avviato: ${label}. ${errorMessage}`
  return `Cue non avviato: ${label}`
}

const mediaElementErrorMessage = (cue: MediaCue, error: MediaError | null) => {
  const label = cue.title || cue.src
  if (!error) return `Cue non riproducibile: ${label}`
  if (error.code === MediaError.MEDIA_ERR_ABORTED) return `Cue interrotto: ${label}`
  if (error.code === MediaError.MEDIA_ERR_NETWORK) return `Cue non caricato: ${label}. Verifica che il file esista nel progetto.`
  if (error.code === MediaError.MEDIA_ERR_DECODE) {
    return `Cue non riproducibile: ${label}. Il file audio non viene decodificato dal sistema.`
  }
  if (error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
    return `Cue non riproducibile: ${label}. Formato o codec audio non supportato dal sistema.`
  }
  return `Cue non riproducibile: ${label}`
}

const playbackBackendName = (nativeAudio: boolean) =>
  nativeAudio ? 'native' : 'media-element'

const playbackLog = (
  scope: PlaybackLogEntry['scope'],
  action: string,
  cue?: MediaCue,
  details?: Record<string, unknown>,
) => {
  if (typeof window === 'undefined') return
  const timestamp = new Date().toISOString()
  const page = {
    visibilityState: document.visibilityState,
    hasFocus: document.hasFocus(),
    readyState: document.readyState,
    url: window.location.href,
  }
  const entry: PlaybackLogEntry = {
    version: PLAYBACK_LOG_VERSION,
    sessionId: PLAYBACK_SESSION_ID,
    timestamp,
    scope,
    action,
    cueId: cue?.id,
    cueType: cue?.type,
    label: cue?.title || cue?.src,
    details: sanitizePlaybackDetails({
      ...details,
      logVersion: PLAYBACK_LOG_VERSION,
      sessionId: PLAYBACK_SESSION_ID,
      page,
    }),
  }
  const logs = [...readPlaybackLogs(), entry].slice(-200)
  const previous = logs.length > 1 ? logs[logs.length - 2] : undefined
  const isDuplicate = previous &&
    previous.scope === entry.scope &&
    previous.action === entry.action &&
    previous.cueId === entry.cueId &&
    previous.details?.reason === entry.details?.reason &&
    previous.details?.previewId === entry.details?.previewId &&
    Date.parse(entry.timestamp) - Date.parse(previous.timestamp) < 1000
  if (isDuplicate) {
    const repeatCount = (previous.repeatCount ?? 1) + 1
    logs.splice(logs.length - 2, 2, { ...entry, repeatCount })
  }
  writePlaybackLogs(logs)
  try {
    document.documentElement.setAttribute('data-stagedesk-playback-log', JSON.stringify(logs.slice(-20)))
  } catch {
    // Diagnostic mirror only.
  }
  try {
    ;(window as PlaybackLogWindow).__STAGEDESK_PLAYBACK_LOGS__ = logs
  } catch {
    // Some embedded browser inspection contexts expose a non-extensible global object.
  }
  const logMethod = /error|reject|missing|blocked|failed/i.test(action) ? 'error' : 'info'
  console[logMethod]('[StageDesk playback]', entry)
  window.dispatchEvent(new CustomEvent('stagedesk-playback-log', { detail: entry }))
}

const readPlaybackLogs = () => {
  try {
    const raw = window.localStorage.getItem(PLAYBACK_LOG_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as PlaybackLogEntry[] : []
  } catch {
    return []
  }
}

const writePlaybackLogs = (logs: PlaybackLogEntry[]) => {
  try {
    window.localStorage.setItem(PLAYBACK_LOG_STORAGE_KEY, JSON.stringify(logs))
  } catch {
    // Logging must never break playback.
  }
}

const sanitizePlaybackDetails = (details?: Record<string, unknown>) => {
  if (!details) return undefined
  try {
    return JSON.parse(JSON.stringify(details)) as Record<string, unknown>
  } catch {
    return { raw: String(details) }
  }
}

const playbackErrorDetails = (error: unknown) => {
  const isDomException = typeof DOMException !== 'undefined' && error instanceof DOMException
  if (isDomException || error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }
  return {
    type: typeof error,
    message: typeof error === 'string' ? error : safeStringify(error),
  }
}

const mediaErrorDetails = (error: MediaError | null) => {
  if (!error) return undefined
  return {
    code: error.code,
    message: error.message,
  }
}

const mediaElementSnapshot = (media: HTMLMediaElement | null | undefined) => {
  if (!media) return undefined
  return {
    tagName: media.tagName,
    src: media.getAttribute('src') ?? '',
    currentSrc: media.currentSrc,
    paused: media.paused,
    ended: media.ended,
    currentTime: media.currentTime,
    duration: Number.isFinite(media.duration) ? media.duration : null,
    readyState: media.readyState,
    networkState: media.networkState,
    preload: media.preload,
    muted: media.muted,
    volume: media.volume,
    error: mediaErrorDetails(media.error),
  }
}

const playbackUserActivationSnapshot = () => {
  if (typeof navigator === 'undefined' || !('userActivation' in navigator)) return undefined
  const activation = navigator.userActivation
  return {
    isActive: activation.isActive,
    hasBeenActive: activation.hasBeenActive,
  }
}

const safeStringify = (value: unknown) => {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
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

const cuePlaybackDuration = (cue: MediaCue) => {
  if (cue.options.duration && cue.options.duration > 0) return cue.options.duration
  const startAt = Math.max(0, cue.options.startAt ?? 0)
  const endAt = cue.options.endAt
  if (endAt && endAt > startAt) return endAt - startAt
  return undefined
}

const invokeNativeAudioCommand = async (command: string, args?: Record<string, unknown>) => {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke(command, args)
}

const readMediaAssetDataUrl = async (asset: MediaAsset) => {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<string>('read_media_asset_data_url', {
    targetPath: asset.path,
    sourcePath: asset.sourcePath,
  })
}

const playNativeAudioAsset = async (cue: MediaCue, sourcePath?: string) => {
  const duration = await invokeNativeAudioCommand('play_audio_asset', {
    targetPath: cue.src,
    sourcePath,
    volume: cueTargetVolume(cue),
    fadeIn: Math.max(0, cue.options.fadeIn ?? 0),
    fadeOut: Math.max(0, cue.options.fadeOut ?? 0),
    startAt: Math.max(0, cue.options.startAt ?? 0),
    duration: cuePlaybackDuration(cue),
    loopAudio: Boolean(cue.options.loop),
  })
  return typeof duration === 'number' && Number.isFinite(duration) && duration > 0 ? duration : undefined
}

const pauseNativeAudioAsset = async () => {
  await invokeNativeAudioCommand('pause_audio_asset')
}

const resumeNativeAudioAsset = async () => {
  await invokeNativeAudioCommand('resume_audio_asset')
}

const stopNativeAudioAsset = async () => {
  await invokeNativeAudioCommand('stop_audio_asset')
}

const nativePlaybackErrorMessage = (cue: MediaCue, error: unknown) => {
  const label = cue.title || cue.src
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  if (/dispositivo audio/i.test(message)) return `Dispositivo audio non disponibile: ${label}. ${message}`
  if (/non decodificabile|decode|codec|format/i.test(message)) {
    return `Cue non riproducibile: ${label}. Il file audio non viene decodificato dal player nativo.`
  }
  if (/non trovato|Nessuna cartella/i.test(message)) return `Cue senza file locale: ${label}. ${message}`
  return message.trim() ? `Cue non avviato: ${label}. ${message}` : `Cue non avviato: ${label}`
}

const isNativeProjectPathError = (error: unknown) => {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  return /Nessuna cartella progetto aperta/i.test(message)
}

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
  const steps = Math.max(4, Math.ceil(durationSeconds * 30))
  const intervalMs = Math.max(16, (durationSeconds * 1000) / steps)
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
  if (cue.options.loop) return
  const startAt = cue.options.startAt ?? 0
  const configuredEndAt = cue.options.endAt ?? (cue.options.duration ? startAt + cue.options.duration : undefined)
  const naturalEndAt = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : undefined
  const endAt = configuredEndAt === undefined
    ? naturalEndAt
    : naturalEndAt === undefined
      ? configuredEndAt
      : Math.min(configuredEndAt, naturalEndAt)
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

const scheduleMediaPauseMonitor = (
  media: HTMLMediaElement,
  timersRef: MutableRefObject<number[]>,
  onComplete: () => void,
) => {
  const startedAt = window.performance.now()
  const interval = window.setInterval(() => {
    const elapsedMs = window.performance.now() - startedAt
    const duration = Number.isFinite(media.duration) ? media.duration : undefined
    const nearNaturalEnd = Boolean(duration && media.currentTime >= duration - 0.08)
    if (media.ended || nearNaturalEnd || (elapsedMs > 500 && media.paused && !media.seeking)) {
      onComplete()
    }
  }, 250)
  timersRef.current.push(interval)
}

const scheduleNativeCueEnd = (
  cue: MediaCue,
  timersRef: MutableRefObject<number[]>,
  playbackDuration?: number,
  onComplete?: () => void,
) => {
  const duration = playbackDuration ?? cuePlaybackDuration(cue)
  if (!duration || cue.options.loop) return

  const timeout = window.setTimeout(() => {
    void stopNativeAudioAsset().finally(onComplete)
  }, duration * 1000)
  timersRef.current.push(timeout)
}

const stripMarkdownExtension = (name: string) => name.replace(/\.md$/i, '')

const buildPublishedScriptPayload = (
  project: Project,
  activeFile: ProjectTreeNode,
  markdown: string,
  characters: CharacterOption[],
): PublishedScriptPayload => {
  const characterMap = new Map<string, PublishedScriptCharacter>()
  for (const character of characters) {
    characterMap.set(character.id, { ...character, dialogues: [] })
  }

  const dialogues = parseScriptBlocks(markdown)
    .filter((block) => block.type === 'dialogue' && block.text?.trim())
    .map((block, index): PublishedScriptDialogue => {
      const fallbackCharacterName = characterNameFromDialogueText(block.text ?? '') || 'PERSONAGGIO'
      const characterId = block.characterId || slug(fallbackCharacterName)
      const existingCharacter = characterMap.get(characterId)
      const characterName = existingCharacter?.name ?? fallbackCharacterName
      if (!existingCharacter) {
        characterMap.set(characterId, { id: characterId, name: characterName, dialogues: [] })
      }
      return {
        id: block.id || `battuta-${index + 1}`,
        characterId,
        characterName,
        sceneId: block.sceneId,
        text: dialogueTextOnly(block.text ?? ''),
        sourceLine: block.sourceLine !== undefined ? block.sourceLine + 1 : undefined,
      }
    })

  for (const dialogue of dialogues) {
    characterMap.get(dialogue.characterId)?.dialogues.push(dialogue)
  }

  const notes = parsePublishedScriptNotes(markdown)

  return {
    schemaVersion: 1,
    app: 'StageDesk Pro',
    project: {
      id: project.id,
      name: project.name,
    },
    script: {
      path: activeFile.path,
      name: activeFile.name,
    },
    publishedAt: new Date().toISOString(),
    characters: [...characterMap.values()],
    dialogues,
    notes,
  }
}

const parsePublishedScriptNotes = (markdown: string): PublishedScriptNote[] => {
  const sharedNoteTypes = new Set<string>(SHARED_SCRIPT_NOTE_TYPES)
  const lines = markdown.split('\n')
  const notes: PublishedScriptNote[] = []
  let sceneId: string | undefined

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim()
    if (trimmed.startsWith('## ') || /^SCENA\b/i.test(trimmed)) {
      sceneId = slug(trimmed.replace(/^##\s*/, ''))
      continue
    }

    const directive = trimmed.match(/^::regia\{([^}]*)\}/)
    if (!directive) continue

    const attrs = directive[1]
    const type = readDirectiveAttr(attrs, 'type') || 'general'
    const contentLines: string[] = []
    const sourceLine = index + 1
    index += 1
    while (index < lines.length && lines[index].trim() !== '::') {
      contentLines.push(lines[index])
      index += 1
    }
    if (!sharedNoteTypes.has(type)) continue

    notes.push({
      id: readDirectiveAttr(attrs, 'id') || `nota-${sourceLine}`,
      type,
      title: readDirectiveAttr(attrs, 'title') || type,
      content: contentLines.join('\n').trim(),
      sceneId: readDirectiveAttr(attrs, 'sceneId') || sceneId,
      sourceLine,
    })
  }

  return notes
}

const dialogueTextOnly = (value: string) =>
  value
    .replace(/^\*\*([^*]+)\*\*:\s*/, '')
    .replace(/^\*\*([^*]+):\*\*\s*/, '')
    .trim()

const characterNameFromDialogueText = (value: string) =>
  value.match(/^\*\*([^*]+)\*\*:/)?.[1]?.trim()
  ?? value.match(/^\*\*([^*]+):\*\*/)?.[1]?.trim()
  ?? ''

const shareUrlForUid = (uid: string) => `${SHARE_URL_BASE}/${encodeURIComponent(uid)}`

const generateSharePin = () => String(Math.floor(Math.random() * 100000)).padStart(5, '0')

const publishErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  if (/function .*upsert_script_share.*does not exist|could not find the function/i.test(message)) {
    return 'Condivisione non configurata: esegui la migrazione docs/supabase-sharing.sql in Supabase.'
  }
  if (/row-level security|violates.*security policy/i.test(message)) {
    return 'Permessi condivisione mancanti: verifica le policy RLS e le funzioni della migrazione Supabase.'
  }
  return message
}

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))

type PdfBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'hr' }
  | { type: 'paragraph'; text: string }
  | { type: 'dialogue'; character: string; text: string }
  | { type: 'quote'; text: string }
  | { type: 'note'; title: string; content: string }
  | { type: 'cue'; title: string; content: string }
  | { type: 'table'; rows: string[][] }

type PdfInlineSegment = {
  text: string
  bold: boolean
}

const markdownToPdfBlocks = (markdown: string, mode: 'complete' | 'clean'): PdfBlock[] => {
  const source = mode === 'clean' ? cleanScriptMarkdown(markdown, { preserveNoteTypes: SHARED_SCRIPT_NOTE_TYPES }) : markdown
  const lines = source.split('\n')
  const blocks: PdfBlock[] = []
  const exportedNoteTypes = new Set<string>(SHARED_SCRIPT_NOTE_TYPES)

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const trimmed = line.trim()
    if (!trimmed) continue

    const dialogueDirective = trimmed.match(/^::battuta\{([^}]*)\}/)
    if (dialogueDirective) {
      const attrs = dialogueDirective[1]
      const contentLines: string[] = []
      index += 1
      while (index < lines.length && lines[index].trim() !== '::') {
        contentLines.push(lines[index])
        index += 1
      }
      blocks.push({
        type: 'dialogue',
        character: readDirectiveAttr(attrs, 'character') || readDirectiveAttr(attrs, 'characterId') || 'PERSONAGGIO',
        text: contentLines.join('\n').trim(),
      })
      continue
    }

    const editorDialogue = parsePdfEditorDialogue(trimmed)
    if (editorDialogue) {
      blocks.push(editorDialogue)
      continue
    }

    const plainDialogue = parsePdfPlainDialogue(trimmed)
    if (plainDialogue) {
      blocks.push(plainDialogue)
      continue
    }

    const richNote = trimmed.match(/^\[NOTA:\s*([^\]]+)\](?:\s+\{([^}]*)\})?$/)
    if (richNote) {
      const attrs = richNote[2] ?? ''
      const noteType = readDirectiveAttr(attrs, 'type') || 'general'
      if (mode === 'complete' || exportedNoteTypes.has(noteType)) {
        blocks.push({
          type: 'note',
          title: decodePdfAttr(richNote[1].trim()),
          content: decodePdfAttr(readDirectiveAttr(attrs, 'content') || ''),
        })
      }
      continue
    }

    const richCue = trimmed.match(/^\[CUE:?\s*([^\]]+)\](?:\s+\{([^}]*)\})?$/)
    if (richCue) {
      const attrs = richCue[2] ?? ''
      blocks.push({
        type: 'cue',
        title: decodePdfAttr(richCue[1].trim()),
        content: decodePdfAttr(readDirectiveAttr(attrs, 'content') || ''),
      })
      continue
    }

    const directive = trimmed.match(/^::(regia|media)\{([^}]*)\}/)
    if (directive) {
      const directiveType = directive[1]
      const attrs = directive[2]
      const noteType = readDirectiveAttr(attrs, 'type') || 'general'
      const contentLines: string[] = []
      index += 1
      while (index < lines.length && lines[index].trim() !== '::') {
        contentLines.push(lines[index])
        index += 1
      }
      if (mode === 'complete' || (directiveType === 'regia' && exportedNoteTypes.has(noteType))) {
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

    if (/^-{3,}$/.test(trimmed)) {
      blocks.push({ type: 'hr' })
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

const parsePdfEditorDialogue = (line: string): Extract<PdfBlock, { type: 'dialogue' }> | undefined => {
  const match = line.match(/^\[BATTUTA:\s*([^\]]+)\]\s*(?:\{([^}]*)\})?$/)
  if (!match) return undefined
  const attrs = match[2] ?? ''
  return {
    type: 'dialogue',
    character: match[1].trim(),
    text: decodePdfAttr(readDirectiveAttr(attrs, 'text') ?? ''),
  }
}

const parsePdfPlainDialogue = (line: string): Extract<PdfBlock, { type: 'dialogue' }> | undefined => {
  const match = line.match(/^\*\*([^*:\n]+)\*\*:\s+(.+)$/) ?? line.match(/^\*\*([^*:\n]+):\*\*\s+(.+)$/)
  if (!match) return undefined
  return {
    type: 'dialogue',
    character: match[1].trim(),
    text: match[2].trim(),
  }
}

const decodePdfAttr = (value: string) =>
  value.replace(/&#10;/g, '\n').replace(/&quot;/g, '"').replace(/&amp;/g, '&')

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

  const blocks = markdownToPdfBlocks(markdown, mode)
  diagnosticLog('pdf-export-blocks', {
    mode,
    total: blocks.length,
    cues: blocks.filter((block) => block.type === 'cue').length,
    notes: blocks.filter((block) => block.type === 'note').length,
    horizontalRules: blocks.filter((block) => block.type === 'hr').length,
  })

  for (const block of blocks) {
    if (block.type === 'heading') {
      const style = pdfHeadingStyle(block.level)
      y += style.before
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

    if (block.type === 'hr') {
      y = ensurePdfSpace(doc, y, pageBottom, marginTop, 18)
      doc.setDrawColor(148, 163, 184)
      doc.setLineWidth(0.8)
      doc.line(marginX, y + 5, marginX + maxWidth, y + 5)
      y += 18
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
      y = drawPdfCueBox(doc, block, marginX, y, maxWidth, pageBottom, marginTop)
      y += 6
      continue
    }

    if (block.type === 'quote') {
      y = drawPdfQuoteBox(doc, block.text, marginX, y, maxWidth, pageBottom, marginTop)
      y += 10
      continue
    }

    if (block.type === 'dialogue') {
      y = drawPdfDialogueBlock(doc, block, marginX, y, maxWidth, pageBottom, marginTop)
      y += 6
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
  if (level === 1) return { size: 20, lineHeight: 25, before: 18, after: 10, color: '#111111' }
  if (level === 2) return { size: 16, lineHeight: 21, before: 16, after: 8, color: '#1f2937' }
  if (level === 3) return { size: 13, lineHeight: 18, before: 12, after: 7, color: '#374151' }
  return { size: 11, lineHeight: 16, before: 8, after: 5, color: '#4b5563' }
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
  doc.setFillColor(233, 84, 32)
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

const drawPdfCueBox = (
  doc: JsPDF,
  block: Extract<PdfBlock, { type: 'cue' }>,
  x: number,
  y: number,
  width: number,
  pageBottom: number,
  marginTop: number,
) => {
  const padding = 9
  const titleHeight = 15
  const lines = doc.splitTextToSize(block.content || 'Cue multimediale', width - (padding * 2)) as string[]
  const boxHeight = padding + titleHeight + Math.max(lines.length, 1) * 14 + padding
  y = ensurePdfSpace(doc, y, pageBottom, marginTop, boxHeight)
  doc.setDrawColor(96, 165, 250)
  doc.setFillColor(239, 246, 255)
  doc.roundedRect(x, y, width, boxHeight, 4, 4, 'FD')
  doc.setFillColor(59, 130, 246)
  doc.rect(x, y, 4, boxHeight, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor('#1e3a8a')
  doc.text(`Cue: ${stripInlineMarkdown(block.title)}`, x + padding, y + padding + 9)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor('#1f2937')
  let textY = y + padding + titleHeight + 10
  for (const line of lines) {
    doc.text(line, x + padding, textY)
    textY += 14
  }
  return y + boxHeight
}

const drawPdfDialogueBlock = (
  doc: JsPDF,
  block: Extract<PdfBlock, { type: 'dialogue' }>,
  x: number,
  y: number,
  width: number,
  pageBottom: number,
  marginTop: number,
) => {
  const characterColumnWidth = Math.min(126, Math.max(92, width * 0.24))
  const gutter = 14
  const lineHeight = 15
  const textX = x + characterColumnWidth + gutter
  const textWidth = width - characterColumnWidth - gutter
  const character = stripInlineMarkdown(block.character).toUpperCase()
  const text = stripInlineMarkdown(block.text).replace(/\s+/g, ' ').trim()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.8)
  const textLines = doc.splitTextToSize(text || ' ', textWidth) as string[]
  const blockHeight = Math.max(18, Math.max(1, textLines.length) * lineHeight)
  y = ensurePdfSpace(doc, y, pageBottom, marginTop, blockHeight)

  doc.setDrawColor(233, 84, 32)
  doc.setLineWidth(1.4)
  doc.line(x, y - 2, x, y + blockHeight - 3)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.2)
  doc.setTextColor('#111827')
  doc.text(character, x + 8, y + 10, {
    maxWidth: characterColumnWidth - 8,
  })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.8)
  doc.setTextColor('#1f2937')
  let textY = y + 10
  for (const line of textLines) {
    doc.text(line, textX, textY)
    textY += lineHeight
  }

  return y + blockHeight
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
