import type { Item, LayoutChange, Section, Vec2 } from '@inspiratio/shared'

export type ContextTarget =
  | { readonly kind: 'pane'; readonly position: Vec2 }
  | { readonly kind: 'item'; readonly id: string; readonly position: Vec2 }
  | { readonly kind: 'section'; readonly id: string; readonly position: Vec2 }

/** Resolves what was right-clicked from the DOM: React Flow nodes carry `data-id`. */
export const resolveContextTarget = (params: {
  readonly element: Element | null
  readonly position: Vec2
  readonly itemIds: ReadonlySet<string>
  readonly sectionIds: ReadonlySet<string>
}): ContextTarget => {
  const nodeId = params.element?.closest('.react-flow__node')?.getAttribute('data-id') ?? null
  if (nodeId !== null && params.itemIds.has(nodeId))
    return { kind: 'item', id: nodeId, position: params.position }
  if (nodeId !== null && params.sectionIds.has(nodeId))
    return { kind: 'section', id: nodeId, position: params.position }
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
