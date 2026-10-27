import { emptyLibraryState, startTrace, type LibraryState } from '@inspiratio/shared'
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MP4, NOW, PNG, fakeFetch } from '../../__test__/harness.ts'
import { createServiceLogger } from '../logging/bootstrap.ts'
import { buildRecord, createLogger, memorySink, silentLogger } from '../logging/logger.ts'
import { createFileSink, createStreamSink, formatPretty, formatRecord } from '../logging/sinks.ts'
import { currentTrace, runWithTrace } from '../logging/trace-context.ts'
import { sortBy } from '../lib/compare.ts'
import { findById, removeById, unique, upsert, upsertMany } from '../lib/collections.ts'
import { fixedClock, randomIds, sequentialIds, systemClock } from '../lib/runtime.ts'
import { createFsMediaStorage, readLocalFile } from '../media/media-storage.ts'
import { detectMediaType, probeImageDimensions } from '../media/media-type.ts'
import { extractOpenGraphMedia, fetchRemoteMedia } from '../media/remote-media.ts'
import {
  createFileLibraryStore,
  createMemoryLibraryStore,
  parseLibraryState,
} from '../persistence/library-store.ts'

const tempDir = () => mkdtemp(join(tmpdir(), 'inspiratio-test-'))

describe('runtime helpers', () => {
  it('generates ids and timestamps', () => {
    expect(randomIds({ prefix: 'itm' })).toMatch(/^itm_[0-9a-f]{12}$/)
    const ids = sequentialIds()
    expect([ids({ prefix: 'a' }), ids({ prefix: 'a' }), ids({ prefix: 'b' })]).toEqual([
      'a_1',
      'a_2',
      'b_1',
    ])
    expect(fixedClock(NOW)()).toBe(NOW)
    expect(systemClock()).toMatch(/^\d{4}-/)
  })

  it('sorts and manipulates collections immutably', () => {
    expect(
      sortBy({ values: [{ v: 2 }, { v: 1 }, { v: 2 }], key: (x) => x.v }).map((x) => x.v),
    ).toEqual([1, 2, 2])
    const list = [{ id: 'a', n: 1 }]
    expect(upsert({ list, entity: { id: 'a', n: 2 } })).toEqual([{ id: 'a', n: 2 }])
    expect(upsert({ list, entity: { id: 'b', n: 3 } })).toHaveLength(2)
    expect(
      upsertMany({
        list,
        entities: [
          { id: 'a', n: 9 },
          { id: 'c', n: 4 },
        ],
      }),
    ).toEqual([
      { id: 'a', n: 9 },
      { id: 'c', n: 4 },
    ])
    expect(removeById({ list, id: 'a' })).toEqual([])
    expect(findById({ list, id: 'z' })).toBeUndefined()
    expect(unique(['a', 'a', 'b'])).toEqual(['a', 'b'])
  })
})

describe('structured logging', () => {
  it('builds records with trace context and fields', () => {
    const trace = startTrace()
    const record = buildRecord({
      level: 'info',
      service: 's',
      ts: NOW,
      entry: { msg: 'hello', n: 1 },
      trace,
      baseFields: { app: 'x' },
    })
    expect(record).toEqual({
      ts: NOW,
      level: 'info',
      service: 's',
      msg: 'hello',
      traceId: trace.traceId,
      spanId: trace.spanId,
      parentSpanId: null,
      fields: { app: 'x', n: 1 },
    })
  })

  it('filters by level, supports children and raw writes', () => {
    const { sink, records } = memorySink()
    const logger = createLogger({
      service: 's',
      sinks: [sink],
      minLevel: 'info',
      clock: fixedClock(NOW),
      getTrace: currentTrace,
    })
    logger.debug({ msg: 'hidden' })
    logger.child({ module: 'm' }).warn({ msg: 'shown' })
    logger.error({ msg: 'bad' })
    logger.write(
      buildRecord({
        level: 'debug',
        service: 'web',
        ts: NOW,
        entry: { msg: 'raw' },
        trace: undefined,
        baseFields: {},
      }),
    )
    expect(records.map((record) => record.msg)).toEqual(['shown', 'bad'])
    expect(records[0]?.fields).toEqual({ module: 'm' })
    silentLogger().info({ msg: 'nothing' })
  })

  it('propagates trace context through async boundaries', async () => {
    const trace = startTrace()
    const seen = await runWithTrace({
      trace,
      run: async () => {
        await Promise.resolve()
        return currentTrace()
      },
    })
    expect(seen).toBe(trace)
    expect(currentTrace()).toBeUndefined()
  })

  it('formats records as pretty lines or JSON', () => {
    const record = buildRecord({
      level: 'warn',
      service: 'mcp',
      ts: NOW,
      entry: { msg: 'm', a: 1 },
      trace: undefined,
      baseFields: {},
    })
    expect(formatPretty(record)).toBe('10:00:00.000 WRN [mcp] (-) m {"a":1}')
    expect(formatPretty({ ...record, fields: {}, traceId: 'abcdef1234' })).toContain('(abcdef12) m')
    expect(JSON.parse(formatRecord({ record, format: 'json' }))).toEqual(record)
    const lines: string[] = []
    createStreamSink({ format: 'pretty', write: (line) => lines.push(line) })(record)
    expect(lines[0]?.endsWith('\n')).toBe(true)
  })

  it('appends NDJSON to a shared log file', async () => {
    const dir = await tempDir()
    const filePath = join(dir, 'logs', 'app.ndjson')
    const logger = createServiceLogger({
      service: 'server',
      logFile: filePath,
      minLevel: 'info',
      format: 'json',
      write: () => undefined,
    })
    logger.info({ msg: 'one' })
    createFileSink({ filePath })(
      buildRecord({
        level: 'info',
        service: 'x',
        ts: NOW,
        entry: { msg: 'two' },
        trace: undefined,
        baseFields: {},
      }),
    )
    const lines = (await readFile(filePath, 'utf8')).trim().split('\n')
    expect(lines.map((line) => (JSON.parse(line) as { msg: string }).msg)).toEqual(['one', 'two'])
  })
})

describe('library store', () => {
  it('serialises updates and skips writes for unchanged state', async () => {
    const store = createMemoryLibraryStore()
    const initial = store.read()
    expect(await store.update((state) => state)).toBe(initial)
    await Promise.all([
      store.update((state) => ({
        ...state,
        tags: [
          ...state.tags,
          { id: 't1', name: 'a', color: 'mint', system: false, createdAt: NOW },
        ],
      })),
      store.update((state) => ({
        ...state,
        tags: [
          ...state.tags,
          { id: 't2', name: 'b', color: 'mint', system: false, createdAt: NOW },
        ],
      })),
    ])
    expect(store.read().tags.map((tag) => tag.id)).toEqual(['t1', 't2'])
  })

  it('keeps working after a failed transformation', async () => {
    const store = createMemoryLibraryStore()
    await expect(
      store.update(() => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    await store.update((state) => ({ ...state, sections: [] }))
    expect(store.read().version).toBe(1)
  })

  it('persists atomically to disk and reloads', async () => {
    const dir = await tempDir()
    const filePath = join(dir, 'library.json')
    const store = await createFileLibraryStore({ filePath, logger: silentLogger() })
    const next: LibraryState = {
      ...emptyLibraryState(),
      tags: [{ id: 't', name: 'x', color: 'sky', system: false, createdAt: NOW }],
    }
    await store.update(() => next)
    const reloaded = await createFileLibraryStore({ filePath, logger: silentLogger() })
    expect(reloaded.read().tags).toHaveLength(1)
  })

  it('backs up a corrupt library file and starts empty', async () => {
    const dir = await tempDir()
    const filePath = join(dir, 'library.json')
    await writeFile(filePath, '{not json')
    const { sink, records } = memorySink()
    const logger = createLogger({
      service: 't',
      sinks: [sink],
      minLevel: 'debug',
      clock: fixedClock(NOW),
      getTrace: () => undefined,
    })
    const store = await createFileLibraryStore({ filePath, logger })
    expect(store.read().items).toEqual([])
    expect(records[0]?.msg).toBe('library.corrupt_file_backed_up')
    expect((await readdir(dir)).some((name) => name.includes('.corrupt-'))).toBe(true)
    expect(parseLibraryState('{"version":2}')).toBeNull()
  })
})

describe('media', () => {
  const bytes = (values: readonly number[]) =>
    new Uint8Array([...values, ...new Array<number>(16).fill(0)])
  const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0))

  it.each([
    ['png', [...PNG], 'image/png'],
    ['jpeg', [0xff, 0xd8, 0xff], 'image/jpeg'],
    ['gif', ascii('GIF89a'), 'image/gif'],
    ['webp', [...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')], 'image/webp'],
    ['webm', [0x1a, 0x45, 0xdf, 0xa3], 'video/webm'],
    ['mp4', [...MP4], 'video/mp4'],
    ['mov', [0, 0, 0, 0, ...ascii('ftypqt  ')], 'video/quicktime'],
    ['avif', [0, 0, 0, 0, ...ascii('ftypavif')], 'image/avif'],
  ])('detects %s from magic bytes', (...[, signature, mimeType]) => {
    expect(detectMediaType(bytes(signature))?.mimeType).toBe(mimeType)
  })

  it('rejects unknown bytes and probes image dimensions', () => {
    expect(detectMediaType(bytes(ascii('hello')))).toBeNull()
    expect(probeImageDimensions(PNG)).toEqual({ width: 2, height: 1 })
    expect(probeImageDimensions(bytes([1, 2, 3]))).toBeNull()
  })

  it('stores files on disk and moves deleted ones to the trash', async () => {
    const dir = await tempDir()
    const storage = await createFsMediaStorage({
      mediaDir: join(dir, 'media'),
      trashDir: join(dir, 'trash'),
    })
    await storage.save({ fileName: 'a.png', bytes: PNG })
    expect(storage.absolutePathOf('../../a.png')).toBe(join(dir, 'media', 'a.png'))
    await storage.moveToTrash('a.png')
    await storage.moveToTrash('missing.png')
    expect(await readdir(join(dir, 'trash'))).toHaveLength(1)
  })

  it('reads local files with validation', async () => {
    const dir = await tempDir()
    const file = join(dir, 'ref.png')
    await writeFile(file, PNG)
    expect((await readLocalFile({ filePath: file, maxBytes: 1000 })).ok).toBe(true)
    expect(await readLocalFile({ filePath: 'relative.png', maxBytes: 1000 })).toMatchObject({
      ok: false,
      error: { code: 'validation' },
    })
    expect(await readLocalFile({ filePath: dir, maxBytes: 1000 })).toMatchObject({
      ok: false,
      error: { code: 'validation' },
    })
    expect(await readLocalFile({ filePath: file, maxBytes: 1 })).toMatchObject({
      ok: false,
      error: { message: 'File exceeds the size limit' },
    })
    expect(await readLocalFile({ filePath: join(dir, 'nope.png'), maxBytes: 1 })).toMatchObject({
      ok: false,
      error: { code: 'not_found' },
    })
  })

  it('extracts Open Graph media, preferring video', () => {
    const html = `<meta name="twitter:image" content="https://x/t.jpg"><meta property='og:video' content="/v.mp4?a=1&amp;b=2"><meta property="og:image" content="https://x/i.jpg">`
    expect(extractOpenGraphMedia({ html, baseUrl: 'https://site.dev/page' })).toBe(
      'https://site.dev/v.mp4?a=1&b=2',
    )
    expect(
      extractOpenGraphMedia({ html: '<p>nothing</p>', baseUrl: 'https://site.dev' }),
    ).toBeNull()
    expect(
      extractOpenGraphMedia({
        html: '<meta property="og:image" content="http://[bad">',
        baseUrl: 'https://site.dev',
      }),
    ).toBeNull()
  })

  it('downloads remote media with size and error handling', async () => {
    const { fetchFn } = fakeFetch({
      'https://a/img.png': { body: PNG },
      'https://a/huge.png': { body: PNG, headers: { 'content-length': '999999' } },
      'https://a/page': { body: '<p>no media</p>', contentType: 'text/html' },
      'https://a/redirect': {
        body: '<meta property="og:image" content="https://a/gone.png">',
        contentType: 'text/html; charset=utf-8',
      },
      'https://a/offline': new Error('ECONNREFUSED'),
    })
    const base = { fetchFn, maxBytes: 1000, timeoutMs: 1000 }
    expect(await fetchRemoteMedia({ ...base, url: 'https://a/img.png' })).toMatchObject({
      ok: true,
      value: { finalUrl: 'https://a/img.png' },
    })
    expect(await fetchRemoteMedia({ ...base, url: 'https://a/huge.png' })).toMatchObject({
      ok: false,
      error: { code: 'validation' },
    })
    expect(
      await fetchRemoteMedia({ ...base, url: 'https://a/img.png', maxBytes: 10 }),
    ).toMatchObject({ ok: false, error: { code: 'validation' } })
    expect(await fetchRemoteMedia({ ...base, url: 'https://a/page' })).toMatchObject({
      ok: false,
      error: { code: 'unsupported_media' },
    })
    expect(await fetchRemoteMedia({ ...base, url: 'https://a/redirect' })).toMatchObject({
      ok: false,
      error: { message: 'Download failed with HTTP 404' },
    })
    expect(await fetchRemoteMedia({ ...base, url: 'https://a/offline' })).toMatchObject({
      ok: false,
      error: { message: 'Download failed: ECONNREFUSED' },
    })
    const nonError = await fetchRemoteMedia({
      ...base,
      url: 'https://x',
      fetchFn: () => Promise.reject(new Error('x')),
    })
    expect(nonError.ok).toBe(false)
    const thrown = await fetchRemoteMedia({
      ...base,
      url: 'https://x',
      fetchFn: () => Promise.reject('plain'),
    })
    expect(thrown).toMatchObject({ ok: false, error: { message: 'Download failed: plain' } })
  })
})
