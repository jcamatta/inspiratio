import { describe, expect, it } from 'vitest'
import { makeGeneration } from '../../../../__test__/fake-api.ts'
import { finishedIds, isActive, pollInterval } from '../../generation.hooks.ts'
import {
  addReferences,
  claudeInstruction,
  danglingTokens,
  dropReferences,
  insertToken,
  labelOf,
  mentionedTokens,
  modelsFor,
  removeReference,
} from '../prompt.ts'

describe('prompt tokens', () => {
  it('labels and adds references up to the limit', () => {
    expect(labelOf(0)).toBe('@1')
    expect(addReferences({ references: ['a'], itemIds: ['a', 'b'] })).toEqual(['a', 'b'])
    expect(
      addReferences({
        references: [],
        itemIds: [...Array(20).keys()].map(String),
      }),
    ).toHaveLength(14)
  })

  it('inserts tokens at the caret with spacing', () => {
    expect(insertToken({ prompt: '', token: '@1', caret: null })).toBe('@1 ')
    expect(insertToken({ prompt: 'like  that', token: '@1', caret: 4 })).toBe('like @1 that')
    expect(insertToken({ prompt: 'a\n', token: '@2', caret: 99 })).toBe('a\n@2 ')
    expect(insertToken({ prompt: 'ab', token: '@3', caret: -5 })).toBe('@3 ab')
  })

  it('drops references without duplicating mentioned tokens', () => {
    expect(
      dropReferences({ prompt: 'use @1', references: ['a'], itemIds: ['a'], caret: null }),
    ).toEqual({ prompt: 'use @1', references: ['a'] })
    expect(
      dropReferences({ prompt: 'use', references: ['a'], itemIds: ['b'], caret: null }),
    ).toEqual({ prompt: 'use @2 ', references: ['a', 'b'] })
  })

  it('removes references and renumbers higher tokens', () => {
    expect(
      removeReference({
        prompt: '@1 lit like @2 and @3',
        references: ['a', 'b', 'c'],
        itemId: 'b',
      }),
    ).toEqual({
      prompt: '@1 lit like and @2',
      references: ['a', 'c'],
    })
    expect(removeReference({ prompt: 'x', references: ['a'], itemId: 'z' })).toEqual({
      prompt: 'x',
      references: ['a'],
    })
  })

  it('finds mentioned and dangling tokens', () => {
    expect(mentionedTokens('@1 and @12 but not email@x')).toEqual(['@1', '@12'])
    expect(danglingTokens({ prompt: '@0 @1 @3 @3', referenceCount: 2 })).toEqual(['@0', '@3'])
  })

  it('offers models per kind and builds the Claude instruction', () => {
    expect(modelsFor('video').every((option) => option.kind !== 'image')).toBe(true)
    expect(modelsFor('image')[0]?.value).toBe('auto')
    expect(claudeInstruction('gen_1')).toContain('gen_1')
  })
})

describe('generation polling', () => {
  it('polls quickly only while requests are active', () => {
    expect(isActive(makeGeneration({ id: 'a', status: 'in_progress' }))).toBe(true)
    expect(pollInterval([makeGeneration({ id: 'a' })])).toBe(2500)
    expect(pollInterval([makeGeneration({ id: 'a', status: 'failed' })])).toBe(15000)
    expect(
      finishedIds([makeGeneration({ id: 'a', status: 'completed' }), makeGeneration({ id: 'b' })]),
    ).toBe('a')
  })
})
