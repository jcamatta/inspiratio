import type { Item, LayoutChange, Section, Vec2 } from '@inspiratio/shared'

export type ContextTarget =
  | { readonly kind: 'pane'; readonly position: Vec2 }
  | { readonly kind: 'item'; readonly id: string; readonly position: Vec2 }
  | { readonly kind: 'section'; readonly id: string; readonly position: Vec2 }
  | { readonly kind: 'prompt'; readonly id: string; readonly position: Vec2 }

/** Resolves what was right-clicked from the DOM: React Flow nodes carry `data-id`. */
export const resolveContextTarget = (params: {
  readonly element: Element | null
  readonly position: Vec2
  readonly itemIds: ReadonlySet<string>
  readonly sectionIds: ReadonlySet<string>
  readonly promptIds: ReadonlySet<string>
}): ContextTarget => {
  const nodeId = params.element?.closest('.react-flow__node')?.getAttribute('data-id') ?? null
  if (nodeId !== null && params.itemIds.has(nodeId))
    return { kind: 'item', id: nodeId, position: params.position }
  if (nodeId !== null && params.sectionIds.has(nodeId))
    return { kind: 'section', id: nodeId, position: params.position }
  if (nodeId !== null && params.promptIds.has(nodeId))
    return { kind: 'prompt', id: nodeId, position: params.position }
  return { kind: 'pane', position: params.position }
}

/** Menu actions apply to the whole selection when the clicked item belongs to it. */
export const actionTargets = (params: {
  readonly id: string
  readonly selection: readonly string[]
}): string[] => (params.selection.includes(params.id) ? [...params.selection] : [params.id])

export const frontZIndex = (items: readonly Item[]): number =>
  Math.max(0, ...items.map((item) => item.zIndex)) + 1

export const backZIndex = (items: readonly Item[]): number =>
  Math.min(0, ...items.map((item) => item.zIndex)) - 1

/** Moving an item out of its section keeps it at the same place on screen. */
export const detachChanges = (params: {
  readonly ids: readonly string[]
  readonly items: readonly Item[]
  readonly sections: readonly Section[]
}): LayoutChange[] =>
  params.ids.flatMap((id) => {
    const item = params.items.find((candidate) => candidate.id === id)
    const section = params.sections.find((candidate) => candidate.id === item?.sectionId)
    if (item === undefined || section === undefined) return []
    return [
      {
        id,
        sectionId: null,
        position: {
          x: section.position.x + item.position.x,
          y: section.position.y + item.position.y,
        },
      },
    ]
  })

export type Box = {
  readonly position: Vec2
  readonly size: { readonly width: number; readonly height: number }
}

export const PROMPT_CARD_BOX = { width: 340, height: 440 } as const
const GAP = 48

const overlaps = (params: { readonly a: Box; readonly b: Box }): boolean =>
  params.a.position.x < params.b.position.x + params.b.size.width &&
  params.b.position.x < params.a.position.x + params.a.size.width &&
  params.a.position.y < params.b.position.y + params.b.size.height &&
  params.b.position.y < params.a.position.y + params.a.size.height

/** Slides a card to the right until it no longer covers anything on the canvas. */
export const freeSpot = (params: {
  readonly start: Vec2
  readonly obstacles: readonly Box[]
}): Vec2 => {
  let position = params.start
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const card: Box = { position, size: PROMPT_CARD_BOX }
    const hit = params.obstacles.find((obstacle) => overlaps({ a: card, b: obstacle }))
    if (hit === undefined) return position
    position = { x: hit.position.x + hit.size.width + GAP, y: position.y }
  }
  return position
}

/** Where a new prompt card goes: to the right of the items it references, on free space. */
export const promptPlacement = (params: {
  readonly ids: readonly string[]
  readonly items: readonly Item[]
  readonly prompts: readonly Vec2[]
  readonly fallback: Vec2
}): Vec2 => {
  const targets = params.items.filter(
    (item) => params.ids.includes(item.id) && item.sectionId === null,
  )
  const start =
    targets.length === 0
      ? params.fallback
      : {
          x: Math.max(...targets.map((item) => item.position.x + item.size.width)) + GAP,
          y: Math.min(...targets.map((item) => item.position.y)),
        }
  const obstacles: Box[] = [
    ...params.items.filter((item) => item.sectionId === null),
    ...params.prompts.map((position) => ({ position, size: PROMPT_CARD_BOX })),
  ]
  return freeSpot({ start, obstacles })
}
