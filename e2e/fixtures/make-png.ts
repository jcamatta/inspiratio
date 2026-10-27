import { deflateSync } from 'node:zlib'

/** Minimal PNG encoder for test fixtures: a diagonal two-colour gradient. */
const CRC_TABLE = [...Array(256).keys()].map((n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

const crc32 = (bytes: Buffer): number => {
  let crc = 0xffffffff
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

const chunk = (params: { readonly type: string; readonly data: Buffer }): Buffer => {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(params.data.length)
  const body = Buffer.concat([Buffer.from(params.type, 'ascii'), params.data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

export type Rgb = readonly [number, number, number]

export const makePng = (params: {
  readonly width: number
  readonly height: number
  readonly from: Rgb
  readonly to: Rgb
}): Buffer => {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(params.width, 0)
  header.writeUInt32BE(params.height, 4)
  header.writeUInt8(8, 8) // bit depth
  header.writeUInt8(2, 9) // colour type: RGB
  const rows: Buffer[] = []
  for (let y = 0; y < params.height; y += 1) {
    const row = Buffer.alloc(1 + params.width * 3)
    for (let x = 0; x < params.width; x += 1) {
      const t = (x / params.width + y / params.height) / 2
      for (let channel = 0; channel < 3; channel += 1) {
        const from = params.from[channel] ?? 0
        const to = params.to[channel] ?? 0
        row.writeUInt8(Math.round(from + (to - from) * t), 1 + x * 3 + channel)
      }
    }
    rows.push(row)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk({ type: 'IHDR', data: header }),
    chunk({ type: 'IDAT', data: deflateSync(Buffer.concat(rows)) }),
    chunk({ type: 'IEND', data: Buffer.alloc(0) }),
  ])
}
