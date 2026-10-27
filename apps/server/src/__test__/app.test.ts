import {
  formatTraceparent,
  startTrace,
  type BoardSnapshot,
  type GenerationDetails,
  type GenerationRequest,
} from '@inspiratio/shared'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createTestApp, fakeFetch, MP4, PNG } from './harness.ts'

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
    expect((await request(app).post(`/api/generations/${id}/start`)).status).toBe(204)
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
    expect((await request(app).delete(`/api/generations/${id}`)).status).toBe(204)
    expect((await request(app).get(`/api/generations/${id}`)).status).toBe(404)
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
          .send({ position: { x: 1, y: 1 } })
      ).status,
    ).toBe(204)
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
