import type { NodeChange } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { makeItem, makeSection, makeTag } from '../../../../__test__/fake-api.ts'
import {
  absolutePosition,
  applyReparenting,
  containingSection,
  EMPTY_FILTER,
  isFilterActive,
  isMediaNode,
  matchesFilter,
  planPersistence,
  referenceLabelOf,
  selectedItemIds,
  sizeOf,
  tagsOfItem,
  toFlowNodes,
  type BoardNode,
  type MediaFlowNode,
} from '../flow-mapping.ts'

const board = {
  items: [
    makeItem({ id: 'itm_a', title: 'Neon', tagIds: ['tag_noir'], position: { x: 10, y: 10 } }),
    makeItem({ id: 'itm_b', sectionId: 'sec_1', position: { x: 20, y: 20 } }),
    makeItem({ id: 'itm_c', sectionId: 'sec_gone' }),
  ],
  tags: [makeTag({ id: 'tag_noir', name: 'Noir' })],
  sections: [
    makeSection({ id: 'sec_1', position: { x: 500, y: 500 }, size: { width: 400, height: 300 } }),
  ],
}

const nodes = () =>
  toFlowNodes({
    board,
    filter: EMPTY_FILTER,
    references: ['itm_b'],
    selection: ['itm_c'],
    previous: [],
  })

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

describe('filters', () => {
  it('detects active filters and matches text and tags', () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false)
    expect(isFilterActive({ text: ' ', tagIds: ['t'] })).toBe(true)
    const item = board.items[0] ?? makeItem({ id: 'x' })
    expect(matchesFilter({ item, tags: board.tags, filter: { text: 'noir', tagIds: [] } })).toBe(
      true,
    )
    expect(
      matchesFilter({ item, tags: board.tags, filter: { text: '', tagIds: ['tag_noir'] } }),
    ).toBe(true)
    expect(matchesFilter({ item, tags: board.tags, filter: { text: 'zzz', tagIds: [] } })).toBe(
      false,
    )
    expect(
      tagsOfItem({ item: makeItem({ id: 'y', tagIds: ['missing'] }), tags: board.tags }),
    ).toEqual([])
  })

  it('labels references by position', () => {
    expect(referenceLabelOf({ itemId: 'b', references: ['a', 'b'] })).toBe('@2')
    expect(referenceLabelOf({ itemId: 'z', references: ['a'] })).toBeNull()
  })
})

describe('toFlowNodes', () => {
  it('puts sections first, parents children and decorates nodes', () => {
    const list = nodes()
    expect(list.map((node) => node.id)).toEqual(['sec_1', 'itm_a', 'itm_b', 'itm_c'])
    expect(media({ list: list, id: 'itm_b' }).parentId).toBe('sec_1')
    expect(media({ list: list, id: 'itm_c' }).parentId).toBeUndefined()
    expect(media({ list: list, id: 'itm_b' }).data.referenceLabel).toBe('@1')
    expect(media({ list: list, id: 'itm_c' }).selected).toBe(true)
    expect(media({ list: list, id: 'itm_a' }).data.tags.map((tag) => tag.name)).toEqual(['Noir'])
    const section = list[0]
    expect(section?.type === 'section' && section.data.childCount).toBe(1)
  })

  it('keeps local selection and in-flight drag positions', () => {
    const previous = nodes().map((node) =>
      node.id === 'itm_a'
        ? { ...node, selected: true, dragging: true, position: { x: 99, y: 99 } }
        : node,
    )
    const next = toFlowNodes({
      board,
      filter: { text: 'zzz', tagIds: [] },
      references: [],
      selection: [],
      previous,
    })
    expect(media({ list: next, id: 'itm_a' })).toMatchObject({
      selected: true,
      position: { x: 99, y: 99 },
    })
    expect(media({ list: next, id: 'itm_a' }).data.dimmed).toBe(true)
    const draggedSection = toFlowNodes({
      board,
      filter: EMPTY_FILTER,
      references: [],
      selection: [],
      previous: nodes().map((node) =>
        node.id === 'sec_1' ? { ...node, dragging: true, position: { x: 1, y: 1 } } : node,
      ),
    })
    expect(draggedSection[0]?.position).toEqual({ x: 1, y: 1 })
  })

  it('reports selected items only', () => {
    expect(selectedItemIds(nodes())).toEqual(['itm_c'])
  })
})

describe('geometry', () => {
  it('reads sizes from explicit or measured dimensions', () => {
    const node = media({ list: nodes(), id: 'itm_a' })
    expect(sizeOf(node)).toEqual({ width: 320, height: 180 })
    expect(
      sizeOf({ ...node, width: undefined, height: undefined, measured: { width: 5, height: 6 } }),
    ).toEqual({ width: 5, height: 6 })
    expect(sizeOf({ ...node, width: undefined, height: undefined })).toEqual({
      width: 0,
      height: 0,
    })
  })

  it('computes absolute positions and containing sections', () => {
    const list = nodes()
    expect(absolutePosition({ node: media({ list: list, id: 'itm_b' }), nodes: list })).toEqual({
      x: 520,
      y: 520,
    })
    expect(containingSection({ node: media({ list: list, id: 'itm_b' }), nodes: list })?.id).toBe(
      'sec_1',
    )
    expect(
      containingSection({ node: media({ list: list, id: 'itm_a' }), nodes: list }),
    ).toBeUndefined()
  })
})

describe('planPersistence', () => {
  const change = (value: NodeChange<BoardNode>) => value

  it('ignores in-progress changes and unknown nodes', () => {
    const plan = planPersistence({
      changes: [
        change({ type: 'position', id: 'itm_a', dragging: true, position: { x: 1, y: 1 } }),
        change({ type: 'select', id: 'itm_a', selected: true }),
        change({ type: 'position', id: 'ghost', dragging: false }),
      ],
      nodes: nodes(),
    })
    expect(plan).toEqual({ items: [], sections: [] })
  })

  it('persists finished drags, moving items into and out of sections', () => {
    const list = nodes().map((node) => {
      if (node.id === 'itm_a') return { ...node, position: { x: 600.123, y: 600 } }
      if (node.id === 'itm_b') return { ...node, position: { x: 2000, y: 2000 } }
      if (node.id === 'itm_c') return { ...node, position: { x: 3000, y: 3000 } }
      return node
    })
    const plan = planPersistence({
      changes: ['itm_a', 'itm_b', 'itm_c', 'sec_1'].map((id) =>
        change({ type: 'position', id, dragging: false }),
      ),
      nodes: list,
    })
    expect(plan.items).toEqual([
      { id: 'itm_a', position: { x: 100.12, y: 100 }, sectionId: 'sec_1' },
      { id: 'itm_b', position: { x: 2500, y: 2500 }, sectionId: null },
      { id: 'itm_c', position: { x: 3000, y: 3000 } },
    ])
    expect(plan.sections).toEqual([{ id: 'sec_1', position: { x: 500, y: 500 } }])
  })

  it('persists finished resizes with position and size', () => {
    const list = nodes().map((node) =>
      node.id === 'itm_a' ? { ...node, width: 400.4, height: 10 } : node,
    )
    const plan = planPersistence({
      changes: [
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
  })
})

describe('applyReparenting', () => {
  it('updates parents locally for re-parented items only', () => {
    const list = nodes()
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
