import type { Item } from '@inspiratio/shared'
import { describe, expect, it } from 'vitest'
import { makeGeneration, makeItem } from '../../../../__test__/fake-api.ts'
import { dimOutside, lineageOf, NO_LINEAGE, runSlots } from '../lineage.ts'

const result = (params: { readonly id: string; readonly run: number }): Item => {
  const base = makeItem({ id: params.id })
  return {
    ...base,
    metadata: {
      ...base.metadata,
      origin: 'generated',
      generation: {
        requestId: 'gen_1',
        provider: 'higgsfield',
        model: 'm',
        prompt: 'p',
        providerPrompt: null,
        run: params.run,
        promptGuide: null,
        referenceItemIds: ['ref_a'],
      },
    },
  }
}

const items = [
  makeItem({ id: 'ref_a' }),
  makeItem({ id: 'ref_b' }),
  result({ id: 'out_1', run: 1 }),
  result({ id: 'out_2', run: 2 }),
  result({ id: 'out_3', run: 2 }),
]
const generations = [
  makeGeneration({
    id: 'gen_1',
    status: 'completed',
    references: [
      { itemId: 'ref_a', label: '@1' },
      { itemId: 'gone', label: '@2' },
    ],
    resultItemIds: ['out_1', 'out_2', 'out_3'],
  }),
  makeGeneration({ id: 'gen_2', references: [{ itemId: 'ref_a', label: '@1' }] }),
]

const ids = (focus: readonly string[]) =>
  lineageOf({ focus, items, generations })
    .edges.map((edge) => edge.id)
    .sort()

describe('lineage', () => {
  it('groups results by run', () => {
    const slots = runSlots({ request: generations[0] ?? makeGeneration({ id: 'x' }), items })
    expect([...slots.values()]).toEqual([
      { run: 1, index: 1, size: 1 },
      { run: 2, index: 1, size: 2 },
      { run: 2, index: 2, size: 2 },
    ])
  })

  it('shows a prompt with its whole chain and labels variants by run', () => {
    const lineage = lineageOf({ focus: ['gen_1'], items, generations })
    expect(lineage.edges.map((edge) => edge.id).sort()).toEqual([
      'out:gen_1:out_1',
      'out:gen_1:out_2',
      'out:gen_1:out_3',
      'ref:ref_a:gen_1',
    ])
    expect(lineage.edges.map((edge) => edge.label)).toEqual([
      undefined,
      'Run 1',
      'Run 2 · 1/2',
      'Run 2 · 2/2',
    ])
  })

  it('shows only the branch of a selected result', () => {
    expect(ids(['out_2'])).toEqual(['out:gen_1:out_2', 'ref:ref_a:gen_1'])
  })

  it('shows every prompt a reference fed', () => {
    expect(ids(['ref_a'])).toContain('ref:ref_a:gen_2')
    expect(ids(['ref_a'])).toHaveLength(5)
  })

  it('labels variants of a single run without the run number', () => {
    const single = [result({ id: 'out_1', run: 1 }), result({ id: 'out_2', run: 1 })]
    const request = makeGeneration({ id: 'gen_1', resultItemIds: ['out_1', 'out_2'] })
    const lineage = lineageOf({ focus: ['gen_1'], items: single, generations: [request] })
    expect(lineage.edges.map((edge) => edge.label)).toEqual(['1/2', '2/2'])
  })

  it('dims nodes outside the lineage and leaves unrelated focus alone', () => {
    expect(lineageOf({ focus: [], items, generations })).toBe(NO_LINEAGE)
    expect(lineageOf({ focus: ['ref_b'], items, generations })).toBe(NO_LINEAGE)
    const nodes = [{ id: 'gen_1' }, { id: 'ref_b' }]
    expect(dimOutside({ nodes, lineage: NO_LINEAGE })).toBe(nodes)
    const lineage = lineageOf({ focus: ['gen_1'], items, generations })
    expect(dimOutside({ nodes, lineage })).toEqual([
      { id: 'gen_1' },
      { id: 'ref_b', className: 'lineage-dim' },
    ])
  })
})
