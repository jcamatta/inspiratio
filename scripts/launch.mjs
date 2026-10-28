// Cross-platform launcher used by the desktop shortcut: update, install, build, (re)start the server
// in the background and open the app window. `node scripts/launch.mjs --stop` stops the server.
import { spawn, spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = process.env.INSPIRATIO_PORT ?? '4319'
const URL = `http://127.0.0.1:${PORT}`
const DATA_DIR = resolve(ROOT, process.env.INSPIRATIO_DATA_DIR ?? 'data')
const PID_FILE = join(DATA_DIR, 'server.pid')
const SERVER_LOG = join(DATA_DIR, 'logs', 'server.log')
const IS_WINDOWS = process.platform === 'win32'

const run = ({ command, args, allowFailure = false }) => {
  // npm is a .cmd script on Windows, which only runs through a shell; the args here are fixed literals.
  const result = IS_WINDOWS
    ? spawnSync([command, ...args].join(' '), { cwd: ROOT, stdio: 'inherit', shell: true })
    : spawnSync(command, args, { cwd: ROOT, stdio: 'inherit' })
  if (result.status !== 0 && !allowFailure) throw new Error(`${command} ${args.join(' ')} failed`)
  return result.status === 0
}

const commandExists = (command) =>
  spawnSync(IS_WINDOWS ? 'where' : 'which', [command], { stdio: 'ignore' }).status === 0

const isUp = () =>
  fetch(`${URL}/api/board`, { signal: AbortSignal.timeout(2000) }).then(
    (response) => response.ok,
    () => false,
  )

const hasActiveGeneration = () =>
  fetch(`${URL}/api/generations`, { signal: AbortSignal.timeout(2000) })
    .then((response) => response.text())
    .then(
      (body) => body.includes('"status":"pending"') || body.includes('"status":"in_progress"'),
      () => false,
    )

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

const update = () => {
  if (!existsSync(join(ROOT, '.git')) || !commandExists('git')) return
  if (!run({ command: 'git', args: ['pull', '--ff-only', '--quiet'], allowFailure: true }))
    console.log('Could not update from GitHub, starting the local version')
}

const install = () => {
  const installed = join(ROOT, 'node_modules', '.package-lock.json')
  const lock = join(ROOT, 'package-lock.json')
  if (!existsSync(installed) || statSync(lock).mtimeMs > statSync(installed).mtimeMs)
    run({ command: 'npm', args: ['install'] })
}

const pidsOnPort = () => {
  if (IS_WINDOWS) {
    const out = spawnSync('netstat', ['-ano'], { encoding: 'utf8' }).stdout ?? ''
    return out
      .split(/\r?\n/)
      .filter((line) => line.includes('LISTENING') && line.includes(`:${PORT} `))
      .map((line) => line.trim().split(/\s+/).at(-1))
  }
  const out = spawnSync('lsof', ['-ti', `tcp:${PORT}`, '-sTCP:LISTEN'], { encoding: 'utf8' })
  return (out.stdout ?? '').split(/\s+/).filter(Boolean)
}

const kill = (pid) => {
  if (IS_WINDOWS) spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
  else
    for (const target of [-Number(pid), Number(pid)])
      try {
        process.kill(target, 'SIGTERM')
      } catch {
        // already gone
      }
}

const stopServer = async () => {
  if (existsSync(PID_FILE)) kill(readFileSync(PID_FILE, 'utf8').trim())
  for (const pid of pidsOnPort()) kill(pid)
  rmSync(PID_FILE, { force: true })
  for (let i = 0; i < 20 && (await isUp()); i++) await sleep(250)
}

const startServer = async () => {
  mkdirSync(dirname(SERVER_LOG), { recursive: true })
  const log = openSync(SERVER_LOG, 'a')
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
    cwd: join(ROOT, 'apps', 'server'),
    detached: true,
    stdio: ['ignore', log, log],
    windowsHide: true,
  })
  writeFileSync(PID_FILE, String(child.pid))
  child.unref()
  for (let i = 0; i < 120; i++) {
    if (await isUp()) return
    await sleep(1000)
  }
  throw new Error(`Inspiratio server did not start, see ${SERVER_LOG}`)
}

const detached = ({ command, args }) =>
  spawn(command, args, { detached: true, stdio: 'ignore' })
    .on('error', (error) => console.error(error.message))
    .unref()

const WINDOWS_BROWSERS = [
  join(process.env['ProgramFiles(x86)'] ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  join(process.env.ProgramFiles ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  join(process.env.ProgramFiles ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  join(process.env.LOCALAPPDATA ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
]
const MAC_BROWSERS = ['Google Chrome', 'Microsoft Edge', 'Brave Browser', 'Chromium']
const LINUX_BROWSERS = ['google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge']

/** Opens a chromeless app window when a Chromium browser is installed, else the default browser. */
const openApp = () => {
  const app = `--app=${URL}`
  if (IS_WINDOWS) {
    const browser = WINDOWS_BROWSERS.find((path) => existsSync(path))
    if (browser) detached({ command: browser, args: [app] })
    else detached({ command: 'cmd', args: ['/c', 'start', '', URL] })
  } else if (process.platform === 'darwin') {
    const browser = MAC_BROWSERS.find((name) => existsSync(`/Applications/${name}.app`))
    if (browser) detached({ command: 'open', args: ['-na', browser, '--args', app] })
    else detached({ command: 'open', args: [URL] })
  } else {
    const browser = LINUX_BROWSERS.find(commandExists)
    if (browser) detached({ command: browser, args: [app] })
    else detached({ command: 'xdg-open', args: [URL] })
  }
}

const launch = async () => {
  update()
  install()
  run({ command: 'npm', args: ['run', 'build'] })
  if (await isUp()) {
    // Restart so updates apply, unless that would interrupt a generation.
    if (!(await hasActiveGeneration())) {
      await stopServer()
      await startServer()
    }
  } else await startServer()
  openApp()
}

await (process.argv.includes('--stop') ? stopServer() : launch()).catch((error) => {
  console.error(error.message)
  process.exit(1)
})
