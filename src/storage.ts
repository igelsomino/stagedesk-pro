import { defaultProject } from './defaultProject'
import { LEGACY_SCRIPT_ROOT_PATH, SCRIPT_ROOT_PATH } from './domain'
import type { MediaAsset, Project, ProjectTreeNode } from './domain'

type ProjectOpenResult = {
  project: Project
  path: string
}

export type ProjectEntry = {
  name: string
  path: string
  updatedAt?: string
}

export type ProjectStorage = {
  requiresDirectFolderPicker(): boolean
  load(): Project
  save(project: Project): void
  reset(): Project
  prepareProjectFolderCreation(): Promise<boolean>
  projectFolderPath(): Promise<string | undefined>
  listProjectFolders(): Promise<ProjectEntry[]>
  createProjectFolder(project: Project): Promise<string | undefined>
  openProjectFolder(path?: string): Promise<ProjectOpenResult | undefined>
  openLastProjectFolder(): Promise<ProjectOpenResult | undefined>
  renameProjectFolder(path: string, name: string): Promise<ProjectEntry>
  deleteProjectFolder(path: string): Promise<void>
  saveProjectFolder(project: Project): Promise<string | undefined>
  writeMediaAsset(targetPath: string, file: File): Promise<void>
  moveMediaAsset(sourcePath: string, targetPath: string): Promise<void>
  deleteMediaAsset(targetPath: string): Promise<void>
}

let browserProjectDirectory: FileSystemDirectoryHandle | undefined
let browserProjectParentDirectory: FileSystemDirectoryHandle | undefined
const localRecoveryProjectKey = 'stagedesk-pro.recovery-project'

export const browserProjectStorage: ProjectStorage = {
  requiresDirectFolderPicker() {
    return !isTauriRuntime() && !isLocalDevRuntime()
  },
  load() {
    return normalizeProject(loadLocalRecoveryProject() ?? defaultProject())
  },
  save(project) {
    saveLocalRecoveryProject(project)
  },
  reset() {
    clearLocalRecoveryProject()
    return defaultProject()
  },
  async prepareProjectFolderCreation() {
    if (isTauriRuntime() || isLocalDevRuntime()) return true

    const parent = await pickBrowserDirectory()
    if (!parent) return false
    browserProjectParentDirectory = parent
    return true
  },
  async projectFolderPath() {
    if (isTauriRuntime()) return invokeIfDesktop<string>('current_project_folder_path')
    if (isLocalDevRuntime()) return fetchProjectStorage<{ path?: string }>('/current').then((result) => result.path)
    return browserProjectDirectory?.name
  },
  async listProjectFolders() {
    if (isTauriRuntime()) return invokeIfDesktop<ProjectEntry[]>('list_project_folders').then((items) => items ?? [])
    if (isLocalDevRuntime()) return fetchProjectStorage<ProjectEntry[]>('/projects').then((items) => items ?? [])
    return []
  },
  async createProjectFolder(project) {
    if (isTauriRuntime()) {
      return invokeIfDesktop<string>('create_project_folder', {
        projectName: project.name,
        projectJson: JSON.stringify(project, null, 2),
      })
    }
    if (isLocalDevRuntime()) {
      return fetchProjectStorage<string>('/projects', {
        method: 'POST',
        body: {
          projectName: project.name,
          projectJson: JSON.stringify(project, null, 2),
        },
      })
    }

    const parent = browserProjectParentDirectory ?? await pickBrowserDirectory()
    browserProjectParentDirectory = undefined
    if (!parent) return undefined
    browserProjectDirectory = await parent.getDirectoryHandle(safeFolderName(project.name), { create: true })
    await writeBrowserProject(browserProjectDirectory, { ...project, rootPath: browserProjectDirectory.name })
    return browserProjectDirectory.name
  },
  async openProjectFolder(path) {
    if (isTauriRuntime()) {
      const result = await invokeIfDesktop<ProjectOpenResult>('open_project_folder', path ? { projectPath: path } : undefined)
      return normalizeProjectOpenResult(result)
    }
    if (isLocalDevRuntime()) {
      if (!path) return undefined
      return fetchProjectStorage<ProjectOpenResult>('/open', {
        method: 'POST',
        body: { projectPath: path },
      }).then(normalizeProjectOpenResult)
    }

    const directory = await pickBrowserDirectory()
    if (!directory) return undefined
    browserProjectDirectory = directory
    const project = await readBrowserProject(directory)
    return { project, path: directory.name }
  },
  async openLastProjectFolder() {
    if (isTauriRuntime()) {
      const result = await invokeIfDesktop<ProjectOpenResult | null>('open_last_project_folder')
      return normalizeProjectOpenResult(result ?? undefined)
    }
    if (isLocalDevRuntime()) {
      return fetchProjectStorage<ProjectOpenResult | undefined>('/open-last').then(normalizeProjectOpenResult)
    }

    return undefined
  },
  async renameProjectFolder(path, name) {
    if (isTauriRuntime()) {
      const renamed = await invokeIfDesktop<ProjectEntry>('rename_project_folder', { projectPath: path, projectName: name })
      if (!renamed) throw new Error('Rinomina progetto non disponibile')
      return renamed
    }
    if (isLocalDevRuntime()) {
      return fetchProjectStorage<ProjectEntry>('/rename-project', {
        method: 'POST',
        body: { projectPath: path, projectName: name },
      })
    }

    throw new Error('Rinomina progetto non disponibile nel picker browser')
  },
  async deleteProjectFolder(path) {
    if (isTauriRuntime()) {
      await invokeIfDesktop('delete_project_folder', { projectPath: path })
      return
    }
    if (isLocalDevRuntime()) {
      await fetchProjectStorage('/delete-project', {
        method: 'POST',
        body: { projectPath: path },
      })
      return
    }

    throw new Error('Eliminazione progetto non disponibile nel picker browser')
  },
  async saveProjectFolder(project) {
    if (isTauriRuntime()) {
      const currentPath = await invokeIfDesktop<string | null>('current_project_folder_path')
      if (!currentPath) return undefined
      return invokeIfDesktop<string>('save_project_folder', {
        projectJson: JSON.stringify(project, null, 2),
      })
    }
    if (isLocalDevRuntime()) {
      const current = await fetchProjectStorage<{ path?: string }>('/current')
      if (!current.path) return undefined
      return fetchProjectStorage<string>('/save', {
        method: 'POST',
        body: { projectJson: JSON.stringify(project, null, 2) },
      })
    }

    if (!browserProjectDirectory) return undefined
    await writeBrowserProject(browserProjectDirectory, { ...project, rootPath: browserProjectDirectory.name })
    return browserProjectDirectory.name
  },
  async writeMediaAsset(targetPath, file) {
    if (isTauriRuntime()) {
      await invokeIfDesktop('write_media_asset', {
        targetPath,
        dataBase64: await fileToBase64(file),
      })
      return
    }
    if (isLocalDevRuntime()) {
      await fetchProjectStorage('/write-media', {
        method: 'POST',
        body: {
          targetPath,
          dataBase64: await fileToBase64(file),
        },
      })
      return
    }

    if (!browserProjectDirectory) return
    await writeBrowserBinaryFile(browserProjectDirectory, pathParts(targetPath), file)
  },
  async moveMediaAsset(sourcePath, targetPath) {
    if (isTauriRuntime()) {
      await invokeIfDesktop('move_media_asset', { sourcePath, targetPath })
      return
    }
    if (isLocalDevRuntime()) {
      await fetchProjectStorage('/move-media', {
        method: 'POST',
        body: { sourcePath, targetPath },
      })
      return
    }

    if (!browserProjectDirectory) return
    await moveBrowserFile(browserProjectDirectory, pathParts(sourcePath), pathParts(targetPath))
  },
  async deleteMediaAsset(targetPath) {
    if (isTauriRuntime()) {
      await invokeIfDesktop('delete_media_asset', { targetPath })
      return
    }
    if (isLocalDevRuntime()) {
      await fetchProjectStorage('/delete-media', {
        method: 'POST',
        body: { targetPath },
      })
      return
    }

    if (!browserProjectDirectory) return
    await removeBrowserEntry(browserProjectDirectory, pathParts(targetPath))
  },
}

export const readBrowserMediaAssetObjectUrl = async (targetPath: string) => {
  if (isTauriRuntime() || isLocalDevRuntime() || !browserProjectDirectory) return undefined
  const file = await getBrowserFile(browserProjectDirectory, pathParts(targetPath))
  if (!file || file.size === 0) return undefined
  return URL.createObjectURL(file)
}

const pickBrowserDirectory = async () => {
  const picker = window.showDirectoryPicker
  if (!picker) return undefined
  try {
    return await picker({ mode: 'readwrite' })
  } catch (error) {
    if (isDirectoryPickerAbort(error)) return undefined
    throw error
  }
}

const isDirectoryPickerAbort = (error: unknown) =>
  error instanceof DOMException && (error.name === 'AbortError' || error.name === 'NotAllowedError')

const loadLocalRecoveryProject = (): Project | undefined => {
  if (typeof window === 'undefined') return undefined
  const rawProject = window.localStorage.getItem(localRecoveryProjectKey)
  if (!rawProject) return undefined

  try {
    const project = JSON.parse(rawProject) as Project
    return isStorageProject(project) ? project : undefined
  } catch {
    window.localStorage.removeItem(localRecoveryProjectKey)
    return undefined
  }
}

const normalizeProject = (project: Project): Project => ({
  ...project,
  ...normalizeLegacySampleProject(project),
})

const normalizeLegacySampleProject = (project: Project) => {
  const normalizedScripts = normalizeScriptTree(project.scripts)
  const root = normalizedScripts[0]
  const firstFile = root?.kind === 'folder' ? root.children?.[0] : undefined
  const isLegacySample =
    project.name === 'La locandiera' &&
    firstFile?.kind === 'markdown' &&
    firstFile.path === `${SCRIPT_ROOT_PATH}/atto-1.md` &&
    firstFile.content?.includes('AVVISO IMPORTANTE')
  const sampleFilePath = `${SCRIPT_ROOT_PATH}/atto-1.md`
  const renamedSampleFilePath = `${SCRIPT_ROOT_PATH}/la locandiera.md`
  const scripts = isLegacySample
    ? renameLegacySampleFile(normalizedScripts)
    : normalizedScripts
  const normalizeFilePath = (path: string) => {
    const normalizedPath = normalizeScriptPath(path)
    return isLegacySample && normalizedPath === sampleFilePath
      ? renamedSampleFilePath
      : normalizedPath
  }

  return {
    name: isLegacySample ? 'Goldoni' : project.name,
    scripts,
    notes: project.notes.map((note) => ({ ...note, filePath: normalizeFilePath(note.filePath) })),
    cues: project.cues.map((cue) => ({ ...cue, filePath: normalizeFilePath(cue.filePath) })),
  }
}

const normalizeProjectOpenResult = (result: ProjectOpenResult | undefined) =>
  result ? { ...result, project: normalizeProject(result.project) } : undefined

const normalizeScriptTree = (nodes: ProjectTreeNode[]): ProjectTreeNode[] =>
  nodes.map((node) => {
    const path = normalizeScriptPath(node.path)
    const name = path === SCRIPT_ROOT_PATH && node.kind === 'folder' ? 'copioni' : node.name
    if (node.kind === 'markdown') {
      const content = node.content ? removeCharacterTableIdColumn(node.content) : node.content
      return path === node.path && name === node.name && content === node.content
        ? node
        : { ...node, name, path, content }
    }

    return {
      ...node,
      name,
      path,
      children: node.children ? normalizeScriptTree(node.children) : undefined,
    }
  })

const normalizeScriptPath = (path: string) => {
  if (path === LEGACY_SCRIPT_ROOT_PATH) return SCRIPT_ROOT_PATH
  if (path.startsWith(`${LEGACY_SCRIPT_ROOT_PATH}/`)) {
    return `${SCRIPT_ROOT_PATH}${path.slice(LEGACY_SCRIPT_ROOT_PATH.length)}`
  }
  return path
}

const renameLegacySampleFile = (nodes: ProjectTreeNode[]) =>
  nodes.map((node) => {
    if (node.kind !== 'folder' || node.path !== SCRIPT_ROOT_PATH) return node
    return {
      ...node,
      children: node.children?.map((child) =>
        child.kind === 'markdown' && child.path === `${SCRIPT_ROOT_PATH}/atto-1.md`
          ? { ...child, name: 'la locandiera.md', path: `${SCRIPT_ROOT_PATH}/la locandiera.md` }
          : child,
      ),
    }
  })

const removeCharacterTableIdColumn = (content: string) => {
  const lines = content.split('\n')
  const normalizedLines: string[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const separatorLine = lines[index + 1] ?? ''
    const headerCells = splitMarkdownTableCells(line)

    if (!isLegacyCharacterTableHeader(headerCells) || !isMarkdownTableSeparator(separatorLine)) {
      normalizedLines.push(line)
      continue
    }

    normalizedLines.push(markdownTableRow(headerCells.slice(1)))
    normalizedLines.push(markdownTableRow(splitMarkdownTableCells(separatorLine).slice(1)))
    index += 1

    while (index + 1 < lines.length && isMarkdownTableRow(lines[index + 1])) {
      index += 1
      normalizedLines.push(markdownTableRow(splitMarkdownTableCells(lines[index]).slice(1)))
    }
  }

  return normalizedLines.join('\n')
}

const isLegacyCharacterTableHeader = (cells: string[]) =>
  normalizeTableCell(cells[0]) === 'id' && normalizeTableCell(cells[1]) === 'personaggio'

const isMarkdownTableRow = (line: string) =>
  /^\s*\|/.test(line) && splitMarkdownTableCells(line).length > 1

const isMarkdownTableSeparator = (line: string) =>
  isMarkdownTableRow(line) && splitMarkdownTableCells(line).every((cell) => /^:?-{3,}:?$/.test(cell.trim()))

const splitMarkdownTableCells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())

const markdownTableRow = (cells: string[]) => `| ${cells.join(' | ')} |`

const normalizeTableCell = (cell = '') =>
  cell
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()

const saveLocalRecoveryProject = (project: Project) => {
  if (typeof window === 'undefined') return
  if (!usesLocalRecovery(project)) {
    clearLocalRecoveryProject()
    return
  }

  try {
    window.localStorage.setItem(localRecoveryProjectKey, JSON.stringify(project))
  } catch {
    // The folder-backed save remains authoritative when browser storage is unavailable.
  }
}

const clearLocalRecoveryProject = () => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(localRecoveryProjectKey)
}

const usesLocalRecovery = (project: Project) => !hasPersistedProjectRoot(project.rootPath)

const hasPersistedProjectRoot = (rootPath: string) =>
  Boolean(rootPath && rootPath !== '/progetto' && rootPath !== 'progetto')

const isStorageProject = (value: unknown): value is Project => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<Project>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.rootPath === 'string' &&
    Array.isArray(candidate.scripts) &&
    Array.isArray(candidate.media) &&
    Array.isArray(candidate.notes) &&
    Array.isArray(candidate.cues) &&
    Array.isArray(candidate.noteTypes) &&
    Boolean(candidate.settings)
  )
}

const readBrowserProject = async (directory: FileSystemDirectoryHandle): Promise<Project> => {
  const projectFile = await directory.getFileHandle('project.json')
  const project = JSON.parse(await (await projectFile.getFile()).text()) as Project
  return {
    ...project,
    rootPath: directory.name,
    scripts: await hydrateBrowserScriptFiles(directory, project.scripts),
  }
}

const writeBrowserProject = async (directory: FileSystemDirectoryHandle, project: Project) => {
  await writeJsonFile(directory, 'project.json', project)
  await writeBrowserScriptTree(directory, project.scripts)
  await writeBrowserMediaTree(directory, project.media)
}

const writeJsonFile = async (directory: FileSystemDirectoryHandle, name: string, project: Project) => {
  const file = await directory.getFileHandle(name, { create: true })
  const writable = await file.createWritable()
  await writable.write(JSON.stringify(project, null, 2))
  await writable.close()
}

const hydrateBrowserScriptFiles = async (
  root: FileSystemDirectoryHandle,
  nodes: ProjectTreeNode[],
): Promise<ProjectTreeNode[]> =>
  Promise.all(
    nodes.map(async (node) => {
      if (node.kind === 'markdown') {
        const file = await getBrowserFile(root, pathParts(node.path))
        if (!file) return node
        return { ...node, content: await file.text() }
      }

      return {
        ...node,
        children: node.children ? await hydrateBrowserScriptFiles(root, node.children) : undefined,
      }
    }),
  )

const writeBrowserScriptTree = async (root: FileSystemDirectoryHandle, nodes: ProjectTreeNode[]) => {
  for (const node of nodes) {
    if (node.kind === 'folder') {
      await ensureBrowserDirectory(root, pathParts(node.path))
      if (node.children) await writeBrowserScriptTree(root, node.children)
      continue
    }

    await writeTextFile(root, pathParts(node.path), node.content ?? '')
  }
}

const writeBrowserMediaTree = async (root: FileSystemDirectoryHandle, assets: MediaAsset[]) => {
  for (const asset of assets) {
    if (asset.kind === 'folder') {
      await ensureBrowserDirectory(root, pathParts(asset.path))
      if (asset.children) await writeBrowserMediaTree(root, asset.children)
      continue
    }

    await ensureBrowserMediaFile(root, asset)
  }
}

const getBrowserFile = async (root: FileSystemDirectoryHandle, parts: string[]) => {
  try {
    const fileName = parts.at(-1)
    if (!fileName) return undefined
    const directory = await ensureBrowserDirectory(root, parts.slice(0, -1))
    return (await directory.getFileHandle(fileName)).getFile()
  } catch {
    return undefined
  }
}

const writeTextFile = async (root: FileSystemDirectoryHandle, parts: string[], content: string) => {
  const fileName = parts.at(-1)
  if (!fileName) return
  const directory = await ensureBrowserDirectory(root, parts.slice(0, -1))
  const file = await directory.getFileHandle(fileName, { create: true })
  const writable = await file.createWritable()
  await writable.write(content)
  await writable.close()
}

const writeBrowserBinaryFile = async (root: FileSystemDirectoryHandle, parts: string[], file: File) => {
  const fileName = parts.at(-1)
  if (!fileName) return
  const directory = await ensureBrowserDirectory(root, parts.slice(0, -1))
  const fileHandle = await directory.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(file)
  await writable.close()
}

const moveBrowserFile = async (root: FileSystemDirectoryHandle, sourceParts: string[], targetParts: string[]) => {
  const sourceName = sourceParts.at(-1)
  const targetName = targetParts.at(-1)
  if (!sourceName || !targetName) return

  const sourceDirectory = await ensureBrowserDirectory(root, sourceParts.slice(0, -1))
  const targetDirectory = await ensureBrowserDirectory(root, targetParts.slice(0, -1))
  const sourceFile = await sourceDirectory.getFileHandle(sourceName)
  const targetFile = await targetDirectory.getFileHandle(targetName, { create: true })
  const writable = await targetFile.createWritable()
  await writable.write(await sourceFile.getFile())
  await writable.close()
  await sourceDirectory.removeEntry(sourceName)
}

const removeBrowserEntry = async (root: FileSystemDirectoryHandle, parts: string[]) => {
  const entryName = parts.at(-1)
  if (!entryName) return
  const directory = await ensureBrowserDirectory(root, parts.slice(0, -1))
  await directory.removeEntry(entryName, { recursive: true })
}

const ensureBrowserMediaFile = async (root: FileSystemDirectoryHandle, asset: MediaAsset) => {
  const parts = pathParts(asset.path)
  const fileName = parts.at(-1)
  if (!fileName) return
  const directory = await ensureBrowserDirectory(root, parts.slice(0, -1))
  try {
    const fileHandle = await directory.getFileHandle(fileName)
    const file = await fileHandle.getFile()
    if (!asset.sourcePath || file.size > 0) return
    await writeBrowserMediaSource(fileHandle, asset.sourcePath)
  } catch {
    const file = await directory.getFileHandle(fileName, { create: true })
    if (asset.sourcePath) await writeBrowserMediaSource(file, asset.sourcePath)
    else await writeBrowserTextFile(file, '')
  }
}

const writeBrowserMediaSource = async (file: FileSystemFileHandle, sourcePath: string) => {
  const response = await fetch(sourcePath)
  if (!response.ok) throw new Error(`Media di esempio non disponibile: ${sourcePath}`)
  const writable = await file.createWritable()
  await writable.write(await response.blob())
  await writable.close()
}

const writeBrowserTextFile = async (file: FileSystemFileHandle, content: string) => {
  const writable = await file.createWritable()
  await writable.write(content)
  await writable.close()
}

const ensureBrowserDirectory = async (root: FileSystemDirectoryHandle, parts: string[]) => {
  let current = root
  for (const part of parts) current = await current.getDirectoryHandle(part, { create: true })
  return current
}

const pathParts = (path: string) => path.split('/').filter(Boolean)

const fileToBase64 = async (file: File) => {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return window.btoa(binary)
}

const safeFolderName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-|-$/g, '') || 'progetto'

const invokeIfDesktop = async <T>(command: string, args?: Record<string, unknown>) => {
  if (!isTauriRuntime()) return undefined
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}

const fetchProjectStorage = async <T>(path: string, options?: { method?: 'GET' | 'POST'; body?: Record<string, unknown> }) => {
  const response = await fetch(`/__project-storage${path}`, {
    method: options?.method ?? 'GET',
    headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error ?? 'Storage progetto non disponibile')
  return payload as T
}

const isTauriRuntime = () =>
  typeof window !== 'undefined' && Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)

const isLocalDevRuntime = () =>
  typeof window !== 'undefined' &&
  !isTauriRuntime() &&
  (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')

type FileSystemPermissionMode = 'read' | 'readwrite'

type FileSystemCreateWritableOptions = {
  keepExistingData?: boolean
}

type FileSystemWritableFileStream = WritableStream & {
  write: (data: string | Blob | BufferSource) => Promise<void>
  close: () => Promise<void>
}

type FileSystemFileHandle = {
  createWritable: (options?: FileSystemCreateWritableOptions) => Promise<FileSystemWritableFileStream>
  getFile: () => Promise<File>
}

type FileSystemDirectoryHandle = {
  name: string
  getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<FileSystemDirectoryHandle>
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<FileSystemFileHandle>
  removeEntry: (name: string, options?: { recursive?: boolean }) => Promise<void>
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { mode?: FileSystemPermissionMode }) => Promise<FileSystemDirectoryHandle>
  }
}
