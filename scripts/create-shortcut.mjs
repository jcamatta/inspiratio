// Creates an "Inspiratio" desktop icon that runs scripts/launch.mjs: a .lnk on Windows, an .app on
// macOS (in ~/Applications with a Desktop link) and a .desktop entry on Linux.
import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const NAME = 'Inspiratio'
const PNG_ICON = join(ROOT, 'scripts', 'inspiratio.png')

const windows = () => {
  const target = join(ROOT, 'scripts', 'launch.cmd')
  const icon = join(ROOT, 'scripts', 'inspiratio.ico')
  // WindowStyle 7 = minimized: the build output stays in the taskbar instead of on screen.
  const script = `
$shell = New-Object -ComObject WScript.Shell
$folders = @([Environment]::GetFolderPath('Desktop'), (Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs'))
foreach ($folder in $folders) {
  $link = $shell.CreateShortcut((Join-Path $folder '${NAME}.lnk'))
  $link.TargetPath = '${target}'
  $link.WorkingDirectory = '${ROOT}'
  $link.IconLocation = '${icon}'
  $link.WindowStyle = 7
  $link.Description = 'Inspiratio reference canvas'
  $link.Save()
  Write-Output "Created $(Join-Path $folder '${NAME}.lnk')"
}`
  const result = spawnSync('powershell', ['-NoProfile', '-Command', script], { stdio: 'inherit' })
  if (result.status !== 0) throw new Error('Could not create the Windows shortcut')
}

const macIcon = ({ resources }) => {
  const iconset = join(mkdtempSync(join(tmpdir(), 'inspiratio-')), 'inspiratio.iconset')
  mkdirSync(iconset)
  for (const size of [16, 32, 128, 256]) {
    for (const [scale, suffix] of [
      [1, ''],
      [2, '@2x'],
    ]) {
      const pixels = Math.min(size * scale, 256)
      const out = join(iconset, `icon_${size}x${size}${suffix}.png`)
      spawnSync('sips', ['-z', String(pixels), String(pixels), PNG_ICON, '--out', out], {
        stdio: 'ignore',
      })
    }
  }
  const icns = join(resources, 'inspiratio.icns')
  const ok =
    spawnSync('iconutil', ['-c', 'icns', iconset, '-o', icns], { stdio: 'ignore' }).status === 0
  rmSync(dirname(iconset), { recursive: true, force: true })
  if (!ok) console.log('Could not build the app icon, the shortcut will use the default icon')
}

const mac = () => {
  const app = join(homedir(), 'Applications', `${NAME}.app`)
  const contents = join(app, 'Contents')
  const macos = join(contents, 'MacOS')
  const resources = join(contents, 'Resources')
  rmSync(app, { recursive: true, force: true })
  mkdirSync(macos, { recursive: true })
  mkdirSync(resources, { recursive: true })

  writeFileSync(
    join(contents, 'Info.plist'),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>${NAME}</string>
  <key>CFBundleDisplayName</key><string>${NAME}</string>
  <key>CFBundleIdentifier</key><string>local.inspiratio.launcher</string>
  <key>CFBundleExecutable</key><string>${NAME}</string>
  <key>CFBundleIconFile</key><string>inspiratio</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSUIElement</key><true/>
</dict>
</plist>
`,
  )

  // Apps opened from Finder get a minimal PATH, so the node used now (and its npm) is baked in.
  const executable = join(macos, NAME)
  const log = join(ROOT, 'data', 'logs', 'launch.log')
  writeFileSync(
    executable,
    `#!/bin/bash
export PATH="${dirname(process.execPath)}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
cd "${ROOT}" || exit 1
mkdir -p "$(dirname "${log}")"
osascript -e 'display notification "Updating and starting…" with title "${NAME}"'
if ! "${process.execPath}" scripts/launch.mjs >> "${log}" 2>&1; then
  osascript -e 'display alert "${NAME} could not start" message "See ${log}"'
fi
`,
  )
  chmodSync(executable, 0o755)
  macIcon({ resources })

  const desktopLink = join(homedir(), 'Desktop', NAME)
  rmSync(desktopLink, { force: true })
  rmSync(`${desktopLink}.app`, { force: true })
  symlinkSync(app, `${desktopLink}.app`)
  spawnSync('touch', [app])
  console.log(`Created ${app}\nCreated ${desktopLink}.app`)
}

const linux = () => {
  const entry = `[Desktop Entry]
Type=Application
Name=${NAME}
Comment=Inspiratio reference canvas
Exec="${process.execPath}" "${join(ROOT, 'scripts', 'launch.mjs')}"
Path=${ROOT}
Icon=${PNG_ICON}
Terminal=false
Categories=Graphics;
`
  const applications = join(homedir(), '.local', 'share', 'applications')
  const desktop = join(homedir(), 'Desktop')
  for (const folder of [applications, desktop].filter(
    (path) => path === applications || existsSync(path),
  )) {
    mkdirSync(folder, { recursive: true })
    const file = join(folder, 'inspiratio.desktop')
    writeFileSync(file, entry)
    chmodSync(file, 0o755)
    spawnSync('gio', ['set', file, 'metadata::trusted', 'true'], { stdio: 'ignore' })
    console.log(`Created ${file}`)
  }
}

try {
  if (process.platform === 'win32') windows()
  else if (process.platform === 'darwin') mac()
  else linux()
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
