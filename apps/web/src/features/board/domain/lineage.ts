import type { GenerationRequest, Item } from '@inspiratio/shared'
import type { Edge } from '@xyflow/react'

export const RUN_COLORS = [
  'var(--color-coral-500)',
  'var(--color-mint-700)',
  'var(--color-coral-700)',
  'var(--color-muted-foreground)',
] as const

const REFERENCE_COLOR = 'var(--color-mint-700)'
const EDGE_Z_INDEX = 200_000

export type Lineage = {
  readonly nodeIds: ReadonlySet<string>
  readonly edges: Edge[]
}

export const NO_LINEAGE: Lineage = { nodeIds: new Set(), edges: [] }

export type RunSlot = { readonly run: number; readonly index: number; readonly size: number }

/** Where each result sits within its Generate run: run 2, variant 1 of 3. */
export const runSlots = (params: {
  readonly request: GenerationRequest
  readonly items: readonly Item[]
}): ReadonlyMap<string, RunSlot> => {
  const runOf = new Map(
    params.items
      .filter((item) => item.metadata.generation?.requestId === params.request.id)
      .map((item) => [item.id, item.metadata.generation?.run ?? 1]),
  )
  const results = params.request.resultItemIds.filter((id) => runOf.has(id))
  const sizes = new Map<number, number>()
  for (const id of results) {
    const run = runOf.get(id) ?? 1
    sizes.set(run, (sizes.get(run) ?? 0) + 1)
  }
  const seen = new Map<number, number>()
  return new Map(
    results.map((id) => {
      const run = runOf.get(id) ?? 1
      const index = (seen.get(run) ?? 0) + 1
      seen.set(run, index)
      return [id, { run, index, size: sizes.get(run) ?? 1 }]
    }),
  )
}

const runLabel = (params: {
  readonly slot: RunSlot
  readonly runs: number
}): string | undefined => {
  if (params.runs === 1 && params.slot.size === 1) return undefined
  const variant =
    params.slot.size > 1 ? ` · ${String(params.slot.index)}/${String(params.slot.size)}` : ''
  return params.runs > 1 ? `Run ${String(params.slot.run)}${variant}` : variant.slice(3)
}

const referenceEdge = (params: { readonly itemId: string; readonly promptId: string }): Edge => ({
  id: `ref:${params.itemId}:${params.promptId}`,
  source: params.itemId,
  target: params.promptId,
  selectable: false,
  zIndex: EDGE_Z_INDEX,
  interactionWidth: 0,
  className: 'lineage-edge',
  focusable: false,
  style: { stroke: REFERENCE_COLOR, strokeDasharray: '4 4', strokeWidth: 1.5 },
})

const resultEdge = (params: {
  readonly promptId: string
  readonly itemId: string
  readonly slot: RunSlot
  readonly runs: number
}): Edge => {
  const color = RUN_COLORS[(params.slot.run - 1) % RUN_COLORS.length] ?? RUN_COLORS[0]
  const label = runLabel({ slot: params.slot, runs: params.runs })
  return {
    id: `out:${params.promptId}:${params.itemId}`,
    source: params.promptId,
    target: params.itemId,
    selectable: false,
    zIndex: EDGE_Z_INDEX,
    interactionWidth: 0,
    className: 'lineage-edge',
    focusable: false,
    animated: true,
    style: { stroke: color, strokeWidth: 2 },
    ...(label === undefined
      ? {}
      : {
          label,
          labelStyle: { fill: color, fontSize: 11, fontWeight: 600 },
          labelBgStyle: { fill: 'var(--color-panel)' },
          labelBgPadding: [6, 3] as [number, number],
          labelBgBorderRadius: 4,
        }),
  }
}

/**
 * The references → prompt → results chains touched by the focused nodes. A prompt shows its whole
 * chain, a result only its own branch, a reference every prompt it fed.
 */
export const lineageOf = (params: {
  readonly focus: readonly string[]
  readonly items: readonly Item[]
  readonly generations: readonly GenerationRequest[]
}): Lineage => {
  if (params.focus.length === 0) return NO_LINEAGE
  const itemIds = new Set(params.items.map((item) => item.id))
  const edges = new Map<string, Edge>()
  const nodeIds = new Set<string>()

  const addChain = (chain: {
    readonly request: GenerationRequest
    readonly onlyResult: string | null
  }) => {
    const slots = runSlots({ request: chain.request, items: params.items })
    const runs = new Set([...slots.values()].map((slot) => slot.run)).size
    nodeIds.add(chain.request.id)
    for (const { itemId } of chain.request.references) {
      if (!itemIds.has(itemId)) continue
      nodeIds.add(itemId)
      const edge = referenceEdge({ itemId, promptId: chain.request.id })
      edges.set(edge.id, edge)
    }
    for (const [itemId, slot] of slots) {
      if (chain.onlyResult !== null && chain.onlyResult !== itemId) continue
      nodeIds.add(itemId)
      const edge = resultEdge({ promptId: chain.request.id, itemId, slot, runs })
      edges.set(edge.id, edge)
    }
  }

  for (const id of params.focus) {
    for (const request of params.generations) {
      if (request.id === id) addChain({ request, onlyResult: null })
      else if (request.resultItemIds.includes(id)) addChain({ request, onlyResult: id })
      else if (request.references.some((reference) => reference.itemId === id))
        addChain({ request, onlyResult: null })
    }
  }
  if (edges.size === 0) return NO_LINEAGE
  for (const id of params.focus) nodeIds.add(id)
  return { nodeIds, edges: [...edges.values()] }
}

/** Fades every node outside the lineage so the chain stands out. */
export const dimOutside = <N extends { readonly id: string; readonly className?: string }>(params: {
  readonly nodes: N[]
  readonly lineage: Lineage
}): N[] =>
  params.lineage.edges.length === 0
    ? params.nodes
    : params.nodes.map((node) =>
        params.lineage.nodeIds.has(node.id) ? node : { ...node, className: 'lineage-dim' },
      )
