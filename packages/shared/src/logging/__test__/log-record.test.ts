import { describe, expect, it } from 'vitest'
import { emptyLibraryState } from '../../contracts/board.ts'
import { mediaUrlOf } from '../../contracts/item.ts'
import { UpdateTagSchema } from '../../contracts/tag.ts'
import { err, notFound, ok } from '../../lib/result.ts'
import { isLevelEnabled, serializeError } from '../log-record.ts'

describe('log levels', () => {
  it('enables levels at or above the minimum', () => {
    expect(isLevelEnabled({ level: 'error', minLevel: 'info' })).toBe(true)
    expect(isLevelEnabled({ level: 'debug', minLevel: 'info' })).toBe(false)
  })

  it('serialises errors and other thrown values', () => {
    expect(serializeError(new TypeError('boom'))).toMatchObject({
      name: 'TypeError',
      message: 'boom',
    })
    expect(serializeError('plain')).toEqual({ message: 'plain' })
  })
})

describe('shared contracts helpers', () => {
  it('builds results', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 })
    expect(err({ code: 'conflict', message: 'x' }).ok).toBe(false)
    expect(notFound({ entity: 'Item', id: 'a' }).error).toEqual({
      code: 'not_found',
      message: 'Item a not found',
    })
  })

  it('builds media urls and empty state', () => {
    expect(mediaUrlOf({ fileName: 'a b.png' })).toBe('/media/a%20b.png')
    expect(emptyLibraryState()).toEqual({
      version: 1,
      items: [],
      tags: [],
      sections: [],
      generations: [],
    })
  })

  it('rejects empty tag patches', () => {
    expect(UpdateTagSchema.safeParse({}).success).toBe(false)
    expect(UpdateTagSchema.safeParse({ name: '  Film   noir ' }).data).toEqual({
      name: 'Film noir',
    })
  })
})

describe('parseJsonBody', () => {
  it('handles empty, JSON and non-JSON bodies', async () => {
    const { parseJsonBody } = await import('../../lib/json.ts')
    expect(parseJsonBody('')).toBeUndefined()
    expect(parseJsonBody('{"a":1}')).toEqual({ a: 1 })
    expect(parseJsonBody('<html>')).toBe('<html>')
  })
})
