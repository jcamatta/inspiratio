import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { dirname } from 'node:path'

/** Port that reveals a folder in the operating system's file manager. */
export type FolderOpener = (path: string) => Promise<void>

const COMMAND_BY_PLATFORM: Readonly<Partial<Record<NodeJS.Platform, string>>> = {
  win32: 'explorer',
  darwin: 'open',
}

/** Port that opens the file manager on a file's folder with that file selected. */
export type FileRevealer = (filePath: string) => Promise<void>

const launch = async (params: {
  readonly command: string
  readonly args: readonly string[]
  readonly verbatim?: boolean
}): Promise<void> => {
  const child = spawn(params.command, params.args, {
    detached: true,
    stdio: 'ignore',
    windowsVerbatimArguments: params.verbatim ?? false,
  })
  await once(child, 'spawn')
  child.unref()
}

/** Explorer needs `/select,"path"` unescaped; Finder has `-R`; Linux file managers only get the folder. */
export const createSystemFileRevealer =
  (platform: NodeJS.Platform): FileRevealer =>
  (filePath) => {
    if (platform === 'win32')
      return launch({ command: 'explorer', args: [`/select,"${filePath}"`], verbatim: true })
    if (platform === 'darwin') return launch({ command: 'open', args: ['-R', filePath] })
    return launch({ command: 'xdg-open', args: [dirname(filePath)] })
  }

export const createSystemFolderOpener =
  (platform: NodeJS.Platform): FolderOpener =>
  (path) =>
    launch({ command: COMMAND_BY_PLATFORM[platform] ?? 'xdg-open', args: [path] })
