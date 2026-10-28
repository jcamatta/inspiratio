import { err, ok, type LibraryState, type Result } from '@inspiratio/shared'
import { createApp, type AppDeps } from '../app.ts'
import type { AgentOutcome, AgentRunParams } from '../shared/agent/agent-runner.ts'
import { createLogger, memorySink } from '../shared/logging/logger.ts'
import { fixedClock, sequentialIds } from '../shared/lib/runtime.ts'
import { createMemoryMediaStorage } from '../shared/media/media-storage.ts'
import { keepOriginalUpload } from '../shared/media/upload-copy.ts'
import type { FetchFn } from '../shared/media/remote-media.ts'
import { createMemoryLibraryStore } from '../shared/persistence/library-store.ts'

/** 2×1 PNG. */
export const PNG = new Uint8Array(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
    'base64',
  ),
)

/** Bytes that only carry an MP4 `ftyp` signature (enough for type detection). */
export const MP4 = new Uint8Array([0, 0, 0, 0x18, ...Buffer.from('ftypisom'), 0, 0, 0, 0])

export const NOW = '2026-10-27T10:00:00.000Z'

export type FakeResponse = {
  readonly status?: number
  readonly body: Uint8Array | string
  readonly contentType?: string
  readonly headers?: Record<string, string>
}

/** A fetch double that answers from a URL → response map and records requests. */
export const fakeFetch = (routes: Readonly<Record<string, FakeResponse | Error>>) => {
  const calls: string[] = []
  const fetchFn: FetchFn = (input) => {
    const url = input instanceof Request ? input.url : String(input)
    calls.push(url)
    const route = routes[url]
    if (route === undefined) return Promise.resolve(new Response('missing', { status: 404 }))
    if (route instanceof Error) return Promise.reject(route)
    const response = new Response(route.body, {
      status: route.status ?? 200,
      headers: {
        'content-type': route.contentType ?? 'application/octet-stream',
        ...route.headers,
      },
    })
    Object.defineProperty(response, 'url', { value: url })
    return Promise.resolve(response)
  }
  return { fetchFn, calls }
}

export const fakeFiles =
  (files: Readonly<Record<string, Uint8Array>>) =>
  (params: { readonly filePath: string }): Promise<Result<Uint8Array>> => {
    const bytes = files[params.filePath]
    return Promise.resolve(
      bytes === undefined
        ? err({ code: 'not_found', message: `File not found: ${params.filePath}` })
        : ok(bytes),
    )
  }

export const createTestDeps = (params?: {
  readonly initial?: LibraryState
  readonly fetch?: FetchFn
  readonly files?: Readonly<Record<string, Uint8Array>>
  readonly openFails?: boolean
  readonly agent?: (run: AgentRunParams) => Promise<AgentOutcome>
}) => {
  const logs = memorySink()
  const opened: string[] = []
  const agentRuns: string[] = []
  const logger = createLogger({
    service: 'test',
    sinks: [logs.sink],
    minLevel: 'debug',
    clock: fixedClock(NOW),
    getTrace: () => undefined,
  })
  const storage = createMemoryMediaStorage()
  const deps: AppDeps = {
    store: createMemoryLibraryStore({ initial: params?.initial }),
    storage,
    clock: fixedClock(NOW),
    newId: sequentialIds(),
    fetchFn: params?.fetch ?? fakeFetch({}).fetchFn,
    readFile: fakeFiles(params?.files ?? {}),
    logger,
    clientLogSink: logger,
    maxImportBytes: 1024 * 1024,
    fetchTimeoutMs: 1000,
    webDistDir: null,
    prepareUpload: keepOriginalUpload,
    runAgent:
      params?.agent === undefined
        ? null
        : (run) => {
            agentRuns.push(run.generationId)
            return params.agent?.(run) ?? Promise.resolve({ exitCode: 0, logFile: '' })
          },
    openFolder: (path) => {
      if (params?.openFails === true) return Promise.reject(new Error('no file manager'))
      opened.push(path)
      return Promise.resolve()
    },
  }
  return { deps, storage, opened, agentRuns, logs: logs.records }
}

export const createTestApp = (params?: Parameters<typeof createTestDeps>[0]) => {
  const harness = createTestDeps(params)
  return { ...harness, app: createApp(harness.deps) }
}
