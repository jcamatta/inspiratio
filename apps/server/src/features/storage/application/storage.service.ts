import {
  err,
  ok,
  serializeError,
  type OpenFolder,
  type Result,
  type StorageInfo,
} from '@inspiratio/shared'
import type { Logger } from '../../../shared/logging/logger.ts'
import type { MediaStorage } from '../../../shared/media/media-storage.ts'
import type { FolderOpener } from '../../../shared/system/folder-opener.ts'

export type StorageDeps = {
  readonly storage: MediaStorage
  readonly openFolder: FolderOpener
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
})

export type StorageQueries = ReturnType<typeof createStorageQueries>
export type StorageCommands = ReturnType<typeof createStorageCommands>
