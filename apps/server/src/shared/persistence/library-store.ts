import { emptyLibraryState, LibraryStateSchema, type LibraryState } from '@inspiratio/shared'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { Logger } from '../logging/logger.ts'

/**
 * Persistence port. The whole library is a single immutable value; writers pass a pure
 * transformation and the store serialises updates so concurrent requests never interleave.
 */
export type LibraryStore = {
  readonly read: () => LibraryState
  readonly update: (transform: (state: LibraryState) => LibraryState) => Promise<LibraryState>
}

type Persist = (state: LibraryState) => Promise<void>

const createSerializedStore = (params: {
  readonly initial: LibraryState
  readonly persist: Persist
}): LibraryStore => {
  let state = params.initial
  let queue: Promise<unknown> = Promise.resolve()

  const update = (transform: (current: LibraryState) => LibraryState): Promise<LibraryState> => {
    const run = async (): Promise<LibraryState> => {
      const next = transform(state)
      if (next === state) return state
      await params.persist(next)
      state = next
      return next
    }
    const result = queue.then(run, run)
    queue = result.catch(() => undefined)
    return result
  }

  return { read: () => state, update }
}

export const createMemoryLibraryStore = (params?: {
  readonly initial?: LibraryState
}): LibraryStore =>
  createSerializedStore({
    initial: params?.initial ?? emptyLibraryState(),
    persist: () => Promise.resolve(),
  })

export const parseLibraryState = (raw: string): LibraryState | null => {
  try {
    const parsed = LibraryStateSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** JSON file adapter with atomic writes (temp file + rename). */
export const createFileLibraryStore = async (params: {
  readonly filePath: string
  readonly logger: Logger
}): Promise<LibraryStore> => {
  await mkdir(dirname(params.filePath), { recursive: true })
  const loaded = existsSync(params.filePath)
    ? parseLibraryState(await readFile(params.filePath, 'utf8'))
    : emptyLibraryState()

  if (loaded === null) {
    const backup = `${params.filePath}.corrupt-${Date.now()}`
    await rename(params.filePath, backup)
    params.logger.warn({ msg: 'library.corrupt_file_backed_up', backup })
  }

  const persist: Persist = async (state) => {
    const temp = `${params.filePath}.tmp`
    await writeFile(temp, JSON.stringify(state, null, 2), 'utf8')
    await rename(temp, params.filePath)
  }

  return createSerializedStore({ initial: loaded ?? emptyLibraryState(), persist })
}
