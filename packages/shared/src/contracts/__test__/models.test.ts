import { describe, expect, it } from 'vitest'
import { DEFAULT_MODELS, MODELS, modelSpecOf, modelsOfKind, resolveOptions } from '../models.ts'

describe('model catalog', () => {
  it('offers three image models and Seedance 2.5 for video', () => {
    expect(modelsOfKind('image').map((model) => model.id)).toEqual([
      'nano_banana_pro',
      'gpt_image_2_5',
      'flux_3_image',
    ])
    expect(modelsOfKind('video').map((model) => model.id)).toEqual(['seedance_2_5'])
  })

  it('defaults each kind to an offered model whose setting defaults are valid', () => {
    expect(modelSpecOf(DEFAULT_MODELS.image)?.kind).toBe('image')
    expect(modelSpecOf(DEFAULT_MODELS.video)?.kind).toBe('video')
    for (const model of MODELS) {
      const defaults = resolveOptions({ model: model.id, options: {} })
      expect(resolveOptions({ model: model.id, options: defaults })).toEqual(defaults)
    }
  })
})

describe('resolveOptions', () => {
  it('fills defaults and keeps valid choices', () => {
    expect(
      resolveOptions({
        model: 'gpt_image_2_5',
        options: { quality: 'max', background: 'transparent' },
      }),
    ).toEqual({ variant: 'flare', quality: 'max', resolution: '2k', background: 'transparent' })
  })

  it('drops values another model would take and settings the model does not have', () => {
    expect(
      resolveOptions({
        model: 'nano_banana_pro',
        options: { resolution: '1080p', quality: 'max' },
      }),
    ).toEqual({ resolution: '2k' })
  })

  it('accepts whole durations in range only', () => {
    const duration = (value: number) =>
      resolveOptions({ model: 'seedance_2_5', options: { duration: value } }).duration
    expect(duration(30)).toBe(30)
    expect(duration(31)).toBe(5)
    expect(duration(7.5)).toBe(5)
  })

  it('returns no settings for an unknown model', () => {
    expect(resolveOptions({ model: 'kling3_0', options: { duration: 10 } })).toEqual({})
  })
})
