import { existsSync } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import sharp from 'sharp'

export type UploadSource = {
  readonly absolutePath: string
  readonly mimeType: string
}

export type UploadFile = { readonly path: string; readonly mimeType: string }

/** Port that hands agents a file small enough for provider uploads, keeping the original intact. */
export type UploadPreparer = (source: UploadSource) => Promise<UploadFile>

export const UPLOAD_MAX_EDGE = 2048
export const UPLOAD_MAX_BYTES = 8 * 1024 * 1024

const RESIZABLE = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/tiff'])

export const needsUploadCopy = (params: {
  readonly mimeType: string
  readonly bytes: number
  readonly width: number
  readonly height: number
}): boolean =>
  RESIZABLE.has(params.mimeType) &&
  (params.bytes > UPLOAD_MAX_BYTES || Math.max(params.width, params.height) > UPLOAD_MAX_EDGE)

export const createSharpUploadPreparer = async (params: {
  readonly cacheDir: string
}): Promise<UploadPreparer> => {
  await mkdir(params.cacheDir, { recursive: true })
  return async (source) => {
    const original = { path: source.absolutePath, mimeType: source.mimeType }
    if (!RESIZABLE.has(source.mimeType) || !existsSync(source.absolutePath)) return original
    const target = join(
      params.cacheDir,
      `${basename(source.absolutePath, extname(source.absolutePath))}.jpg`,
    )
    const copy = { path: target, mimeType: 'image/jpeg' }
    const info = await stat(source.absolutePath)
    if (existsSync(target) && (await stat(target)).mtimeMs >= info.mtimeMs) return copy
    const meta = await sharp(source.absolutePath).metadata()
    const large = needsUploadCopy({
      mimeType: source.mimeType,
      bytes: info.size,
      width: meta.width,
      height: meta.height,
    })
    if (!large) return original
    await sharp(source.absolutePath)
      .rotate()
      .resize({ width: UPLOAD_MAX_EDGE, height: UPLOAD_MAX_EDGE, fit: 'inside' })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 90 })
      .toFile(target)
    return copy
  }
}

export const keepOriginalUpload: UploadPreparer = (source) =>
  Promise.resolve({ path: source.absolutePath, mimeType: source.mimeType })
