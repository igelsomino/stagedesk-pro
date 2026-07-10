export type NodeKind = 'folder' | 'markdown'

export type ProjectTreeNode = {
  id: string
  name: string
  path: string
  kind: NodeKind
  children?: ProjectTreeNode[]
  content?: string
  dirty?: boolean
}

export type MediaKind = 'audio' | 'music' | 'image' | 'video' | 'folder'

export type MediaAsset = {
  id: string
  name: string
  path: string
  kind: MediaKind
  size?: number
  objectUrl?: string
  sourcePath?: string
  children?: MediaAsset[]
}

export type Project = {
  id: string
  name: string
  rootPath: string
  author?: string
  language?: string
  actorsCount?: number
  estimatedDuration?: string
  characters: Character[]
  noteTypes: NoteType[]
  settings: ProjectSettings
  scripts: ProjectTreeNode[]
  media: MediaAsset[]
  notes: DirectorNote[]
  cues: MediaCue[]
  lastFullscreenBlockId?: string
}

export type Character = {
  id: string
  name: string
  description?: string
}

export type NoteType = {
  id: string
  label: string
  color: string
}

export type DirectorNote = {
  id: string
  type: string
  color: string
  title?: string
  content: string
  collapsed?: boolean
  filePath: string
  anchorId: string
  sceneId?: string
  createdAt: string
  updatedAt: string
}

export type MediaCue = {
  id: string
  type: 'audio' | 'music' | 'image' | 'video'
  src: string
  title?: string
  description?: string
  autoplay: boolean
  repeatable?: boolean
  anchorId: string
  filePath: string
  sceneId?: string
  options: MediaCueOptions
  createdAt: string
  updatedAt: string
}

export type MediaCueOptions = {
  volume?: number
  fadeIn?: number
  fadeOut?: number
  loop?: boolean
  startAt?: number
  endAt?: number
  duration?: number
  stopPrevious?: boolean
  displayMode?: 'inline' | 'overlay' | 'fullscreen' | 'external'
}

export type ScriptBlock = {
  id: string
  type:
    | 'title'
    | 'scene'
    | 'character'
    | 'dialogue'
    | 'stageDirection'
    | 'note'
    | 'media'
    | 'section'
    | 'table'
    | 'quote'
  text?: string
  characterId?: string
  noteId?: string
  cueId?: string
  sceneId?: string
  headingLevel?: number
  tableRows?: { cells: string[]; header?: boolean }[]
  position: number
}

export type FullscreenState = {
  currentBlockId: string
  currentSceneId?: string
  executedCueIds: string[]
}

export type ProjectSettings = {
  theme: 'light' | 'dark'
  autosave: boolean
  fullscreenCueReplayPolicy: 'always' | 'forward-only' | 'ask' | 'repeatable-only'
}

export type NotePanelMode = 'context' | 'scene' | 'all'
