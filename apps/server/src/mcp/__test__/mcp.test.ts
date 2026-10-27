import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { err, ok, startTrace, type Result } from '@inspiratio/shared'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { fakeFetch } from '../../__test__/harness.ts'
import { createLogger, memorySink } from '../../shared/logging/logger.ts'
import { currentTrace } from '../../shared/logging/trace-context.ts'
import { createApiClient, type ApiClient, type ApiRequest } from '../api-client.ts'
import { createMcpServer } from '../server.ts'
import { createToolHandlers, HIGGSFIELD_GUIDE, type ToolResult } from '../tools.ts'

const TRACE_ID = 'a'.repeat(32)

type Call = {
  readonly method: string
  readonly path: string
  readonly body: unknown
  readonly traceId: string
}

/** Fake Inspiratio API keyed by "METHOD path". Records calls and validates with the real schemas. */
const fakeApi = (responses: Readonly<Record<string, unknown>>) => {
  const calls: Call[] = []
  const api: ApiClient = {
    request: <S extends z.ZodType>(call: ApiRequest<S>): Promise<Result<z.output<S>>> => {
      calls.push({
        method: call.method,
        path: call.path,
        body: call.body,
        traceId: call.trace.traceId,
      })
      const key = `${call.method} ${call.path}`
      if (!(key in responses))
        return Promise.resolve(err({ code: 'upstream', message: `no route ${key}` }))
      const parsed = call.schema.safeParse(responses[key])
      return Promise.resolve(
        parsed.success ? ok(parsed.data) : err({ code: 'upstream', message: 'bad fixture' }),
      )
    },
  }
  return { api, calls }
}

const request = {
  id: 'gen_1',
  prompt: 'Rain like @1',
  kind: 'image',
  model: null,
  aspectRatio: '16:9',
  count: 1,
  references: [{ itemId: 'itm_1', label: '@1' }],
  status: 'pending',
  traceId: TRACE_ID,
  createdAt: 'now',
  updatedAt: 'now',
  resultItemIds: [],
  error: null,
}

const textOf = (result: ToolResult): string => result.content[0]?.text ?? ''

const setup = (responses: Readonly<Record<string, unknown>>) => {
  const { api, calls } = fakeApi(responses)
  const logs = memorySink()
  const logger = createLogger({
    service: 'mcp',
    sinks: [logs.sink],
    minLevel: 'debug',
    clock: () => 'now',
    getTrace: currentTrace,
  })
  return { handlers: createToolHandlers({ api, logger }), calls, logs: logs.records }
}

describe('MCP tool handlers', () => {
  it('lists generation requests or reports an empty queue', async () => {
    const { handlers } = setup({ 'GET /api/generations?status=pending': [request] })
    const listed = await handlers.listGenerationRequests({ status: 'pending' })
    expect(JSON.parse(textOf(listed))).toEqual([
      {
        id: 'gen_1',
        status: 'pending',
        kind: 'image',
        model: null,
        prompt: 'Rain like @1',
        progress: null,
        references: 1,
        createdAt: 'now',
      },
    ])
    const open = setup({
      'GET /api/generations': [
        { ...request, id: 'gen_run', status: 'in_progress', progress: 'Waiting on job j_1' },
        { ...request, id: 'gen_done', status: 'completed' },
        { ...request, id: 'gen_draft', status: 'draft' },
      ],
    })
    expect(JSON.parse(textOf(await open.handlers.listGenerationRequests({})))).toEqual([
      expect.objectContaining({ id: 'gen_run', progress: 'Waiting on job j_1' }),
    ])
    const empty = setup({ 'GET /api/generations?status=failed': [] })
    expect(textOf(await empty.handlers.listGenerationRequests({ status: 'failed' }))).toBe(
      'No failed generation requests.',
    )
  })

  it('returns request details with the Higgsfield guide inside the original trace', async () => {
    const { handlers, calls, logs } = setup({
      'GET /api/generations/gen_1': { ...request, resolvedReferences: [] },
    })
    const result = await handlers.getGenerationRequest({ id: 'gen_1' })
    expect(JSON.parse(textOf(result))).toMatchObject({
      request: { id: 'gen_1' },
      guide: HIGGSFIELD_GUIDE,
    })
    expect(calls.at(-1)?.traceId).toBe(TRACE_ID)
    expect(
      logs.filter((record) => record.traceId === TRACE_ID).map((record) => record.msg),
    ).toEqual(['mcp.tool_called', 'mcp.tool_finished'])
  })

  it('starts, fails and completes generations', async () => {
    const { handlers, calls } = setup({
      'GET /api/generations/gen_1': request,
      'POST /api/generations/gen_1/start': undefined,
      'POST /api/generations/gen_1/progress': undefined,
      'POST /api/generations/gen_1/fail': undefined,
      'POST /api/generations/gen_1/complete': { ids: ['itm_9'] },
    })
    expect(textOf(await handlers.startGeneration({ id: 'gen_1' }))).toBe(
      'Generation gen_1 started.',
    )
    expect(
      textOf(await handlers.reportProgress({ id: 'gen_1', message: 'Uploading references' })),
    ).toBe('Progress reported on gen_1.')
    expect(calls.at(-1)).toMatchObject({
      path: '/api/generations/gen_1/progress',
      body: { message: 'Uploading references' },
      traceId: TRACE_ID,
    })
    expect(textOf(await handlers.failGeneration({ id: 'gen_1', error: 'no credits' }))).toBe(
      'Generation gen_1 marked as failed.',
    )
    expect(calls.find((call) => call.path.endsWith('/fail'))?.body).toEqual({ error: 'no credits' })
    const done = await handlers.completeGeneration({
      id: 'gen_1',
      results: [
        { url: 'https://cdn/x.png', model: 'nano_banana_pro', provider: 'higgsfield' },
        { filePath: 'C:/out.png', model: 'nano_banana_pro', provider: 'higgsfield', title: 'Alt' },
      ],
    })
    expect(textOf(done)).toContain('itm_9')
    expect(calls.at(-1)?.body).toEqual({
      results: [
        {
          source: { url: 'https://cdn/x.png' },
          model: 'nano_banana_pro',
          provider: 'higgsfield',
          title: undefined,
        },
        {
          source: { filePath: 'C:/out.png' },
          model: 'nano_banana_pro',
          provider: 'higgsfield',
          title: 'Alt',
        },
      ],
    })
  })

  it('rejects results without a source and surfaces API errors', async () => {
    const { handlers } = setup({})
    const missing = await handlers.completeGeneration({
      id: 'gen_1',
      results: [{ model: 'm', provider: 'higgsfield' }],
    })
    expect(missing.isError).toBe(true)
    const failed = await handlers.startGeneration({ id: 'gen_404' })
    expect(failed).toMatchObject({ isError: true })
  })

  it('searches references, lists tags and imports media', async () => {
    const item = {
      id: 'itm_1',
      kind: 'image',
      title: 'Neon',
      media: { fileName: 'itm_1.png', mimeType: 'image/png', bytes: 1, width: 1, height: 1 },
      position: { x: 0, y: 0 },
      size: { width: 100, height: 100 },
      zIndex: 1,
      sectionId: null,
      tagIds: [],
      metadata: {
        createdAt: 'n',
        updatedAt: 'n',
        origin: 'upload',
        sourceUrl: null,
        originalFileName: null,
        notes: '',
        generation: null,
      },
      tagNames: ['noir'],
      absolutePath: 'C:/lib/itm_1.png',
      mediaUrl: '/media/itm_1.png',
    }
    const { handlers, calls } = setup({
      'GET /api/items?text=neon&kind=image&tags=noir%2Cwarm': [item],
      'GET /api/items?': [],
      'GET /api/tags': [{ id: 't', name: 'noir', color: 'mint', system: false, createdAt: 'n' }],
      'POST /api/items/import-url': { id: 'itm_2' },
      'POST /api/items/import-file': { id: 'itm_3' },
    })
    const found = JSON.parse(
      textOf(
        await handlers.searchReferences({ text: 'neon', kind: 'image', tags: ['noir', 'warm'] }),
      ),
    ) as unknown[]
    expect(found).toEqual([
      {
        id: 'itm_1',
        title: 'Neon',
        kind: 'image',
        tags: ['noir'],
        absolutePath: 'C:/lib/itm_1.png',
        mimeType: 'image/png',
        prompt: null,
      },
    ])
    expect(JSON.parse(textOf(await handlers.searchReferences({})))).toEqual([])
    expect(JSON.parse(textOf(await handlers.listTags()))).toEqual(['noir'])
    expect(textOf(await handlers.importMedia({ url: 'https://x/a.png' }))).toBe(
      'Added item itm_2 to the canvas.',
    )
    expect(textOf(await handlers.importMedia({ filePath: 'C:/a.png', title: 'A' }))).toBe(
      'Added item itm_3 to the canvas.',
    )
    expect(calls.at(-1)?.body).toEqual({ filePath: 'C:/a.png', title: 'A' })
    expect((await handlers.importMedia({})).isError).toBe(true)
  })
})

describe('MCP API client', () => {
  const base = 'http://inspiratio'

  it('sends the traceparent and validates responses', async () => {
    const { fetchFn, calls } = fakeFetch({
      [`${base}/api/tags`]: { body: '[]', contentType: 'application/json' },
    })
    const client = createApiClient({ baseUrl: base, fetchFn })
    const result = await client.request({
      method: 'GET',
      path: '/api/tags',
      trace: startTrace(),
      schema: z.array(z.string()),
    })
    expect(result).toEqual({ ok: true, value: [] })
    expect(calls).toEqual([`${base}/api/tags`])
  })

  it('maps API errors, invalid payloads, empty bodies and network failures', async () => {
    const { fetchFn } = fakeFetch({
      [`${base}/err`]: {
        status: 404,
        body: JSON.stringify({ error: { code: 'not_found', message: 'gone', traceId: null } }),
      },
      [`${base}/plain`]: { status: 500, body: 'oops' },
      [`${base}/bad`]: { body: '{"x":1}' },
      [`${base}/empty`]: { status: 200, body: '' },
      [`${base}/down`]: new Error('ECONNREFUSED'),
    })
    const client = createApiClient({ baseUrl: base, fetchFn })
    const call = (params: { readonly path: string; readonly schema?: z.ZodType }) =>
      client.request({
        method: 'POST',
        path: params.path,
        body: { a: 1 },
        trace: startTrace(),
        schema: params.schema ?? z.array(z.string()),
      })
    expect(await call({ path: '/err' })).toMatchObject({
      ok: false,
      error: { message: 'not_found: gone' },
    })
    expect(await call({ path: '/plain' })).toMatchObject({
      ok: false,
      error: { message: 'HTTP 500' },
    })
    expect(await call({ path: '/bad' })).toMatchObject({
      ok: false,
      error: { message: 'Unexpected response from Inspiratio' },
    })
    expect(await call({ path: '/empty', schema: z.undefined() })).toEqual({
      ok: true,
      value: undefined,
    })
    expect(await call({ path: '/down' })).toMatchObject({
      ok: false,
      error: { message: expect.stringContaining('Cannot reach Inspiratio') },
    })
    const thrown = createApiClient({ baseUrl: base, fetchFn: () => Promise.reject('nope') })
    expect(
      await thrown.request({
        method: 'GET',
        path: '/',
        trace: startTrace(),
        schema: z.undefined(),
      }),
    ).toMatchObject({ ok: false })
  })
})

describe('MCP server', () => {
  it('exposes every tool through the protocol', async () => {
    const { handlers } = setup({
      'GET /api/generations': [],
      'GET /api/tags': [],
    })
    const server = createMcpServer(handlers)
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    const client = new Client({ name: 'test', version: '1.0.0' })
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
    const { tools } = await client.listTools()
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'complete_generation',
      'fail_generation',
      'get_generation_request',
      'import_media',
      'list_generation_requests',
      'list_tags',
      'report_progress',
      'search_references',
      'start_generation',
    ])
    const listed = await client.callTool({ name: 'list_generation_requests', arguments: {} })
    expect(listed.content).toEqual([{ type: 'text', text: 'No open generation requests.' }])
    for (const [name, args] of [
      ['get_generation_request', { id: 'x' }],
      ['start_generation', { id: 'x' }],
      ['report_progress', { id: 'x', message: 'Working' }],
      ['fail_generation', { id: 'x', error: 'e' }],
      ['complete_generation', { id: 'x', results: [{ url: 'https://a/b.png', model: 'm' }] }],
      ['search_references', {}],
      ['list_tags', {}],
      ['import_media', {}],
    ] as const) {
      const result = await client.callTool({ name, arguments: args })
      expect(result.content).toBeDefined()
    }
    await client.close()
  })
})
