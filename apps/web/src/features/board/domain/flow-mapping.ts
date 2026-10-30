import type {
  BoardSnapshot,
  GenerationRequest,
  Item,
  LayoutChange,
  Section,
  Size,
  Tag,
  Vec2,
} from '@inspiratio/shared'
import type { Node, NodeChange } from '@xyflow/react'

export const PROMPT_CARD_WIDTH = 340
const PROMPT_Z_INDEX = 100_000

export type MediaNodeData = {
  readonly item: Item
  readonly tags: readonly Tag[]
  readonly allTags: readonly Tag[]
  readonly referenceLabels: readonly string[]
}

export type SectionNodeData = {
  readonly section: Section
  readonly childCount: number
}

export type PromptNodeData = {
  readonly request: GenerationRequest
  readonly references: readonly Item[]
  readonly results: readonly Item[]
  readonly dropActive: boolean
}

export type MediaFlowNode = Node<MediaNodeData, 'media'>
export type SectionFlowNode = Node<SectionNodeData, 'section'>
export type PromptFlowNode = Node<PromptNodeData, 'prompt'>
export type BoardNode = MediaFlowNode | SectionFlowNode | PromptFlowNode

export const isMediaNode = (node: BoardNode): node is MediaFlowNode => node.type === 'media'
export const isSectionNode = (node: BoardNode): node is SectionFlowNode => node.type === 'section'
export const isPromptNode = (node: BoardNode): node is PromptFlowNode => node.type === 'prompt'

export const tagsOfItem = (params: { readonly item: Item; readonly tags: readonly Tag[] }): Tag[] =>
  params.item.tagIds
    .map((id) => params.tags.find((tag) => tag.id === id))
    .filter((tag): tag is Tag => tag !== undefined)

const itemsById = (params: {
  readonly ids: readonly string[]
  readonly items: readonly Item[]
}): Item[] =>
  params.ids
    .map((id) => params.items.find((item) => item.id === id))
    .filter((item): item is Item => item !== undefined)

/** Labels (@1, @2…) an item carries in the draft prompts it is referenced by. */
export const referenceLabelsOf = (params: {
  readonly itemId: string
  readonly generations: readonly GenerationRequest[]
}): string[] =>
  params.generations
    .filter((request) => request.status === 'draft')
    .flatMap((request) => request.references)
    .filter((reference) => reference.itemId === params.itemId)
    .map((reference) => reference.label)

/**
 * Projects server state onto React Flow nodes. Sections come first because React Flow needs
 * parents before children. Local-only state (selection, in-flight drags) is kept.
 */
export const toFlowNodes = (params: {
  readonly board: BoardSnapshot
  readonly generations: readonly GenerationRequest[]
  readonly selection: readonly string[]
  readonly dropTargetId: string | null
  readonly previous: readonly BoardNode[]
}): BoardNode[] => {
  const previousById = new Map(params.previous.map((node) => [node.id, node]))
  const sectionIds = new Set(params.board.sections.map((section) => section.id))
  const kept = (id: string) => previousById.get(id)
  const positionOf = (target: { readonly id: string; readonly position: Vec2 }) => {
    const before = kept(target.id)
    return before?.dragging === true ? before.position : target.position
  }

  const sections: SectionFlowNode[] = params.board.sections.map((section) => ({
    id: section.id,
    type: 'section',
    position: positionOf({ id: section.id, position: section.position }),
    width: section.size.width,
    height: section.size.height,
    zIndex: -1,
    selected: kept(section.id)?.selected ?? false,
    dragHandle: '.section-drag-handle',
    data: {
      section,
      childCount: params.board.items.filter((item) => item.sectionId === section.id).length,
    },
  }))

  const items: MediaFlowNode[] = params.board.items.map((item) => {
    const parentId =
      item.sectionId !== null && sectionIds.has(item.sectionId) ? item.sectionId : undefined
    return {
      id: item.id,
      type: 'media',
      position: positionOf({ id: item.id, position: item.position }),
      width: item.size.width,
      height: item.size.height,
      zIndex: item.zIndex,
      selected: kept(item.id)?.selected ?? params.selection.includes(item.id),
      ...(parentId === undefined ? {} : { parentId }),
      data: {
        item,
        tags: tagsOfItem({ item, tags: params.board.tags }),
        allTags: params.board.tags,
        referenceLabels: referenceLabelsOf({ itemId: item.id, generations: params.generations }),
      },
    }
  })

  const prompts: PromptFlowNode[] = params.generations.map((request) => ({
    id: request.id,
    type: 'prompt',
    position: positionOf({ id: request.id, position: request.position }),
    width: request.size?.width ?? PROMPT_CARD_WIDTH,
    ...(request.size === null ? {} : { height: request.size.height }),
    zIndex: PROMPT_Z_INDEX,
    selected: kept(request.id)?.selected ?? false,
    data: {
      request,
      references: itemsById({
        ids: request.references.map((reference) => reference.itemId),
        items: params.board.items,
      }),
      results: itemsById({ ids: request.resultItemIds, items: params.board.items }),
      dropActive: params.dropTargetId === request.id,
    },
  }))

  return [...sections, ...items, ...prompts]
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

const centerOf = (params: { readonly node: BoardNode; readonly nodes: readonly BoardNode[] }) => {
  const origin = absolutePosition(params)
  const size = sizeOf(params.node)
  return { x: origin.x + size.width / 2, y: origin.y + size.height / 2 }
}

const contains = (params: { readonly node: BoardNode; readonly point: Vec2 }): boolean => {
  const size = sizeOf(params.node)
  const { x, y } = params.node.position
  return (
    params.point.x >= x &&
    params.point.x <= x + size.width &&
    params.point.y >= y &&
    params.point.y <= y + size.height
  )
}

export const containingSection = (params: {
  readonly node: MediaFlowNode
  readonly nodes: readonly BoardNode[]
}): SectionFlowNode | undefined => {
  const point = centerOf(params)
  return params.nodes
    .filter(isSectionNode)
    .findLast((section) => contains({ node: section, point }))
}

/** The draft prompt card a dragged image is hovering, if any. */
export const promptUnder = (params: {
  readonly node: MediaFlowNode
  readonly nodes: readonly BoardNode[]
}): PromptFlowNode | undefined => {
  const point = centerOf(params)
  return params.nodes
    .filter(isPromptNode)
    .filter((prompt) => prompt.data.request.status === 'draft')
    .findLast((prompt) => contains({ node: prompt, point }))
}

export type SectionPatch = {
  readonly id: string
  readonly position?: Vec2
  readonly size?: Size
}

export type PromptPatch = {
  readonly id: string
  readonly position: Vec2
  readonly size?: Size
}

export type ReferenceDrop = { readonly promptId: string; readonly itemIds: string[] }

export type PersistencePlan = {
  readonly items: LayoutChange[]
  readonly sections: SectionPatch[]
  readonly prompts: PromptPatch[]
  readonly drops: ReferenceDrop[]
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
  const targetId = target?.id ?? null
  if (targetId === (params.node.parentId ?? null))
    return { id: params.node.id, position: roundVec(params.node.position) }
  const absolute = absolutePosition(params)
  const position =
    target === undefined
      ? absolute
      : { x: absolute.x - target.position.x, y: absolute.y - target.position.y }
  return { id: params.node.id, position: roundVec(position), sectionId: targetId }
}

const addDrop = (params: {
  readonly drops: ReferenceDrop[]
  readonly promptId: string
  readonly itemId: string
}): void => {
  const existing = params.drops.find((drop) => drop.promptId === params.promptId)
  if (existing === undefined)
    params.drops.push({ promptId: params.promptId, itemIds: [params.itemId] })
  else existing.itemIds.push(params.itemId)
}

/**
 * Decides what to persist after React Flow applied a batch of changes: only finished drags
 * and resizes are written. Images released over a draft prompt become its references.
 */
export const planPersistence = (params: {
  readonly changes: readonly NodeChange<BoardNode>[]
  readonly nodes: readonly BoardNode[]
}): PersistencePlan => {
  const plan: PersistencePlan = { items: [], sections: [], prompts: [], drops: [] }
  for (const change of params.changes) {
    const finishedDrag = change.type === 'position' && change.dragging === false
    const finishedResize = change.type === 'dimensions' && change.resizing === false
    if (!finishedDrag && !finishedResize) continue
    const node = params.nodes.find((candidate) => candidate.id === change.id)
    if (node === undefined) continue
    if (isPromptNode(node)) {
      plan.prompts.push(
        finishedDrag
          ? { id: node.id, position: roundVec(node.position) }
          : { id: node.id, position: roundVec(node.position), size: roundSize(sizeOf(node)) },
      )
    } else if (isSectionNode(node)) {
      plan.sections.push(
        finishedDrag
          ? { id: node.id, position: roundVec(node.position) }
          : { id: node.id, position: roundVec(node.position), size: roundSize(sizeOf(node)) },
      )
    } else if (finishedResize) {
      plan.items.push({
        id: node.id,
        position: roundVec(node.position),
        size: roundSize(sizeOf(node)),
      })
    } else {
      const prompt = promptUnder({ node, nodes: params.nodes })
      if (prompt === undefined) plan.items.push(itemDragEnd({ node, nodes: params.nodes }))
      else addDrop({ drops: plan.drops, promptId: prompt.id, itemId: node.id })
    }
  }
  return plan
}

/** Hover feedback while dragging: the draft prompt under the first dragged image. */
export const hoveredPrompt = (params: {
  readonly changes: readonly NodeChange<BoardNode>[]
  readonly nodes: readonly BoardNode[]
}): string | null => {
  for (const change of params.changes) {
    if (change.type !== 'position' || change.dragging !== true) continue
    const node = params.nodes.find((candidate) => candidate.id === change.id)
    if (node !== undefined && isMediaNode(node))
      return promptUnder({ node, nodes: params.nodes })?.id ?? null
  }
  return null
}

export const isDragging = (changes: readonly NodeChange<BoardNode>[]): boolean =>
  changes.some((change) => change.type === 'position' && change.dragging === true)

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

/** Images dropped on a prompt go back to where they were picked up. */
export const revertPositions = (params: {
  readonly nodes: readonly BoardNode[]
  readonly itemIds: readonly string[]
  readonly items: readonly Item[]
}): BoardNode[] =>
  params.nodes.map((node) => {
    const item = params.itemIds.includes(node.id)
      ? params.items.find((candidate) => candidate.id === node.id)
      : undefined
    return item === undefined ? node : { ...node, position: item.position }
  })

/** Deleting a section keeps its images: React Flow also reports the children, drop them. */
export const deletableNodes = (nodes: readonly BoardNode[]): BoardNode[] => {
  const sections = new Set(nodes.filter(isSectionNode).map((node) => node.id))
  return nodes.filter((node) => node.parentId === undefined || !sections.has(node.parentId))
}

/**
 * A selected section is grabbed from anywhere inside it: its whole body becomes the drag handle
 * and its children let the pointer through, so pressing on an image moves the section instead.
 */
export const grabSelectedSections = (nodes: BoardNode[]): BoardNode[] => {
  const grabbed = new Set(
    nodes.filter((node) => isSectionNode(node) && node.selected === true).map((node) => node.id),
  )
  if (grabbed.size === 0) return nodes
  return nodes.map((node) => {
    if (grabbed.has(node.id)) {
      const { dragHandle: _handle, ...rest } = node
      return rest
    }
    if (node.parentId !== undefined && grabbed.has(node.parentId))
      return { ...node, style: { ...node.style, pointerEvents: 'none' } }
    return node
  })
}

export const selectedItemIds = (nodes: readonly BoardNode[]): string[] =>
  nodes.filter((node) => node.selected === true && isMediaNode(node)).map((node) => node.id)
