import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const [latestJsonPath = 'latest.json', signaturesDir = '.'] = process.argv.slice(2)
const latest = JSON.parse(await readFile(latestJsonPath, 'utf8'))
const version = latest.version
const repository = process.env.GITHUB_REPOSITORY ?? 'igelsomino/stagedesk-pro'
const releaseBaseUrl = `https://github.com/${repository}/releases/download/v${version}`
const platforms = latest.platforms ?? {}

const signatureFor = async (assetName) => {
  try {
    return (await readFile(path.join(signaturesDir, `${assetName}.sig`), 'utf8')).trim()
  } catch {
    return undefined
  }
}

const setPlatform = async (keys, assetName) => {
  const signature = await signatureFor(assetName)
  if (!signature) return
  for (const key of keys) {
    platforms[key] = {
      signature,
      url: `${releaseBaseUrl}/${assetName}`,
    }
  }
}

await setPlatform(
  ['darwin-aarch64', 'macos-aarch64'],
  `StageDesk.Pro_${version}_aarch64.app.tar.gz`,
)
await setPlatform(
  ['darwin-x86_64', 'macos-x86_64'],
  `StageDesk.Pro_${version}_x64.app.tar.gz`,
)
await setPlatform(
  ['linux-x86_64', 'linux-x86_64-appimage'],
  `StageDesk.Pro_${version}_amd64.AppImage`,
)
await setPlatform(['linux-x86_64-deb'], `StageDesk.Pro_${version}_amd64.deb`)
await setPlatform(['linux-x86_64-rpm'], `StageDesk.Pro-${version}-1.x86_64.rpm`)
await setPlatform(
  ['windows-x86_64', 'windows-x86_64-msi'],
  `StageDesk.Pro_${version}_x64_en-US.msi`,
)
await setPlatform(['windows-x86_64-nsis'], `StageDesk.Pro_${version}_x64-setup.exe`)

latest.platforms = Object.fromEntries(Object.entries(platforms).sort(([left], [right]) => left.localeCompare(right)))
await writeFile(latestJsonPath, `${JSON.stringify(latest, null, 2)}\n`)

console.log(Object.keys(latest.platforms).join('\n'))
