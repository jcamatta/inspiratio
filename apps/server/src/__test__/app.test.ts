import {
  formatTraceparent,
  ok,
  startTrace,
  type BoardSnapshot,
  type GenerationDetails,
  type GenerationRequest,
} from '@inspiratio/shared'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import type { IdeaRequest } from '../shared/agent/idea-helper.ts'
import { createTestApp, fakeFetch, MP4, PNG, TEST_GUIDES } from './harness.ts'

const upload = async (params: {
  readonly app: ReturnType<typeof createTestApp>['app']
  readonly name?: string
  readonly bytes?: Uint8Array
}) => {
  const response = await request(params.app)
    .post('/api/items/upload')
    .attach('files', Buffer.from(params.bytes ?? PNG), params.name ?? 'still.png')
    .field('x', '10')
    .field('y', '20')
  return response.body as { ids: string[] }
}

const board = async (app: ReturnType<typeof createTestApp>['app']) =>
  (await request(app).get('/api/board')).body as BoardSnapshot

describe('HTTP API (integration)', () => {
  it('reports health and propagates the trace id', async () => {
    const { app } = createTestApp()
    const trace = startTrace()
    const response = await request(app)
      .get('/api/health')
      .set('traceparent', formatTraceparent(trace))
    expect(response.status).toBe(200)
    expect(response.headers.traceparent).toContain(trace.traceId)
  })

  it('uploads images and lists them on the board', async () => {
    const { app } = createTestApp()
    const { ids } = await upload({ app })
    const snapshot = await board(app)
    expect(snapshot.items).toHaveLength(1)
    expect(snapshot.items[0]).toMatchObject({
      id: ids[0],
      kind: 'image',
      title: 'still',
      position: { x: 10, y: 20 },
    })
    const single = await request(app).get(`/api/items/${ids[0] ?? ''}`)
    expect(single.body).toMatchObject({ mediaUrl: `/media/${ids[0] ?? ''}.png`, tagNames: [] })
  })

  it('rejects unsupported uploads and empty uploads', async () => {
    const { app } = createTestApp()
    const bad = await request(app)
      .post('/api/items/upload')
      .attach('files', Buffer.from('hello'), 'notes.txt')
    expect(bad.status).toBe(415)
    expect(bad.body.error.code).toBe('unsupported_media')
    const empty = await request(app).post('/api/items/upload').field('x', 'nope')
    expect(empty.status).toBe(400)
  })

  it('imports from URLs, following Open Graph tags on pages', async () => {
    const { fetchFn } = fakeFetch({
      'https://pins.example/pin/1': {
        body: '<meta property="og:image" content="/img/1.png">',
        contentType: 'text/html',
      },
      'https://pins.example/img/1.png': { body: PNG },
    })
    const { app } = createTestApp({ fetch: fetchFn })
    const response = await request(app)
      .post('/api/items/import-url')
      .send({ url: 'https://pins.example/pin/1' })
    expect(response.status).toBe(201)
    const snapshot = await board(app)
    expect(snapshot.items[0]?.metadata).toMatchObject({
      origin: 'url',
      sourceUrl: 'https://pins.example/pin/1',
    })
  })

  it('validates request bodies', async () => {
    const { app } = createTestApp()
    const response = await request(app).post('/api/items/import-url').send({ url: 'ftp://nope' })
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('validation')
    const malformed = await request(app)
      .post('/api/tags')
      .set('content-type', 'application/json')
      .send('{bad')
    expect(malformed.status).toBe(400)
  })

  it('imports local files', async () => {
    const { app } = createTestApp({ files: { 'C:/refs/clip.mp4': MP4 } })
    const response = await request(app)
      .post('/api/items/import-file')
      .send({ filePath: 'C:/refs/clip.mp4' })
    expect(response.status).toBe(201)
    expect((await board(app)).items[0]).toMatchObject({ kind: 'video', title: 'clip' })
    const missing = await request(app)
      .post('/api/items/import-file')
      .send({ filePath: 'C:/nope.png' })
    expect(missing.status).toBe(404)
  })

  it('updates, tags, lays out and deletes items', async () => {
    const { app, storage } = createTestApp()
    const { ids } = await upload({ app })
    const id = ids[0] ?? ''
    expect(
      (await request(app).patch(`/api/items/${id}`).send({ title: 'Neon', notes: 'teal/orange' }))
        .status,
    ).toBe(204)
    const tag = (await request(app).post('/api/tags').send({ name: 'noir' })).body as { id: string }
    expect(
      (
        await request(app)
          .put(`/api/items/${id}/tags`)
          .send({ tagIds: [tag.id] })
      ).status,
    ).toBe(204)
    expect(
      (
        await request(app)
          .put(`/api/items/${id}/tags`)
          .send({ tagIds: ['tag_missing'] })
      ).status,
    ).toBe(404)
    expect(
      (
        await request(app)
          .post('/api/items/layout')
          .send({ changes: [{ id, position: { x: 5, y: 6 } }] })
      ).status,
    ).toBe(204)
    expect(
      (await request(app).put(`/api/items/${id}/dimensions`).send({ width: 1920, height: 1080 }))
        .status,
    ).toBe(204)
    const search = await request(app).get('/api/items?text=neon&tags=noir&kind=image')
    expect(search.body).toHaveLength(1)
    expect((await board(app)).items[0]).toMatchObject({
      title: 'Neon',
      position: { x: 5, y: 6 },
      tagIds: [tag.id],
    })
    expect((await request(app).delete(`/api/items/${id}`)).status).toBe(204)
    expect(storage.trashed).toEqual([`${id}.png`])
    expect((await request(app).delete(`/api/items/${id}`)).status).toBe(404)
    expect((await request(app).patch(`/api/items/${id}`).send({ title: 'x' })).status).toBe(404)
  })

  it('manages tags with conflicts and cascades deletions', async () => {
    const { app } = createTestApp()
    const { ids } = await upload({ app })
    const first = (await request(app).post('/api/tags').send({ name: 'Noir' })).body as {
      id: string
    }
    const again = (await request(app).post('/api/tags').send({ name: ' noir ' })).body as {
      id: string
    }
    expect(again.id).toBe(first.id)
    const second = (await request(app).post('/api/tags').send({ name: 'Warm', color: 'amber' }))
      .body as { id: string }
    expect((await request(app).patch(`/api/tags/${second.id}`).send({ name: 'NOIR' })).status).toBe(
      409,
    )
    expect(
      (await request(app).patch(`/api/tags/${second.id}`).send({ name: 'Golden', color: 'coral' }))
        .status,
    ).toBe(204)
    expect((await request(app).patch('/api/tags/tag_x').send({ name: 'x' })).status).toBe(404)
    await request(app)
      .put(`/api/items/${ids[0] ?? ''}/tags`)
      .send({ tagIds: [first.id] })
    expect((await request(app).delete(`/api/tags/${first.id}`)).status).toBe(204)
    expect((await request(app).delete(`/api/tags/${first.id}`)).status).toBe(404)
    const tags = (await request(app).get('/api/tags')).body as { name: string }[]
    expect(tags.map((tag) => tag.name)).toEqual(['Golden'])
    expect((await board(app)).items[0]?.tagIds).toEqual([])
  })

  it('creates sections, moves items into them and keeps positions on delete', async () => {
    const { app } = createTestApp()
    const { ids } = await upload({ app })
    const id = ids[0] ?? ''
    const section = (
      await request(app)
        .post('/api/sections')
        .send({ position: { x: 100, y: 100 } })
    ).body as { id: string }
    expect(
      (await request(app).patch(`/api/sections/${section.id}`).send({ title: 'Act I' })).status,
    ).toBe(204)
    await request(app)
      .post('/api/items/layout')
      .send({ changes: [{ id, sectionId: section.id, position: { x: 10, y: 10 } }] })
    expect(
      (
        await request(app)
          .post('/api/items/layout')
          .send({ changes: [{ id, sectionId: 'sec_x' }] })
      ).status,
    ).toBe(404)
    expect(
      (
        await request(app)
          .post('/api/items/layout')
          .send({ changes: [{ id: 'itm_x' }] })
      ).status,
    ).toBe(404)
    expect((await request(app).delete(`/api/sections/${section.id}`)).status).toBe(204)
    expect((await board(app)).items[0]).toMatchObject({
      sectionId: null,
      position: { x: 110, y: 110 },
    })
    expect((await request(app).delete(`/api/sections/${section.id}`)).status).toBe(404)
    expect(
      (await request(app).patch(`/api/sections/${section.id}`).send({ title: 'x' })).status,
    ).toBe(404)
  })

  it('runs the generation lifecycle end to end', async () => {
    const { fetchFn } = fakeFetch({ 'https://cdn.higgsfield.ai/out.png': { body: PNG } })
    const { app } = createTestApp({ fetch: fetchFn })
    const { ids } = await upload({ app })
    const trace = startTrace()
    const created = await request(app)
      .post('/api/generations')
      .set('traceparent', formatTraceparent(trace))
      .send({ prompt: 'Night street like @1', model: 'nano_banana_pro', referenceItemIds: ids })
    expect(created.status).toBe(201)
    const id = (created.body as { id: string }).id
    const details = (await request(app).get(`/api/generations/${id}`)).body as GenerationDetails
    expect(details.traceId).toBe(trace.traceId)
    expect(details.resolvedReferences[0]).toMatchObject({
      label: '@1',
      absolutePath: `/memory/media/${ids[0] ?? ''}.png`,
    })
    expect((await request(app).get('/api/generations?status=pending')).body).toHaveLength(1)
    expect(
      (await request(app).post(`/api/generations/${id}/progress`).send({ message: 'Uploading' }))
        .status,
    ).toBe(204)
    const reported = (await request(app).get(`/api/generations/${id}`)).body as GenerationRequest
    expect(reported).toMatchObject({ status: 'in_progress', progress: 'Uploading' })
    expect(reported.queuedAt).not.toBeNull()
    expect((await request(app).post(`/api/generations/${id}/start`)).status).toBe(204)
    expect((await request(app).get(`/api/generations/${id}`)).body).toMatchObject({
      status: 'in_progress',
      progress: 'Uploading',
    })
    expect(
      (await request(app).post(`/api/generations/${id}/progress`).send({ message: '' })).status,
    ).toBe(400)
    const completed = await request(app)
      .post(`/api/generations/${id}/complete`)
      .send({
        results: [
          { source: { url: 'https://cdn.higgsfield.ai/out.png' }, model: 'Nano Banana Pro' },
        ],
      })
    expect(completed.status).toBe(201)
    const snapshot = await board(app)
    const result = snapshot.items.find((item) => item.metadata.origin === 'generated')
    expect(result?.metadata.generation).toMatchObject({
      prompt: 'Night street like @1',
      model: 'Nano Banana Pro',
      provider: 'higgsfield',
    })
    expect(snapshot.tags.map((tag) => tag.name).sort()).toEqual([
      'ai-generated',
      'by:higgsfield',
      'model:nano-banana-pro',
    ])
    expect((await request(app).post(`/api/generations/${id}/start`)).status).toBe(409)
    expect(
      (await request(app).post(`/api/generations/${id}/progress`).send({ message: 'Late' })).status,
    ).toBe(409)
    expect(
      (await request(app).post('/api/generations/gen_x/progress').send({ message: 'x' })).status,
    ).toBe(404)
    expect((await request(app).get(`/api/generations/${id}`)).body).toMatchObject({
      status: 'completed',
      progress: null,
    })
    expect((await request(app).delete(`/api/generations/${id}`)).status).toBe(204)
    expect((await request(app).get(`/api/generations/${id}`)).status).toBe(404)
  })

  it('develops the idea of a brief with Claude without saving it', async () => {
    const seen: IdeaRequest[] = []
    const { app } = createTestApp({
      ideas: (idea) => {
        seen.push(idea)
        return Promise.resolve(
          ok({ brief: '@1 swirls into a slow vortex', questions: ['Clockwise?'] }),
        )
      },
    })
    const { ids } = await upload({ app })
    const id = (
      (
        await request(app)
          .post('/api/generations')
          .send({ prompt: '', kind: 'video', submit: false, referenceItemIds: ids })
      ).body as { id: string }
    ).id
    const response = await request(app)
      .post(`/api/generations/${id}/idea`)
      .send({ brief: 'make @1 move like a vortex' })
    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      brief: '@1 swirls into a slow vortex',
      questions: ['Clockwise?'],
    })
    expect(seen[0]).toMatchObject({ kind: 'video', brief: 'make @1 move like a vortex' })
    expect(seen[0]?.references[0]).toMatchObject({ label: '@1', kind: 'image' })
    expect(seen[0]?.history).toEqual([])
    const turn = { suggestion: '@1 swirls into a slow vortex', feedback: 'faster' }
    expect(
      (
        await request(app)
          .post(`/api/generations/${id}/idea`)
          .send({ brief: 'make @1 move like a vortex', history: [turn] })
      ).status,
    ).toBe(200)
    expect(seen[1]?.history).toEqual([turn])
    expect(
      ((await request(app).get(`/api/generations/${id}`)).body as GenerationRequest).prompt,
    ).toBe('')
    expect(
      (await request(app).post(`/api/generations/${id}/idea`).send({ brief: ' ' })).status,
    ).toBe(400)
    expect(
      (await request(app).post('/api/generations/gen_x/idea').send({ brief: 'x' })).status,
    ).toBe(404)
  })

  it('refuses idea help when Claude is off', async () => {
    const { app } = createTestApp()
    const id = (
      (await request(app).post('/api/generations').send({ prompt: '', submit: false })).body as {
        id: string
      }
    ).id
    expect(
      (await request(app).post(`/api/generations/${id}/idea`).send({ brief: 'x' })).status,
    ).toBe(409)
  })

  it('fails, retries and rejects bad generation requests', async () => {
    const { app } = createTestApp()
    expect(
      (
        await request(app)
          .post('/api/generations')
          .send({ prompt: 'x', referenceItemIds: ['itm_x'] })
      ).status,
    ).toBe(404)
    const id = (
      (await request(app).post('/api/generations').send({ prompt: 'x', kind: 'video' })).body as {
        id: string
      }
    ).id
    expect(
      (await request(app).post(`/api/generations/${id}/fail`).send({ error: 'credits' })).status,
    ).toBe(204)
    const failed = (await request(app).get('/api/generations?status=failed'))
      .body as GenerationRequest[]
    expect(failed[0]?.error).toBe('credits')
    expect((await request(app).post(`/api/generations/${id}/retry`)).status).toBe(204)
    const all = (await request(app).get('/api/generations')).body as GenerationRequest[]
    expect(all[0]?.status).toBe('pending')
    const broken = await request(app)
      .post(`/api/generations/${id}/complete`)
      .send({ results: [{ source: { filePath: 'C:/missing.png' }, model: 'm' }] })
    expect(broken.status).toBe(502)
    expect((await request(app).get('/api/generations?status=bogus')).status).toBe(400)
    expect((await request(app).delete('/api/generations/gen_x')).status).toBe(404)
  })

  it('ingests browser logs and answers unknown routes', async () => {
    const { app, logs } = createTestApp()
    const record = {
      ts: 'now',
      level: 'info',
      service: 'web',
      msg: 'ui.action',
      traceId: 'a',
      spanId: 'b',
      parentSpanId: null,
      fields: {},
    }
    expect(
      (
        await request(app)
          .post('/api/logs')
          .send({ records: [record] })
      ).status,
    ).toBe(204)
    expect(logs.some((entry) => entry.msg === 'ui.action' && entry.service === 'web')).toBe(true)
    const unknown = await request(app).get('/api/nope')
    expect(unknown.status).toBe(404)
  })

  it('accepts uploaded videos', async () => {
    const { app } = createTestApp()
    await upload({ app, name: 'clip.mp4', bytes: MP4 })
    expect((await board(app)).items[0]).toMatchObject({
      kind: 'video',
      size: { width: 320, height: 180 },
    })
  })

  it('keeps prompt cards as drafts until they are submitted', async () => {
    const { fetchFn } = fakeFetch({ 'https://cdn.higgsfield.ai/r.png': { body: PNG } })
    const { app } = createTestApp({ fetch: fetchFn })
    const { ids } = await upload({ app })
    const created = await request(app)
      .post('/api/generations')
      .send({ submit: false, position: { x: 500, y: 40 }, referenceItemIds: ids })
    expect(created.status).toBe(201)
    const id = (created.body as { id: string }).id
    expect((await request(app).get('/api/generations?status=pending')).body).toHaveLength(0)
    expect((await request(app).post(`/api/generations/${id}/submit`)).status).toBe(400)
    expect(
      (
        await request(app)
          .post(`/api/generations/${id}/complete`)
          .send({ results: [{ source: { url: 'https://cdn.higgsfield.ai/r.png' }, model: 'm' }] })
      ).status,
    ).toBe(409)
    expect(
      (
        await request(app)
          .patch(`/api/generations/${id}`)
          .send({ prompt: 'Storm like @1', model: 'nano_banana_pro' })
      ).status,
    ).toBe(204)
    expect(
      (
        await request(app)
          .patch(`/api/generations/${id}`)
          .send({ referenceItemIds: ['itm_x'] })
      ).status,
    ).toBe(404)
    expect((await request(app).patch('/api/generations/gen_x').send({ prompt: 'x' })).status).toBe(
      404,
    )
    const trace = startTrace()
    const submitted = await request(app)
      .post(`/api/generations/${id}/submit`)
      .set('traceparent', formatTraceparent(trace))
    expect(submitted.body).toEqual({ id })
    const details = (await request(app).get(`/api/generations/${id}`)).body as GenerationDetails
    expect(details).toMatchObject({
      status: 'pending',
      traceId: trace.traceId,
      position: { x: 500, y: 40 },
      prompt: 'Storm like @1',
    })
    expect(
      (await request(app).patch(`/api/generations/${id}`).send({ prompt: 'late' })).status,
    ).toBe(409)
    expect(
      (
        await request(app)
          .patch(`/api/generations/${id}`)
          .send({ position: { x: 1, y: 1 }, size: { width: 420, height: 520 } })
      ).status,
    ).toBe(204)
    expect((await request(app).get(`/api/generations/${id}`)).body).toMatchObject({
      size: { width: 420, height: 520 },
    })
    await request(app)
      .post(`/api/generations/${id}/complete`)
      .send({ results: [{ source: { url: 'https://cdn.higgsfield.ai/r.png' }, model: 'm' }] })
    const result = (await board(app)).items.find((item) => item.metadata.origin === 'generated')
    expect(result?.position).toEqual({ x: 389, y: 1 })
    expect((await request(app).post('/api/generations/gen_x/submit')).status).toBe(404)
  })

  it('places API-created requests next to their references and rejects missing ones on submit', async () => {
    const { app } = createTestApp()
    const { ids } = await upload({ app })
    const id = (
      (
        await request(app)
          .post('/api/generations')
          .send({ submit: false, prompt: 'x', referenceItemIds: ids })
      ).body as { id: string }
    ).id
    expect(
      ((await request(app).get(`/api/generations/${id}`)).body as GenerationDetails).position,
    ).toEqual({ x: 378, y: 20 })
    await request(app).delete(`/api/items/${ids[0] ?? ''}`)
    expect((await request(app).post(`/api/generations/${id}/submit`)).status).toBe(404)
    expect((await request(app).post('/api/generations').send({ prompt: '' })).status).toBe(400)
  })

  it('restores deleted items from the trash', async () => {
    const { app, storage } = createTestApp()
    const { ids } = await upload({ app })
    const id = ids[0] ?? ''
    await request(app).delete(`/api/items/${id}`)
    expect(storage.files.has(`${id}.png`)).toBe(false)
    expect((await request(app).post(`/api/items/${id}/restore`)).status).toBe(204)
    expect(storage.files.has(`${id}.png`)).toBe(true)
    expect((await board(app)).items.map((item) => item.id)).toEqual([id])
    expect((await request(app).post(`/api/items/${id}/restore`)).status).toBe(404)
  })
})

describe('storage folders', () => {
  it('reports the media and trash folders and opens them', async () => {
    const { app, opened } = createTestApp()
    const info = await request(app).get('/api/storage').expect(200)
    expect(info.body).toEqual({ media: '/memory/media', trash: '/memory/trash' })
    await request(app).post('/api/storage/open').send({ folder: 'trash' }).expect(204)
    await request(app).post('/api/storage/open').send({ folder: 'nope' }).expect(400)
    expect(opened).toEqual(['/memory/trash'])
  })

  it('reports when the folder cannot be opened', async () => {
    const { app, logs } = createTestApp({ openFails: true })
    const response = await request(app).post('/api/storage/open').send({ folder: 'media' })
    expect(response.status).toBe(502)
    expect(logs.some((record) => record.msg === 'storage.open_failed')).toBe(true)
  })

  it('reveals a media file in its folder', async () => {
    const { app, opened } = createTestApp()
    await request(app).post('/api/storage/reveal').send({ fileName: 'itm_1.png' }).expect(204)
    await request(app).post('/api/storage/reveal').send({}).expect(400)
    expect(opened).toEqual(['/memory/media/itm_1.png'])
  })

  it('reports when the file cannot be revealed', async () => {
    const { app, logs } = createTestApp({ openFails: true })
    const response = await request(app).post('/api/storage/reveal').send({ fileName: 'a.png' })
    expect(response.status).toBe(502)
    expect(logs.some((record) => record.msg === 'storage.reveal_failed')).toBe(true)
  })
})

describe('generation runs', () => {
  it('numbers each Generate run and keeps the prompt sent to the provider', async () => {
    const { fetchFn } = fakeFetch({ 'https://cdn.higgsfield.ai/out.png': { body: PNG } })
    const { app } = createTestApp({ fetch: fetchFn })
    const id = (
      (await request(app).post('/api/generations').send({ prompt: 'Rain' })).body as { id: string }
    ).id
    const result = { source: { url: 'https://cdn.higgsfield.ai/out.png' }, model: 'm' }
    await request(app)
      .post(`/api/generations/${id}/complete`)
      .send({ results: [result, result], providerPrompt: 'Heavy rain at night' })
      .expect(201)
    await request(app).post(`/api/generations/${id}/retry`).expect(204)
    await request(app)
      .post(`/api/generations/${id}/complete`)
      .send({ results: [result] })
      .expect(201)
    const generated = (await board(app)).items.map((item) => item.metadata.generation)
    expect(generated.map((generation) => generation?.run)).toEqual([1, 1, 2])
    expect(generated.map((generation) => generation?.providerPrompt)).toEqual([
      'Heavy rain at night',
      'Heavy rain at night',
      null,
    ])
  })
})

describe('automatic agent', () => {
  const queue = async (app: ReturnType<typeof createTestApp>['app']) =>
    (
      (await request(app).post('/api/generations').send({ prompt: 'Rain', submit: true })).body as {
        id: string
      }
    ).id

  const statusOf = async (params: {
    readonly app: ReturnType<typeof createTestApp>['app']
    readonly id: string
  }) =>
    ((await request(params.app).get(`/api/generations/${params.id}`)).body as { status: string })
      .status

  it('starts the agent for queued requests and fails what it leaves open', async () => {
    const { app, agentRuns } = createTestApp({
      agent: () => Promise.resolve({ exitCode: 1, logFile: 'data/agent/x.log' }),
    })
    const id = await queue(app)
    await vi.waitFor(async () => {
      expect(await statusOf({ app, id })).toBe('failed')
    })
    const details = (await request(app).get(`/api/generations/${id}`)).body as { error: string }
    expect(details.error).toContain('data/agent/x.log')
    await request(app).post(`/api/generations/${id}/retry`).expect(204)
    expect(agentRuns).toEqual([id, id])
  })

  it('leaves finished requests alone and runs one agent per request at a time', async () => {
    const { fetchFn } = fakeFetch({ 'https://cdn.higgsfield.ai/out.png': { body: PNG } })
    const finish: { run: () => void } = { run: () => undefined }
    const { app, agentRuns } = createTestApp({
      fetch: fetchFn,
      agent: () =>
        new Promise((resolve) => {
          finish.run = () => resolve({ exitCode: 0, logFile: '' })
        }),
    })
    const id = await queue(app)
    await request(app).post(`/api/generations/${id}/start`).expect(204)
    await request(app)
      .post(`/api/generations/${id}/progress`)
      .send({ message: 'Uploading references' })
      .expect(204)
    expect(agentRuns).toEqual([id])
    await request(app)
      .post(`/api/generations/${id}/complete`)
      .send({ results: [{ source: { url: 'https://cdn.higgsfield.ai/out.png' }, model: 'm' }] })
      .expect(201)
    finish.run()
    await vi.waitFor(async () => {
      expect(await statusOf({ app, id })).toBe('completed')
    })
  })
})

describe('agent steps', () => {
  it('records the live steps of a run and falls back to the prompt the agent sent', async () => {
    const { fetchFn } = fakeFetch({ 'https://cdn.higgsfield.ai/out.png': { body: PNG } })
    const finish: { run: () => void } = { run: () => undefined }
    const { app } = createTestApp({
      fetch: fetchFn,
      agent: (run) => {
        run.onStep('Starting Claude')
        run.onStep('Generating with nano_banana_pro')
        run.onProviderCall({ model: 'nano_banana_pro', prompt: 'Rain on neon, image 1 style' })
        return new Promise((resolve) => {
          finish.run = () => resolve({ exitCode: 0, logFile: '' })
        })
      },
    })
    const id = (
      (await request(app).post('/api/generations').send({ prompt: 'Rain', submit: true })).body as {
        id: string
      }
    ).id
    const read = async () =>
      (await request(app).get(`/api/generations/${id}`)).body as GenerationRequest
    await vi.waitFor(async () => {
      expect((await read()).steps.map((step) => step.label)).toEqual([
        'Starting Claude',
        'Generating with nano_banana_pro',
      ])
    })
    expect((await read()).steps.at(-1)?.endedAt).toBeNull()
    await request(app)
      .post(`/api/generations/${id}/complete`)
      .send({ results: [{ source: { url: 'https://cdn.higgsfield.ai/out.png' }, model: 'm' }] })
      .expect(201)
    finish.run()
    const done = await read()
    expect(done.finishedAt).not.toBeNull()
    expect(done.steps.every((step) => step.endedAt !== null)).toBe(true)
    expect((await board(app)).items[0]?.metadata.generation?.providerPrompt).toBe(
      'Rain on neon, image 1 style',
    )
    await request(app).post(`/api/generations/${id}/retry`).expect(204)
    expect((await read()).finishedAt).toBeNull()
  })

  it('ignores steps for a request that is gone', async () => {
    const { app, logs } = createTestApp({
      agent: async (run) => {
        await request(app).delete(`/api/generations/${run.generationId}`)
        run.onStep('Reading the request')
        return { exitCode: 0, logFile: '' }
      },
    })
    await request(app).post('/api/generations').send({ prompt: 'Rain', submit: true }).expect(201)
    await vi.waitFor(() => {
      expect(logs.some((record) => record.msg === 'agent.finished')).toBe(true)
    })
    expect((await request(app).get('/api/generations')).body).toEqual([])
  })
})

describe('provider uploads', () => {
  it('remembers uploaded media ids so later requests reuse them', async () => {
    const { fetchFn } = fakeFetch({ 'https://cdn.higgsfield.ai/out.png': { body: PNG } })
    const { app } = createTestApp({ fetch: fetchFn })
    const itemId = (await upload({ app })).ids[0] ?? ''
    const create = async () =>
      (
        (
          await request(app)
            .post('/api/generations')
            .send({ prompt: 'Rain @1', referenceItemIds: [itemId], submit: true })
        ).body as { id: string }
      ).id
    const first = await create()
    await request(app)
      .post(`/api/generations/${first}/complete`)
      .send({
        results: [{ source: { url: 'https://cdn.higgsfield.ai/out.png' }, model: 'm' }],
        uploads: [{ itemId, mediaId: 'hf-media-1' }],
      })
      .expect(201)
    const second = await create()
    const details = (await request(app).get(`/api/generations/${second}`)).body as {
      resolvedReferences: { providerMediaIds: Record<string, string> }[]
    }
    expect(details.resolvedReferences[0]?.providerMediaIds).toEqual({ higgsfield: 'hf-media-1' })
  })
})

describe('prompt guides', () => {
  const guideOf = async (params: {
    readonly app: ReturnType<typeof createTestApp>['app']
    readonly body: Record<string, unknown>
  }) => {
    const created = await request(params.app)
      .post('/api/generations')
      .send({ prompt: 'Rain', ...params.body })
    const id = (created.body as { id: string }).id
    return ((await request(params.app).get(`/api/generations/${id}`)).body as GenerationDetails)
      .promptGuide
  }

  it('picks the guide of the selected model, defaulting per kind', async () => {
    const { app } = createTestApp()
    expect(await guideOf({ app, body: { kind: 'image', model: null } })).toEqual({
      model: 'nano_banana_pro',
      guide: 'nano_banana_pro',
      content: TEST_GUIDES.nano_banana_pro,
    })
    expect(await guideOf({ app, body: { kind: 'video' } })).toEqual({
      model: 'seedance_2_5',
      guide: 'seedance_2_5',
      content: TEST_GUIDES.seedance_2_5,
    })
    expect(await guideOf({ app, body: { kind: 'image', model: 'flux_3_image' } })).toEqual({
      model: 'flux_3_image',
      guide: 'default',
      content: TEST_GUIDES.default,
    })
  })

  it('returns every setting of the model, keeping valid card choices', async () => {
    const { app } = createTestApp()
    const created = await request(app)
      .post('/api/generations')
      .send({
        prompt: 'Rain',
        kind: 'video',
        model: 'seedance_2_5',
        options: { duration: 12, resolution: '4k', generate_audio: false },
      })
    const id = (created.body as { id: string }).id
    const details = (await request(app).get(`/api/generations/${id}`)).body as GenerationDetails
    expect(details.resolvedOptions).toEqual({
      duration: 12,
      resolution: '1080p',
      bitrate_mode: 'high',
      generate_audio: false,
    })
  })

  it('stores the guide used on the result items', async () => {
    const { fetchFn } = fakeFetch({ 'https://cdn.higgsfield.ai/out.png': { body: PNG } })
    const { app } = createTestApp({ fetch: fetchFn })
    const id = (
      (await request(app).post('/api/generations').send({ prompt: 'Rain' })).body as { id: string }
    ).id
    await request(app)
      .post(`/api/generations/${id}/complete`)
      .send({
        results: [
          { source: { url: 'https://cdn.higgsfield.ai/out.png' }, model: 'nano_banana_pro' },
        ],
        promptGuide: 'nano_banana_pro',
      })
      .expect(201)
    expect((await board(app)).items[0]?.metadata.generation?.promptGuide).toBe('nano_banana_pro')
  })
})
