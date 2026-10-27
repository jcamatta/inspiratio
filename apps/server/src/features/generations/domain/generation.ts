import {
  err,
  mediaUrlOf,
  ok,
  type CreateGenerationCommand,
  type GenerationReference,
  type GenerationRequest,
  type GenerationStatus,
  type Item,
  type ResolvedReference,
  type Result,
  type Size,
  type Tag,
  type Vec2,
} from '@inspiratio/shared'
import { findById, unique } from '../../../shared/lib/collections.ts'
import { PLACEMENT_GAP, tagNamesOf } from '../../items/domain/item.ts'

/** References are addressed in the prompt as @1, @2… in the order they were added. */
export const labelReferences = (itemIds: readonly string[]): GenerationReference[] =>
  [...unique(itemIds).entries()].map(([index, itemId]) => ({ itemId, label: `@${index + 1}` }))

export const createGenerationRequest = (params: {
  readonly id: string
  readonly now: string
  readonly traceId: string
  readonly input: CreateGenerationCommand
}): GenerationRequest => ({
  id: params.id,
  prompt: params.input.prompt,
  kind: params.input.kind,
  model: params.input.model,
  aspectRatio: params.input.aspectRatio,
  count: params.input.count,
  references: labelReferences(params.input.referenceItemIds),
  status: 'pending',
  traceId: params.traceId,
  createdAt: params.now,
  updatedAt: params.now,
  resultItemIds: [],
  error: null,
})

const TRANSITIONS: Readonly<Record<GenerationStatus, readonly GenerationStatus[]>> = {
  pending: ['in_progress', 'completed', 'failed'],
  in_progress: ['completed', 'failed'],
  completed: [],
  failed: ['pending'],
}

export const canTransition = (params: {
  readonly from: GenerationStatus
  readonly to: GenerationStatus
}): boolean => TRANSITIONS[params.from].includes(params.to)

/** The request lifecycle as a small state machine; invalid moves are reported, not thrown. */
export const transition = (params: {
  readonly request: GenerationRequest
  readonly to: GenerationStatus
  readonly now: string
  readonly error?: string
  readonly resultItemIds?: readonly string[]
}): Result<GenerationRequest> => {
  if (!canTransition({ from: params.request.status, to: params.to }))
    return err({
      code: 'invalid_state',
      message: `Generation ${params.request.id} cannot go from ${params.request.status} to ${params.to}`,
    })
  return ok({
    ...params.request,
    status: params.to,
    updatedAt: params.now,
    error: params.to === 'failed' ? (params.error ?? 'Unknown error') : null,
    resultItemIds: [...params.request.resultItemIds, ...(params.resultItemIds ?? [])],
  })
}

export const resolveReferences = (params: {
  readonly request: GenerationRequest
  readonly items: readonly Item[]
  readonly tags: readonly Tag[]
  readonly absolutePathOf: (fileName: string) => string
}): ResolvedReference[] =>
  params.request.references.flatMap((reference) => {
    const item = findById({ list: params.items, id: reference.itemId })
    if (item === undefined) return []
    return [
      {
        label: reference.label,
        itemId: item.id,
        title: item.title,
        kind: item.kind,
        mimeType: item.media.mimeType,
        absolutePath: params.absolutePathOf(item.media.fileName),
        mediaUrl: mediaUrlOf(item.media),
        sourceUrl: item.metadata.sourceUrl,
        tags: tagNamesOf({ item, tags: params.tags }),
        notes: item.metadata.notes,
      },
    ]
  })

export type Box = { readonly position: Vec2; readonly size: Size }

/** Results are stacked in a column to the right of the references they were made from. */
export const resultPosition = (params: {
  readonly anchors: readonly Box[]
  readonly fallback: Vec2
  readonly index: number
  readonly slotHeight: number
}): Vec2 => {
  if (params.anchors.length === 0)
    return { x: params.fallback.x, y: params.fallback.y + params.index * params.slotHeight }
  const right = Math.max(...params.anchors.map((box) => box.position.x + box.size.width))
  const top = Math.min(...params.anchors.map((box) => box.position.y))
  return { x: right + PLACEMENT_GAP, y: top + params.index * params.slotHeight }
}
