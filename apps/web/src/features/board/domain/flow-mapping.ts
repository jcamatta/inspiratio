import type {
  BoardSnapshot,
  Item,
  LayoutChange,
  Section,
  Size,
  Tag,
  Vec2,
} from '@inspiratio/shared'
import type { Node, NodeChange } from '@xyflow/react'

export type ItemFilter = { readonly text: string; readonly tagIds: readonly string[] }

export type MediaNodeData = {
  readonly item: Item
  readonly tags: readonly Tag[]
  readonly dimmed: boolean
  readonly referenceLabel: string | null
}

export type SectionNodeData = {
  readonly section: Section
  readonly childCount: number
}

export type MediaFlowNode = Node<MediaNodeData, 'media'>
export type SectionFlowNode = Node<SectionNodeData, 'section'>
export type BoardNode = MediaFlowNode | SectionFlowNode

export const isMediaNode = (node: BoardNode): node is MediaFlowNode => node.type === 'media'
export const isSectionNode = (node: BoardNode): node is SectionFlowNode => node.type === 'section'

export const EMPTY_FILTER: ItemFilter = { text: '', tagIds: [] }

export const isFilterActive = (filter: ItemFilter): boolean =>
  filter.text.trim() !== '' || filter.tagIds.length > 0

export const matchesFilter = (params: {
  readonly item: Item
  readonly tags: readonly Tag[]
  readonly filter: ItemFilter
}): boolean => {
  const text = params.filter.text.trim().toLowerCase()
  const tagNames = params.tags.map((tag) => tag.name.toLowerCase())
  const haystack = [
    params.item.title,
    params.item.metadata.notes,
    params.item.metadata.generation?.prompt ?? '',
    ...tagNames,
  ]
    .join(' ')
    .toLowerCase()
  const textOk = text === '' || haystack.includes(text)
  const tagsOk = params.filter.tagIds.every((id) => params.item.tagIds.includes(id))
  return textOk && tagsOk
}

export const tagsOfItem = (params: { readonly item: Item; readonly tags: readonly Tag[] }): Tag[] =>
  params.item.tagIds
    .map((id) => params.tags.find((tag) => tag.id === id))
    .filter((tag): tag is Tag => tag !== undefined)

export const referenceLabelOf = (params: {
  readonly itemId: string
  readonly references: readonly string[]
}): string | null => {
  const index = params.references.indexOf(params.itemId)
  return index === -1 ? null : `@${index + 1}`
}

/**
 * Projects the server snapshot onto React Flow nodes. Sections come first because React Flow
 * requires parents before children. Local-only state (selection, in-flight drags) is kept.
 */
export const toFlowNodes = (params: {
  readonly board: BoardSnapshot
  readonly filter: ItemFilter
  readonly references: readonly string[]
  /** Workspace selection, used for nodes React Flow has not seen yet. */
  readonly selection: readonly string[]
  readonly previous: readonly BoardNode[]
}): BoardNode[] => {
  const previousById = new Map(params.previous.map((node) => [node.id, node]))
  const sectionIds = new Set(params.board.sections.map((section) => section.id))
  const filterActive = isFilterActive(params.filter)

  const sections: SectionFlowNode[] = params.board.sections.map((section) => {
    const before = previousById.get(section.id)
    return {
      id: section.id,
      type: 'section',
      position: before?.dragging === true ? before.position : section.position,
      width: section.size.width,
      height: section.size.height,
      zIndex: -1,
      selected: before?.selected ?? false,
      dragHandle: '.section-drag-handle',
      data: {
        section,
        childCount: params.board.items.filter((item) => item.sectionId === section.id).length,
      },
    }
  })

  const items: MediaFlowNode[] = params.board.items.map((item) => {
    const before = previousById.get(item.id)
    const tags = tagsOfItem({ item, tags: params.board.tags })
    const parentId =
      item.sectionId !== null && sectionIds.has(item.sectionId) ? item.sectionId : undefined
    return {
      id: item.id,
      type: 'media',
      position: before?.dragging === true ? before.position : item.position,
      width: item.size.width,
      height: item.size.height,
      zIndex: item.zIndex,
      selected: before?.selected ?? params.selection.includes(item.id),
      ...(parentId === undefined ? {} : { parentId }),
      data: {
        item,
        tags,
        dimmed: filterActive && !matchesFilter({ item, tags, filter: params.filter }),
        referenceLabel: referenceLabelOf({ itemId: item.id, references: params.references }),
      },
    }
  })

  return [...sections, ...items]
}

export const sizeOf = (node: BoardNode): Size => ({
  width: node.width ?? node.measured?.width ?? 0,
  height: node.height ?? node.measured?.height ?? 0,
})

export const absolutePosition = (params: {
  readonly node: BoardNode
  readonly nodes: readonly BoardNode[]
}): Vec2 => {
  const parent =
    params.node.parentId === undefined
      ? undefined
      : params.nodes.find((node) => node.id === params.node.parentId)
  return parent === undefined
    ? params.node.position
    : {
        x: parent.position.x + params.node.position.x,
        y: parent.position.y + params.node.position.y,
      }
}

const contains = (params: { readonly section: SectionFlowNode; readonly point: Vec2 }): boolean => {
  const size = sizeOf(params.section)
  const { x, y } = params.section.position
  return (
    params.point.x >= x &&
    params.point.x <= x + size.width &&
    params.point.y >= y &&
    params.point.y <= y + size.height
  )
}

/** The section whose bounds contain the item's centre (the last one wins when overlapping). */
export const containingSection = (params: {
  readonly node: MediaFlowNode
  readonly nodes: readonly BoardNode[]
}): SectionFlowNode | undefined => {
  const origin = absolutePosition(params)
  const size = sizeOf(params.node)
  const center = { x: origin.x + size.width / 2, y: origin.y + size.height / 2 }
  return params.nodes
    .filter(isSectionNode)
    .findLast((section) => contains({ section, point: center }))
}

export type SectionPatch = {
  readonly id: string
  readonly position?: Vec2
  readonly size?: Size
}

export type PersistencePlan = {
  readonly items: LayoutChange[]
  readonly sections: SectionPatch[]
}

const round = (value: number): number => Math.round(value * 100) / 100

const roundVec = (vec: Vec2): Vec2 => ({ x: round(vec.x), y: round(vec.y) })

const roundSize = (size: Size): Size => ({
  width: Math.max(24, Math.round(size.width)),
  height: Math.max(24, Math.round(size.height)),
})

const itemDragEnd = (params: {
  readonly node: MediaFlowNode
  readonly nodes: readonly BoardNode[]
}): LayoutChange => {
  const target = containingSection(params)
  const currentParent = params.node.parentId ?? null
  const targetId = target?.id ?? null
  if (targetId === currentParent)
    return { id: params.node.id, position: roundVec(params.node.position) }
  const absolute = absolutePosition(params)
  const position =
    target === undefined
      ? absolute
      : { x: absolute.x - target.position.x, y: absolute.y - target.position.y }
  return { id: params.node.id, position: roundVec(position), sectionId: targetId }
}

/**
 * Decides what to persist after React Flow applied a batch of changes: only completed drags
 * (`dragging: false`) and completed resizes (`resizing: false`) are written to the server.
 */
export const planPersistence = (params: {
  readonly changes: readonly NodeChange<BoardNode>[]
  readonly nodes: readonly BoardNode[]
}): PersistencePlan => {
  const items: LayoutChange[] = []
  const sections: SectionPatch[] = []
  for (const change of params.changes) {
    const finishedDrag = change.type === 'position' && change.dragging === false
    const finishedResize = change.type === 'dimensions' && change.resizing === false
    if (!finishedDrag && !finishedResize) continue
    const node = params.nodes.find((candidate) => candidate.id === change.id)
    if (node === undefined) continue
    if (isSectionNode(node)) {
      sections.push(
        finishedDrag
          ? { id: node.id, position: roundVec(node.position) }
          : { id: node.id, position: roundVec(node.position), size: roundSize(sizeOf(node)) },
      )
    } else if (finishedDrag) {
      items.push(itemDragEnd({ node, nodes: params.nodes }))
    } else {
      items.push({ id: node.id, position: roundVec(node.position), size: roundSize(sizeOf(node)) })
    }
  }
  return { items, sections }
}

/** Mirrors section re-parenting locally so the node does not jump until the server answers. */
export const applyReparenting = (params: {
  readonly nodes: readonly BoardNode[]
  readonly changes: readonly LayoutChange[]
}): BoardNode[] => {
  const reparented = new Map(
    params.changes
      .filter((change) => change.sectionId !== undefined)
      .map((change) => [change.id, change]),
  )
  if (reparented.size === 0) return [...params.nodes]
  return params.nodes.map((node) => {
    const change = reparented.get(node.id)
    if (change === undefined || !isMediaNode(node)) return node
    const { parentId: _previous, ...rest } = node
    return {
      ...rest,
      position: change.position ?? node.position,
      ...(change.sectionId === null || change.sectionId === undefined
        ? {}
        : { parentId: change.sectionId }),
    }
  })
}

export const selectedItemIds = (nodes: readonly BoardNode[]): string[] =>
  nodes.filter((node) => node.selected === true && isMediaNode(node)).map((node) => node.id)
