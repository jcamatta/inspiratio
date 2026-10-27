import type { NodeChange } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { makeGeneration, makeItem, makeSection, makeTag } from '../../../../__test__/fake-api.ts'
import {
  absolutePosition,
  applyReparenting,
  containingSection,
  hoveredPrompt,
  isDragging,
  isMediaNode,
  isPromptNode,
  planPersistence,
  referenceLabelsOf,
  revertPositions,
  selectedItemIds,
  sizeOf,
  tagsOfItem,
  toFlowNodes,
  type BoardNode,
  type MediaFlowNode,
} from '../flow-mapping.ts'
import { inverseLayout, inverseSectionPatch, sectionChildren } from '../undo.ts'

const board = {
  items: [
    makeItem({ id: 'itm_a', tagIds: ['tag_noir'], position: { x: 10, y: 10 } }),
    makeItem({ id: 'itm_b', sectionId: 'sec_1', position: { x: 20, y: 20 } }),
    makeItem({ id: 'itm_c', sectionId: 'sec_gone' }),
  ],
  tags: [makeTag({ id: 'tag_noir', name: 'Noir' })],
  sections: [
    makeSection({ id: 'sec_1', position: { x: 500, y: 500 }, size: { width: 400, height: 300 } }),
  ],
}

const generations = [
  makeGeneration({
    id: 'gen_draft',
    status: 'draft',
    position: { x: 2000, y: 0 },
    references: [{ itemId: 'itm_b', label: '@1' }],
  }),
  makeGeneration({
    id: 'gen_done',
    status: 'completed',
    position: { x: 4000, y: 0 },
    resultItemIds: ['itm_a'],
  }),
]

const nodes = (): BoardNode[] =>
  toFlowNodes({
    board,
    generations,
    selection: ['itm_c'],
    dropTargetId: 'gen_draft',
    previous: [],
  }).map((node) => (isPromptNode(node) ? { ...node, height: 400 } : node))

const media = ({
  list,
  id,
}: {
  readonly list: BoardNode[]
  readonly id: string
}): MediaFlowNode => {
  const node = list.find((candidate) => candidate.id === id)
  if (node === undefined || !isMediaNode(node)) throw new Error(`no media node ${id}`)
  return node
}

const change = (value: NodeChange<BoardNode>) => value

describe('toFlowNodes', () => {
  it('orders sections, items then prompt cards and decorates them', () => {
    const list = nodes()
    expect(list.map((node) => node.id)).toEqual([
      'sec_1',
      'itm_a',
      'itm_b',
      'itm_c',
      'gen_draft',
      'gen_done',
    ])
    expect(media({ list, id: 'itm_b' }).parentId).toBe('sec_1')
    expect(media({ list, id: 'itm_c' }).parentId).toBeUndefined()
    expect(media({ list, id: 'itm_c' }).selected).toBe(true)
    expect(media({ list, id: 'itm_b' }).data.referenceLabels).toEqual(['@1'])
    expect(media({ list, id: 'itm_a' }).data.tags.map((tag) => tag.name)).toEqual(['Noir'])
    const draft = list.find((node) => node.id === 'gen_draft')
    expect(draft !== undefined && isPromptNode(draft) && draft.data).toMatchObject({
      dropActive: true,
      references: [{ id: 'itm_b' }],
    })
    const done = list.find((node) => node.id === 'gen_done')
    expect(
      done !== undefined && isPromptNode(done) && done.data.results.map((item) => item.id),
    ).toEqual(['itm_a'])
  })

  it('keeps local selection and positions of nodes being dragged', () => {
    const previous = nodes().map((node) =>
      ['itm_a', 'sec_1', 'gen_draft'].includes(node.id)
        ? { ...node, selected: true, dragging: true, position: { x: 1, y: 1 } }
        : node,
    )
    const next = toFlowNodes({ board, generations, selection: [], dropTargetId: null, previous })
    for (const id of ['itm_a', 'sec_1', 'gen_draft'])
      expect(next.find((node) => node.id === id)).toMatchObject({
        selected: true,
        position: { x: 1, y: 1 },
      })
    expect(selectedItemIds(next)).toEqual(['itm_a', 'itm_c'])
  })

  it('resolves tags and labels defensively', () => {
    expect(
      tagsOfItem({ item: makeItem({ id: 'x', tagIds: ['missing'] }), tags: board.tags }),
    ).toEqual([])
    expect(referenceLabelsOf({ itemId: 'itm_a', generations })).toEqual([])
  })
})

describe('geometry', () => {
  it('reads sizes and absolute positions', () => {
    const list = nodes()
    const node = media({ list, id: 'itm_a' })
    expect(sizeOf(node)).toEqual({ width: 320, height: 180 })
    expect(
      sizeOf({ ...node, width: undefined, height: undefined, measured: { width: 5, height: 6 } }),
    ).toEqual({ width: 5, height: 6 })
    expect(sizeOf({ ...node, width: undefined, height: undefined })).toEqual({
      width: 0,
      height: 0,
    })
    expect(absolutePosition({ node: media({ list, id: 'itm_b' }), nodes: list })).toEqual({
      x: 520,
      y: 520,
    })
    expect(containingSection({ node: media({ list, id: 'itm_b' }), nodes: list })?.id).toBe('sec_1')
  })
})

describe('planPersistence', () => {
  it('ignores in-progress changes and unknown nodes', () => {
    const plan = planPersistence({
      changes: [
        change({ type: 'position', id: 'itm_a', dragging: true, position: { x: 1, y: 1 } }),
        change({ type: 'select', id: 'itm_a', selected: true }),
        change({ type: 'position', id: 'ghost', dragging: false }),
        change({
          type: 'dimensions',
          id: 'gen_draft',
          resizing: true,
          dimensions: { width: 1, height: 1 },
        }),
      ],
      nodes: nodes(),
    })
    expect(plan).toEqual({ items: [], sections: [], prompts: [], drops: [] })
  })

  it('persists drags, section moves, prompt moves and reference drops', () => {
    const list = nodes().map((node) => {
      if (node.id === 'itm_a') return { ...node, position: { x: 600.123, y: 600 } }
      if (node.id === 'itm_b') return { ...node, position: { x: 1510, y: -450 } }
      if (node.id === 'itm_c') return { ...node, position: { x: 2050, y: 100 } }
      return node
    })
    const plan = planPersistence({
      changes: ['itm_a', 'itm_b', 'itm_c', 'sec_1', 'gen_done'].map((id) =>
        change({ type: 'position', id, dragging: false }),
      ),
      nodes: list,
    })
    expect(plan.items).toEqual([
      { id: 'itm_a', position: { x: 100.12, y: 100 }, sectionId: 'sec_1' },
    ])
    expect(plan.drops).toEqual([{ promptId: 'gen_draft', itemIds: ['itm_b', 'itm_c'] }])
    expect(plan.sections).toEqual([{ id: 'sec_1', position: { x: 500, y: 500 } }])
    expect(plan.prompts).toEqual([{ id: 'gen_done', position: { x: 4000, y: 0 } }])
  })

  it('moves items out of sections and keeps unchanged parents', () => {
    const list = nodes().map((node) =>
      node.id === 'itm_b' ? { ...node, position: { x: 5000, y: 5000 } } : node,
    )
    const plan = planPersistence({
      changes: ['itm_b', 'itm_a'].map((id) => change({ type: 'position', id, dragging: false })),
      nodes: list,
    })
    expect(plan.items).toEqual([
      { id: 'itm_b', position: { x: 5500, y: 5500 }, sectionId: null },
      { id: 'itm_a', position: { x: 10, y: 10 } },
    ])
  })

  it('persists finished resizes', () => {
    const list = nodes().map((node) => {
      if (node.id === 'itm_a') return { ...node, width: 400.4, height: 10 }
      if (node.id === 'gen_draft') return { ...node, width: 420.2, height: 515.7 }
      return node
    })
    const plan = planPersistence({
      changes: [
        change({
          type: 'dimensions',
          id: 'gen_draft',
          resizing: false,
          dimensions: { width: 420, height: 516 },
        }),
        change({
          type: 'dimensions',
          id: 'itm_a',
          resizing: false,
          dimensions: { width: 400, height: 10 },
        }),
        change({
          type: 'dimensions',
          id: 'sec_1',
          resizing: false,
          dimensions: { width: 1, height: 1 },
        }),
      ],
      nodes: list,
    })
    expect(plan.items).toEqual([
      { id: 'itm_a', position: { x: 10, y: 10 }, size: { width: 400, height: 24 } },
    ])
    expect(plan.sections).toEqual([
      { id: 'sec_1', position: { x: 500, y: 500 }, size: { width: 400, height: 300 } },
    ])
    expect(plan.prompts).toEqual([
      { id: 'gen_draft', position: expect.any(Object), size: { width: 420, height: 516 } },
    ])
  })
})

describe('drag feedback', () => {
  it('reports the draft prompt under a dragged image', () => {
    const list = nodes().map((node) =>
      node.id === 'itm_a' ? { ...node, position: { x: 2010, y: 20 } } : node,
    )
    const dragging = [change({ type: 'position', id: 'itm_a', dragging: true })]
    expect(isDragging(dragging)).toBe(true)
    expect(hoveredPrompt({ changes: dragging, nodes: list })).toBe('gen_draft')
    expect(
      hoveredPrompt({
        changes: [change({ type: 'position', id: 'sec_1', dragging: true })],
        nodes: list,
      }),
    ).toBeNull()
    expect(
      hoveredPrompt({
        changes: [change({ type: 'position', id: 'itm_c', dragging: true })],
        nodes: list,
      }),
    ).toBeNull()
    expect(hoveredPrompt({ changes: [], nodes: list })).toBeNull()
    expect(isDragging([change({ type: 'select', id: 'x', selected: true })])).toBe(false)
  })

  it('reverts dropped images and mirrors re-parenting', () => {
    const list = nodes().map((node) =>
      node.id === 'itm_a' ? { ...node, position: { x: 999, y: 999 } } : node,
    )
    const reverted = revertPositions({
      nodes: list,
      itemIds: ['itm_a', 'ghost'],
      items: board.items,
    })
    expect(media({ list: reverted, id: 'itm_a' }).position).toEqual({ x: 10, y: 10 })
    expect(
      applyReparenting({ nodes: list, changes: [{ id: 'itm_a', position: { x: 1, y: 1 } }] }),
    ).toEqual(list)
    const next = applyReparenting({
      nodes: list,
      changes: [
        { id: 'itm_a', sectionId: 'sec_1', position: { x: 5, y: 5 } },
        { id: 'itm_b', sectionId: null },
        { id: 'sec_1', sectionId: null },
      ],
    })
    expect(media({ list: next, id: 'itm_a' })).toMatchObject({
      parentId: 'sec_1',
      position: { x: 5, y: 5 },
    })
    expect(media({ list: next, id: 'itm_b' }).parentId).toBeUndefined()
  })
})

describe('undo helpers', () => {
  it('inverts layout and section patches', () => {
    expect(
      inverseLayout({
        changes: [
          {
            id: 'itm_b',
            position: { x: 0, y: 0 },
            size: { width: 50, height: 50 },
            sectionId: null,
          },
          { id: 'itm_a', position: { x: 1, y: 1 } },
          { id: 'ghost', position: { x: 1, y: 1 } },
        ],
        items: board.items,
      }),
    ).toEqual([
      {
        id: 'itm_b',
        position: { x: 20, y: 20 },
        size: { width: 320, height: 180 },
        sectionId: 'sec_1',
      },
      { id: 'itm_a', position: { x: 10, y: 10 } },
    ])
    expect(
      inverseSectionPatch({
        patch: { id: 'sec_1', position: { x: 0, y: 0 } },
        sections: board.sections,
      }),
    ).toEqual({ id: 'sec_1', position: { x: 500, y: 500 } })
    expect(
      inverseSectionPatch({
        patch: { id: 'sec_1', size: { width: 1, height: 1 } },
        sections: board.sections,
      }),
    ).toEqual({ id: 'sec_1', size: { width: 400, height: 300 } })
    expect(inverseSectionPatch({ patch: { id: 'nope' }, sections: board.sections })).toBeNull()
    expect(sectionChildren({ sectionId: 'sec_1', items: board.items })).toEqual([
      { id: 'itm_b', position: { x: 20, y: 20 } },
    ])
  })
})
