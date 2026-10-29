import {
  err,
  ok,
  serializeError,
  type OpenFolder,
  type RevealFile,
  type Result,
  type StorageInfo,
} from '@inspiratio/shared'
import type { Logger } from '../../../shared/logging/logger.ts'
import type { MediaStorage } from '../../../shared/media/media-storage.ts'
import type { FileRevealer, FolderOpener } from '../../../shared/system/folder-opener.ts'

export type StorageDeps = {
  readonly storage: MediaStorage
  readonly openFolder: FolderOpener
  readonly revealFile: FileRevealer
  readonly logger: Logger
}

export const storageInfo = (storage: MediaStorage): StorageInfo => ({
  media: storage.directory,
  trash: storage.trashDirectory,
})

export const createStorageQueries = (deps: StorageDeps) => ({
  info: (): Result<StorageInfo> => ok(storageInfo(deps.storage)),
})

export const createStorageCommands = (deps: StorageDeps) => ({
  open: async (input: OpenFolder): Promise<Result<undefined>> => {
    const path = storageInfo(deps.storage)[input.folder]
    try {
      await deps.openFolder(path)
      return ok(undefined)
    } catch (error) {
      deps.logger.warn({ msg: 'storage.open_failed', path, error: serializeError(error) })
      return err({ code: 'upstream', message: `Could not open ${path}` })
    }
  },

  /** Only a bare file name is accepted: the storage resolves it inside the media folder. */
  reveal: async (input: RevealFile): Promise<Result<undefined>> => {
    const path = deps.storage.absolutePathOf(input.fileName)
    try {
      await deps.revealFile(path)
      return ok(undefined)
    } catch (error) {
      deps.logger.warn({ msg: 'storage.reveal_failed', path, error: serializeError(error) })
      return err({ code: 'upstream', message: `Could not show ${path}` })
    }
  },
})

export type StorageQueries = ReturnType<typeof createStorageQueries>
export type StorageCommands = ReturnType<typeof createStorageCommands>
