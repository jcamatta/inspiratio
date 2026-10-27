import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createSharpUploadPreparer,
  keepOriginalUpload,
  needsUploadCopy,
  UPLOAD_MAX_EDGE,
} from '../media/upload-copy.ts'

const png = (params: { readonly width: number; readonly height: number }) =>
  sharp({
    create: { ...params, channels: 3, background: { r: 20, g: 120, b: 90 } },
  })
    .png()
    .toBuffer()

describe('upload copies', () => {
  let dir = ''
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'inspiratio-upload-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('decides which files need a copy', () => {
    const base = { mimeType: 'image/png', bytes: 1000, width: 100, height: 100 }
    expect(needsUploadCopy(base)).toBe(false)
    expect(needsUploadCopy({ ...base, height: 3000 })).toBe(true)
    expect(needsUploadCopy({ ...base, bytes: 9 * 1024 * 1024 })).toBe(true)
    expect(needsUploadCopy({ ...base, mimeType: 'video/mp4', height: 3000 })).toBe(false)
  })

  it('resizes large images into a cached JPEG and leaves small ones alone', async () => {
    const prepare = await createSharpUploadPreparer({ cacheDir: join(dir, 'cache') })
    const large = join(dir, 'large.png')
    const small = join(dir, 'small.png')
    await writeFile(large, await png({ width: 3000, height: 1500 }))
    await writeFile(small, await png({ width: 64, height: 64 }))

    const copy = await prepare({ absolutePath: large, mimeType: 'image/png' })
    expect(copy).toEqual({ path: join(dir, 'cache', 'large.jpg'), mimeType: 'image/jpeg' })
    const meta = await sharp(copy.path).metadata()
    expect(Math.max(meta.width, meta.height)).toBe(UPLOAD_MAX_EDGE)
    const firstWrite = (await stat(copy.path)).mtimeMs
    await prepare({ absolutePath: large, mimeType: 'image/png' })
    expect((await stat(copy.path)).mtimeMs).toBe(firstWrite)

    expect(await prepare({ absolutePath: small, mimeType: 'image/png' })).toEqual({
      path: small,
      mimeType: 'image/png',
    })
    const video = { absolutePath: join(dir, 'clip.mp4'), mimeType: 'video/mp4' }
    expect(await prepare(video)).toEqual({ path: video.absolutePath, mimeType: 'video/mp4' })
    const missing = { absolutePath: join(dir, 'gone.png'), mimeType: 'image/png' }
    expect(await prepare(missing)).toEqual({ path: missing.absolutePath, mimeType: 'image/png' })
    expect(await keepOriginalUpload(missing)).toEqual({
      path: missing.absolutePath,
      mimeType: 'image/png',
    })
  })
})
