import { err, ok, type Result } from '@inspiratio/shared'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, join, resolve } from 'node:path'

/** Port for the folder where reference files live on the user's disk. */
export type MediaStorage = {
  readonly directory: string
  readonly trashDirectory: string
  readonly save: (params: {
    readonly fileName: string
    readonly bytes: Uint8Array
  }) => Promise<void>
  readonly absolutePathOf: (fileName: string) => string
  /** Files are never hard-deleted: they move to a trash folder the user can empty. */
  readonly moveToTrash: (fileName: string) => Promise<void>
  readonly restoreFromTrash: (fileName: string) => Promise<void>
}

export const createFsMediaStorage = async (params: {
  readonly mediaDir: string
  readonly trashDir: string
}): Promise<MediaStorage> => {
  await mkdir(params.mediaDir, { recursive: true })
  await mkdir(params.trashDir, { recursive: true })
  const absolutePathOf = (fileName: string): string => join(params.mediaDir, basename(fileName))
  return {
    directory: params.mediaDir,
    trashDirectory: params.trashDir,
    absolutePathOf,
    save: async (file) => {
      await writeFile(absolutePathOf(file.fileName), file.bytes)
    },
    moveToTrash: async (fileName) => {
      const source = absolutePathOf(fileName)
      if (!existsSync(source)) return
      await rename(source, join(params.trashDir, basename(fileName)))
    },
    restoreFromTrash: async (fileName) => {
      const source = join(params.trashDir, basename(fileName))
      if (!existsSync(source)) return
      await rename(source, absolutePathOf(fileName))
    },
  }
}

export const createMemoryMediaStorage = (): MediaStorage & {
  readonly files: Map<string, Uint8Array>
  readonly trashed: string[]
} => {
  const files = new Map<string, Uint8Array>()
  const trashed: string[] = []
  const trash = new Map<string, Uint8Array>()
  return {
    directory: '/memory/media',
    trashDirectory: '/memory/trash',
    files,
    trashed,
    absolutePathOf: (fileName) => `/memory/media/${fileName}`,
    save: (file) => {
      files.set(file.fileName, file.bytes)
      return Promise.resolve()
    },
    moveToTrash: (fileName) => {
      const bytes = files.get(fileName)
      files.delete(fileName)
      trashed.push(fileName)
      if (bytes !== undefined) trash.set(fileName, bytes)
      return Promise.resolve()
    },
    restoreFromTrash: (fileName) => {
      const bytes = trash.get(fileName)
      if (bytes !== undefined) files.set(fileName, bytes)
      trash.delete(fileName)
      return Promise.resolve()
    },
  }
}

/** Reader port for importing files that already exist on disk (used by the MCP server). */
export type LocalFileReader = (params: {
  readonly filePath: string
  readonly maxBytes: number
}) => Promise<Result<Uint8Array>>

export const readLocalFile: LocalFileReader = async (params) => {
  if (!isAbsolute(params.filePath))
    return err({ code: 'validation', message: 'filePath must be absolute' })
  const path = resolve(params.filePath)
  try {
    const info = await stat(path)
    if (!info.isFile()) return err({ code: 'validation', message: 'filePath is not a file' })
    if (info.size > params.maxBytes)
      return err({ code: 'validation', message: 'File exceeds the size limit' })
    return ok(new Uint8Array(await readFile(path)))
  } catch {
    return err({ code: 'not_found', message: `File not found: ${path}` })
  }
}
