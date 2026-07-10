import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
import fsNative from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'

type StoredProject = {
  name?: string
  rootPath?: string
  scripts?: ScriptNode[]
  media?: MediaNode[]
  [key: string]: unknown
}

type ScriptNode = {
  kind: 'folder' | 'markdown'
  path: string
  content?: string
  children?: ScriptNode[]
  [key: string]: unknown
}

type MediaNode = {
  kind: 'folder' | 'audio' | 'music' | 'image' | 'video'
  path: string
  sourcePath?: string
  children?: MediaNode[]
  [key: string]: unknown
}

let currentProjectPath: string | undefined

const projectsRoot = path.resolve(process.cwd(), 'projects')

const projectStorageApi = (): Plugin => ({
  name: 'project-storage-api',
  configureServer(server: ViteDevServer) {
    server.middlewares.use('/__project-storage', async (req: IncomingMessage, res: ServerResponse) => {
      try {
        const url = new URL(req.url ?? '/', 'http://localhost')

        if (req.method === 'GET' && url.pathname === '/current') {
          sendJson(res, { path: currentProjectPath })
          return
        }

        if (req.method === 'GET' && url.pathname === '/open-last') {
          if (!currentProjectPath) {
            sendJson(res, null)
            return
          }
          const project = await readProject(currentProjectPath)
          sendJson(res, { project, path: currentProjectPath })
          return
        }

        if (req.method === 'GET' && url.pathname === '/projects') {
          const entries = await listProjectFolders()
          sendJson(res, entries)
          return
        }

        if (req.method === 'GET' && url.pathname === '/media') {
          await sendMediaFile(req, res, String(url.searchParams.get('path') ?? ''))
          return
        }

        if (req.method === 'POST' && url.pathname === '/projects') {
          const body = await readJsonBody(req)
          const project = JSON.parse(String(body.projectJson)) as StoredProject
          const projectPath = path.join(projectsRoot, safeFolderName(String(body.projectName ?? project.name)))
          await writeProject(projectPath, project)
          currentProjectPath = projectPath
          sendJson(res, projectPath)
          return
        }

        if (req.method === 'POST' && url.pathname === '/open') {
          const body = await readJsonBody(req)
          const projectPath = resolveProjectPath(String(body.projectPath ?? ''))
          const project = await readProject(projectPath)
          currentProjectPath = projectPath
          sendJson(res, { project, path: projectPath })
          return
        }

        if (req.method === 'POST' && url.pathname === '/save') {
          const body = await readJsonBody(req)
          if (!currentProjectPath) throw new Error('Nessuna cartella progetto aperta')
          const project = JSON.parse(String(body.projectJson)) as StoredProject
          await writeProject(currentProjectPath, project)
          sendJson(res, currentProjectPath)
          return
        }

        if (req.method === 'POST' && url.pathname === '/move-media') {
          const body = await readJsonBody(req)
          if (!currentProjectPath) throw new Error('Nessuna cartella progetto aperta')
          await moveProjectMediaFile(
            currentProjectPath,
            String(body.sourcePath ?? ''),
            String(body.targetPath ?? ''),
          )
          sendJson(res, { ok: true })
          return
        }

        if (req.method === 'POST' && url.pathname === '/write-media') {
          const body = await readJsonBody(req)
          if (!currentProjectPath) throw new Error('Nessuna cartella progetto aperta')
          await writeProjectMediaFile(
            currentProjectPath,
            String(body.targetPath ?? ''),
            String(body.dataBase64 ?? ''),
          )
          sendJson(res, { ok: true })
          return
        }

        if (req.method === 'POST' && url.pathname === '/delete-media') {
          const body = await readJsonBody(req)
          if (!currentProjectPath) throw new Error('Nessuna cartella progetto aperta')
          await deleteProjectMediaFile(currentProjectPath, String(body.targetPath ?? ''))
          sendJson(res, { ok: true })
          return
        }

        res.statusCode = 404
        res.end('Not found')
      } catch (error) {
        res.statusCode = 500
        sendJson(res, { error: error instanceof Error ? error.message : String(error) })
      }
    })
  },
})

const sendJson = (res: ServerResponse, payload: unknown) => {
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

const sendMediaFile = async (req: IncomingMessage, res: ServerResponse, mediaPath: string) => {
  if (!currentProjectPath) throw new Error('Nessuna cartella progetto aperta')
  const filePath = safeNodePath(currentProjectPath, mediaPath)
  const stat = await fs.stat(filePath)
  const contentType = mediaContentType(filePath)
  const range = req.headers.range

  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Content-Type', contentType)

  if (range) {
    const match = range.match(/bytes=(\d+)-(\d*)/)
    const start = match ? Number(match[1]) : 0
    const end = match?.[2] ? Number(match[2]) : stat.size - 1
    const safeEnd = Math.min(end, stat.size - 1)
    res.statusCode = 206
    res.setHeader('Content-Range', `bytes ${start}-${safeEnd}/${stat.size}`)
    res.setHeader('Content-Length', String(safeEnd - start + 1))
    fsNative.createReadStream(filePath, { start, end: safeEnd }).pipe(res)
    return
  }

  res.setHeader('Content-Length', String(stat.size))
  fsNative.createReadStream(filePath).pipe(res)
}

const mediaContentType = (filePath: string) => {
  const extension = path.extname(filePath).toLowerCase()
  if (extension === '.png') return 'image/png'
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.webp') return 'image/webp'
  if (extension === '.gif') return 'image/gif'
  if (extension === '.avif') return 'image/avif'
  if (extension === '.mp4' || extension === '.m4v') return 'video/mp4'
  if (extension === '.mov') return 'video/quicktime'
  if (extension === '.webm') return 'video/webm'
  if (extension === '.mp3') return 'audio/mpeg'
  if (extension === '.wav') return 'audio/wav'
  if (extension === '.ogg') return 'audio/ogg'
  return 'application/octet-stream'
}

const readJsonBody = async (req: IncomingMessage): Promise<Record<string, unknown>> => {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

const listProjectFolders = async () => {
  await fs.mkdir(projectsRoot, { recursive: true })
  const entries = await fs.readdir(projectsRoot, { withFileTypes: true })
  const folders = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const folderPath = path.join(projectsRoot, entry.name)
        const stat = await fs.stat(folderPath)
        return { name: entry.name, path: folderPath, updatedAt: stat.mtime.toISOString() }
      }),
  )
  return folders.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

const resolveProjectPath = (projectPath: string) => {
  const resolved = path.resolve(projectPath)
  const rootWithSeparator = `${projectsRoot}${path.sep}`
  if (resolved !== projectsRoot && !resolved.startsWith(rootWithSeparator)) {
    throw new Error('Percorso progetto non valido')
  }
  return resolved
}

const readProject = async (projectPath: string): Promise<StoredProject> => {
  const projectJson = await fs.readFile(path.join(projectPath, 'project.json'), 'utf8')
  const project = JSON.parse(projectJson) as StoredProject
  return {
    ...project,
    rootPath: projectPath,
    scripts: await hydrateScriptFiles(projectPath, project.scripts ?? []),
  }
}

const writeProject = async (projectPath: string, project: StoredProject) => {
  const projectWithPath = { ...project, rootPath: projectPath }
  await fs.mkdir(projectPath, { recursive: true })
  await fs.writeFile(path.join(projectPath, 'project.json'), JSON.stringify(projectWithPath, null, 2))
  await writeScriptTree(projectPath, projectWithPath.scripts ?? [])
  await writeMediaTree(projectPath, projectWithPath.media ?? [])
}

const hydrateScriptFiles = async (root: string, nodes: ScriptNode[]): Promise<ScriptNode[]> =>
  Promise.all(
    nodes.map(async (node) => {
      if (node.kind === 'markdown') {
        try {
          return { ...node, content: await fs.readFile(safeNodePath(root, node.path), 'utf8') }
        } catch {
          return node
        }
      }

      return { ...node, children: await hydrateScriptFiles(root, node.children ?? []) }
    }),
  )

const writeScriptTree = async (root: string, nodes: ScriptNode[]) => {
  for (const node of nodes) {
    if (node.kind === 'folder') {
      await fs.mkdir(safeNodePath(root, node.path), { recursive: true })
      await writeScriptTree(root, node.children ?? [])
      continue
    }

    const filePath = safeNodePath(root, node.path)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, node.content ?? '')
  }
}

const writeMediaTree = async (root: string, assets: MediaNode[]) => {
  for (const asset of assets) {
    const assetPath = safeNodePath(root, asset.path)
    if (asset.kind === 'folder') {
      await fs.mkdir(assetPath, { recursive: true })
      await writeMediaTree(root, asset.children ?? [])
      continue
    }

    await fs.mkdir(path.dirname(assetPath), { recursive: true })
    try {
      const stat = await fs.stat(assetPath)
      if (asset.sourcePath && stat.size === 0) {
        await fs.copyFile(publicSourcePath(asset.sourcePath), assetPath)
      }
    } catch {
      if (asset.sourcePath) {
        await fs.copyFile(publicSourcePath(asset.sourcePath), assetPath)
      } else {
        await fs.writeFile(assetPath, '')
      }
    }
  }
}

const publicSourcePath = (sourcePath: string) => {
  const relativePath = sourcePath.replace(/^\/+/, '')
  const resolved = path.resolve(process.cwd(), 'public', relativePath)
  const publicRoot = path.resolve(process.cwd(), 'public')
  if (resolved !== publicRoot && !resolved.startsWith(`${publicRoot}${path.sep}`)) {
    throw new Error('Percorso media di esempio non valido')
  }
  return resolved
}

const moveProjectMediaFile = async (root: string, sourcePath: string, targetPath: string) => {
  const sourceFile = safeNodePath(root, sourcePath)
  const targetFile = safeNodePath(root, targetPath)
  await fs.mkdir(path.dirname(targetFile), { recursive: true })
  try {
    await fs.rename(sourceFile, targetFile)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') throw error
  }
}

const writeProjectMediaFile = async (root: string, targetPath: string, dataBase64: string) => {
  const targetFile = safeNodePath(root, targetPath)
  await fs.mkdir(path.dirname(targetFile), { recursive: true })
  await fs.writeFile(targetFile, Buffer.from(dataBase64, 'base64'))
}

const deleteProjectMediaFile = async (root: string, targetPath: string) => {
  const target = safeNodePath(root, targetPath)
  await fs.rm(target, { recursive: true, force: true })
}

const safeNodePath = (root: string, nodePath: string) => {
  const resolved = path.resolve(root, nodePath.replace(/^\/+/, ''))
  const rootWithSeparator = `${path.resolve(root)}${path.sep}`
  if (resolved !== path.resolve(root) && !resolved.startsWith(rootWithSeparator)) {
    throw new Error('Percorso file non valido')
  }
  return resolved
}

const safeFolderName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-|-$/g, '') || 'progetto'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), projectStorageApi()],
  server: {
    port: 1420,
    strictPort: true,
  },
})
