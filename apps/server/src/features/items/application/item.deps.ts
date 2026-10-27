import type { Logger } from '../../../shared/logging/logger.ts'
import type { Clock, IdGenerator } from '../../../shared/lib/runtime.ts'
import type { LocalFileReader, MediaStorage } from '../../../shared/media/media-storage.ts'
import type { FetchFn } from '../../../shared/media/remote-media.ts'
import type { LibraryStore } from '../../../shared/persistence/library-store.ts'

/** Driven ports the item use cases depend on (hexagonal: adapters are injected at the root). */
export type ItemDeps = {
  readonly store: LibraryStore
  readonly storage: MediaStorage
  readonly clock: Clock
  readonly newId: IdGenerator
  readonly fetchFn: FetchFn
  readonly readFile: LocalFileReader
  readonly logger: Logger
  readonly maxImportBytes: number
  readonly fetchTimeoutMs: number
}
