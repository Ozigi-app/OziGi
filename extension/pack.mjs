// Packages the extension for the Chrome Web Store.
//
// Ships only what the extension needs at runtime — the README and this script
// would otherwise end up inside the uploaded zip, and reviewers read whatever is
// in the package. Verifies the manifest before writing anything, because a
// rejected upload costs a review cycle, not a retry.

import { createWriteStream } from 'node:fs'
import { readFile, readdir, mkdir, stat } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const run = promisify(execFile)
const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'dist')

const RUNTIME_FILES = ['manifest.json', 'background.js', 'content.js', 'popup.html', 'popup.js']
const RUNTIME_DIRS = ['icons']

async function collect(dir, base = dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...await collect(full, base))
    else out.push(relative(base, full))
  }
  return out
}

const manifest = JSON.parse(await readFile(join(here, 'manifest.json'), 'utf8'))
const problems = []

if (!manifest.version) problems.push('manifest has no version')
if (!manifest.icons?.['128']) problems.push('manifest has no 128px icon — the store requires one')
if ((manifest.description ?? '').length > 132) problems.push('description exceeds the 132-char store limit')
// Local host permissions read as sloppy to a reviewer and aren't needed: the
// API returns permissive CORS headers, so dev against localhost works anyway.
const localhost = (manifest.host_permissions ?? []).filter((h) => /localhost|127\.0\.0\.1/.test(h))
if (localhost.length) problems.push(`remove localhost host_permissions before publishing: ${localhost.join(', ')}`)

for (const f of RUNTIME_FILES) {
  try { await stat(join(here, f)) } catch { problems.push(`missing runtime file: ${f}`) }
}

if (problems.length) {
  console.error('Cannot package:\n' + problems.map((p) => `  - ${p}`).join('\n'))
  process.exit(1)
}

await mkdir(outDir, { recursive: true })
const zipPath = join(outDir, `ozigi-linkedin-v${manifest.version}.zip`)

const files = [...RUNTIME_FILES]
for (const d of RUNTIME_DIRS) {
  for (const f of await collect(join(here, d))) files.push(join(d, f).replace(/\\/g, '/'))
}

// PowerShell's Compress-Archive is always present on Windows; zip(1) elsewhere.
if (process.platform === 'win32') {
  // Compress-Archive FLATTENS a file list — icons/icon16.png would land at the
  // zip root and every manifest icon path would 404 in a packaged install, with
  // nothing to show for it but a rejected upload. Stage the real tree and zip
  // that instead.
  // NOT Compress-Archive: Windows PowerShell writes entry names with
  // backslashes ("icons\icon16.png"), which the ZIP spec forbids and Chrome does
  // not resolve — every manifest icon path would silently 404 in a packaged
  // install. Creating entries by hand is the only way to guarantee the
  // separator.
  const entries = files
    .map((f) => `[IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, '${join(here, f)}', '${f.replace(/\\/g, '/')}') | Out-Null`)
    .join('; ')
  await run('powershell', ['-NoProfile', '-Command', [
    `Add-Type -AssemblyName System.IO.Compression.FileSystem`,
    `if (Test-Path '${zipPath}') { Remove-Item -Force '${zipPath}' }`,
    `$zip = [IO.Compression.ZipFile]::Open('${zipPath}', 'Create')`,
    entries,
    `$zip.Dispose()`,
  ].join('; ')])
} else {
  await run('zip', ['-r', zipPath, ...files], { cwd: here })
}

// Prove the tree survived. A flattened zip installs as a broken extension and
// the only symptom is a rejected submission days later.
const { stdout: listing } = process.platform === 'win32'
  ? await run('powershell', ['-NoProfile', '-Command',
      `Add-Type -A System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::OpenRead('${zipPath}').Entries | ForEach-Object { $_.FullName }`])
  : await run('unzip', ['-Z1', zipPath])

const packed = listing.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
const missing = files.filter((f) => !packed.includes(f))
if (missing.length) {
  console.error(`Zip is missing or misplaced: ${missing.join(', ')}`)
  process.exit(1)
}

console.log(`Packaged ${files.length} files → ${relative(process.cwd(), zipPath)}`)
console.log('Load the unpacked contents once and send a real request before uploading.')
