import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createExpressApp } from '../http/express-adapter.ts'
import type { Route } from '../http/http.types.ts'
import { silentLogger } from '../logging/logger.ts'

const build = (params: {
  readonly routes: readonly Route[]
  readonly webDistDir?: string | null
  readonly mediaDir?: string
}) =>
  createExpressApp({
    routes: params.routes,
    logger: silentLogger(),
    mediaDir: params.mediaDir ?? tmpdir(),
    webDistDir: params.webDistDir ?? null,
    maxUploadBytes: 8,
  })

describe('express adapter', () => {
  it('maps thrown handler errors to a 500 with the trace id', async () => {
    const app = build({
      routes: [
        { method: 'get', path: '/api/boom', handler: () => Promise.reject(new Error('kaput')) },
      ],
    })
    const response = await request(app).get('/api/boom')
    expect(response.status).toBe(500)
    expect(response.body.error).toMatchObject({ code: 'upstream', traceId: expect.any(String) })
  })

  it('rejects uploads over the size limit', async () => {
    const app = build({
      routes: [
        {
          method: 'post',
          path: '/api/up',
          upload: true,
          handler: () => Promise.resolve({ status: 204 }),
        },
      ],
    })
    const response = await request(app).post('/api/up').attach('files', Buffer.alloc(64), 'big.png')
    expect(response.status).toBe(400)
    expect(response.body.error.message).toBe('File too large')
  })

  it('serves the built web app with SPA fallback and media files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'inspiratio-web-'))
    await mkdir(join(dir, 'media'))
    await writeFile(join(dir, 'index.html'), '<!doctype html><title>app</title>')
    await writeFile(join(dir, 'media', 'a.txt'), 'media')
    const app = build({ routes: [], webDistDir: dir, mediaDir: join(dir, 'media') })
    expect((await request(app).get('/boards/1')).text).toContain('<title>app</title>')
    expect((await request(app).get('/media/a.txt')).text).toBe('media')
  })
})
