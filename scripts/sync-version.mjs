import { readFile, writeFile } from 'node:fs/promises'

const versionArg = process.argv.find((arg) => arg.startsWith('--set='))?.slice('--set='.length)

const packageJsonPath = 'package.json'
const packageLockPath = 'package-lock.json'
const cargoTomlPath = 'src-tauri/Cargo.toml'
const tauriConfigPath = 'src-tauri/tauri.conf.json'

const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'))
const version = versionArg ?? packageJson.version

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Versione non valida: ${version}`)
}

packageJson.version = version
await writeJson(packageJsonPath, packageJson)

const packageLock = JSON.parse(await readFile(packageLockPath, 'utf8'))
packageLock.version = version
if (packageLock.packages?.['']) packageLock.packages[''].version = version
await writeJson(packageLockPath, packageLock)

const cargoToml = await readFile(cargoTomlPath, 'utf8')
await writeFile(cargoTomlPath, cargoToml.replace(/^version = ".*"$/m, `version = "${version}"`))

const tauriConfig = JSON.parse(await readFile(tauriConfigPath, 'utf8'))
tauriConfig.version = version
await writeJson(tauriConfigPath, tauriConfig)

console.log(`Versione sincronizzata: ${version}`)

async function writeJson(path, data) {
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`)
}
