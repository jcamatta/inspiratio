import { spawn } from 'node:child_process'
import { once } from 'node:events'

/** Port that reveals a folder in the operating system's file manager. */
export type FolderOpener = (path: string) => Promise<void>

const COMMAND_BY_PLATFORM: Readonly<Partial<Record<NodeJS.Platform, string>>> = {
  win32: 'explorer',
  darwin: 'open',
}

export const createSystemFolderOpener =
  (platform: NodeJS.Platform): FolderOpener =>
  async (path) => {
    const child = spawn(COMMAND_BY_PLATFORM[platform] ?? 'xdg-open', [path], {
      detached: true,
      stdio: 'ignore',
    })
    await once(child, 'spawn')
    child.unref()
  }
