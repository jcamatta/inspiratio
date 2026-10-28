import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createFsPromptGuideReader, createMemoryPromptGuideReader } from '../prompt-guide-reader.ts'

describe('fs prompt guide reader', () => {
  let dir = ''
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'inspiratio-guides-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('reads the model guide when its file exists', async () => {
    await writeFile(join(dir, 'kling3_0.md'), '# Kling')
    await writeFile(join(dir, 'default.md'), '# Default')
    const read = createFsPromptGuideReader({ dir })
    expect(await read({ model: 'kling3_0' })).toEqual({ guide: 'kling3_0', content: '# Kling' })
  })

  it('falls back to default.md for a model without a guide', async () => {
    await writeFile(join(dir, 'default.md'), '# Default')
    const read = createFsPromptGuideReader({ dir })
    expect(await read({ model: 'unknown_model' })).toEqual({
      guide: 'default',
      content: '# Default',
    })
    expect(await read({ model: '../default' })).toEqual({ guide: 'default', content: '# Default' })
  })

  it('returns an empty default guide when no file exists', async () => {
    const read = createFsPromptGuideReader({ dir: join(dir, 'missing') })
    expect(await read({ model: 'soul_2' })).toEqual({ guide: 'default', content: '' })
  })
})

describe('memory prompt guide reader', () => {
  it('follows the same fallback order', async () => {
    const read = createMemoryPromptGuideReader({ guides: { soul_2: 'soul', default: 'base' } })
    expect(await read({ model: 'soul_2' })).toEqual({ guide: 'soul_2', content: 'soul' })
    expect(await read({ model: 'x' })).toEqual({ guide: 'default', content: 'base' })
    expect(await createMemoryPromptGuideReader({ guides: {} })({ model: 'x' })).toEqual({
      guide: 'default',
      content: '',
    })
  })
})
