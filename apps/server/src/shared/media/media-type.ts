import type { ItemKind } from '@inspiratio/shared'
import { imageSize } from 'image-size'

export type MediaType = {
  readonly kind: ItemKind
  readonly mimeType: string
  readonly extension: string
}

const startsWith = (params: {
  readonly bytes: Uint8Array
  readonly signature: readonly number[]
  readonly offset?: number
}): boolean => {
  const offset = params.offset ?? 0
  return [...params.signature.entries()].every(
    ([index, byte]) => params.bytes[offset + index] === byte,
  )
}

const ascii = (text: string): number[] => Array.from(text, (char) => char.charCodeAt(0))

const readAscii = (params: {
  readonly bytes: Uint8Array
  readonly from: number
  readonly to: number
}): string => String.fromCharCode(...params.bytes.slice(params.from, params.to))

const SIGNATURES: readonly {
  readonly test: (bytes: Uint8Array) => boolean
  readonly type: MediaType
}[] = [
  {
    test: (bytes) => startsWith({ bytes, signature: [0x89, 0x50, 0x4e, 0x47] }),
    type: { kind: 'image', mimeType: 'image/png', extension: 'png' },
  },
  {
    test: (bytes) => startsWith({ bytes, signature: [0xff, 0xd8, 0xff] }),
    type: { kind: 'image', mimeType: 'image/jpeg', extension: 'jpg' },
  },
  {
    test: (bytes) => startsWith({ bytes, signature: ascii('GIF8') }),
    type: { kind: 'image', mimeType: 'image/gif', extension: 'gif' },
  },
  {
    test: (bytes) =>
      startsWith({ bytes, signature: ascii('RIFF') }) &&
      startsWith({ bytes, signature: ascii('WEBP'), offset: 8 }),
    type: { kind: 'image', mimeType: 'image/webp', extension: 'webp' },
  },
  {
    test: (bytes) => startsWith({ bytes, signature: [0x1a, 0x45, 0xdf, 0xa3] }),
    type: { kind: 'video', mimeType: 'video/webm', extension: 'webm' },
  },
]

const ftypType = (bytes: Uint8Array): MediaType | null => {
  if (!startsWith({ bytes, signature: ascii('ftyp'), offset: 4 })) return null
  const brand = readAscii({ bytes, from: 8, to: 12 })
  if (brand === 'avif' || brand === 'avis')
    return { kind: 'image', mimeType: 'image/avif', extension: 'avif' }
  if (brand === 'qt  ') return { kind: 'video', mimeType: 'video/quicktime', extension: 'mov' }
  return { kind: 'video', mimeType: 'video/mp4', extension: 'mp4' }
}

/** Detects the media type from magic bytes; never trusts file names or Content-Type headers. */
export const detectMediaType = (bytes: Uint8Array): MediaType | null =>
  SIGNATURES.find((signature) => signature.test(bytes))?.type ?? ftypType(bytes)

export const probeImageDimensions = (
  bytes: Uint8Array,
): { readonly width: number; readonly height: number } | null => {
  try {
    const { width, height } = imageSize(bytes)
    return width > 0 && height > 0 ? { width, height } : null
  } catch {
    return null
  }
}
