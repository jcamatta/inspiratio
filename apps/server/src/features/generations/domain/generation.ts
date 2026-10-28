import {
  err,
  mediaUrlOf,
  ok,
  type CreateGenerationCommand,
  type GenerationKind,
  type GenerationReference,
  type GenerationRequest,
  type GenerationStatus,
  type Item,
  type ProviderUpload,
  type ResolvedReference,
  type Result,
  type Size,
  type Tag,
  type UpdateGenerationInput,
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
  readonly position: Vec2
  readonly input: CreateGenerationCommand
}): GenerationRequest => ({
  id: params.id,
  prompt: params.input.prompt,
  kind: params.input.kind,
  model: params.input.model,
  aspectRatio: params.input.aspectRatio,
  count: params.input.count,
  references: labelReferences(params.input.referenceItemIds),
  status: params.input.submit ? 'pending' : 'draft',
  traceId: params.traceId,
  createdAt: params.now,
  updatedAt: params.now,
  resultItemIds: [],
  error: null,
  position: params.position,
  size: params.input.size ?? null,
  progress: null,
  queuedAt: params.input.submit ? params.now : null,
})

export const CARD_SIZE = { width: 340, height: 420 } as const

/** Model used when the request is on Auto (model null). */
export const DEFAULT_MODELS: Readonly<Record<GenerationKind, string>> = {
  image: 'nano_banana_pro',
  video: 'kling3_0',
}

export const DEFAULT_GUIDE = 'default'

const GUIDE_ID = /^[a-z0-9][a-z0-9_.-]*$/i

export const resolvedModelOf = (params: {
  readonly model: string | null
  readonly kind: GenerationKind
}): string => params.model ?? DEFAULT_MODELS[params.kind]

/** Guides to try in order: the model's own, then the default. Ids unsafe as file names skip to the default. */
export const guideCandidatesOf = (params: { readonly model: string }): string[] =>
  GUIDE_ID.test(params.model) && params.model !== DEFAULT_GUIDE
    ? [params.model, DEFAULT_GUIDE]
    : [DEFAULT_GUIDE]

export const guideFileOf = (params: { readonly guide: string }): string => `${params.guide}.md`

export const updateDraft = (params: {
  readonly request: GenerationRequest
  readonly patch: UpdateGenerationInput
  readonly now: string
}): Result<GenerationRequest> => {
  const { position, size, referenceItemIds, ...content } = params.patch
  const editsContent = [
    content.prompt,
    content.kind,
    content.model,
    content.aspectRatio,
    content.count,
    referenceItemIds,
  ].some((value) => value !== undefined)
  if (editsContent && params.request.status !== 'draft')
    return err({
      code: 'invalid_state',
      message: `Generation ${params.request.id} is no longer a draft`,
    })
  return ok({
    ...params.request,
    prompt: content.prompt ?? params.request.prompt,
    kind: content.kind ?? params.request.kind,
    model: content.model === undefined ? params.request.model : content.model,
    aspectRatio:
      content.aspectRatio === undefined ? params.request.aspectRatio : content.aspectRatio,
    count: content.count ?? params.request.count,
    references:
      referenceItemIds === undefined
        ? params.request.references
        : labelReferences(referenceItemIds),
    position: position ?? params.request.position,
    size: size === undefined ? params.request.size : size,
    updatedAt: params.now,
  })
}

const TRANSITIONS: Readonly<Record<GenerationStatus, readonly GenerationStatus[]>> = {
  draft: ['pending'],
  pending: ['in_progress', 'completed', 'failed'],
  in_progress: ['completed', 'failed', 'pending'],
  completed: ['pending'],
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
    progress: params.to === 'in_progress' ? params.request.progress : null,
    queuedAt: params.to === 'pending' ? params.now : params.request.queuedAt,
  })
}

/** A status line from the agent; reporting on a pending request also marks it as started. */
export const reportProgress = (params: {
  readonly request: GenerationRequest
  readonly message: string
  readonly now: string
}): Result<GenerationRequest> => {
  if (params.request.status !== 'pending' && params.request.status !== 'in_progress')
    return err({
      code: 'invalid_state',
      message: `Generation ${params.request.id} is ${params.request.status}`,
    })
  return ok({
    ...params.request,
    status: 'in_progress',
    progress: params.message,
    updatedAt: params.now,
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
        uploadPath: params.absolutePathOf(item.media.fileName),
        uploadMimeType: item.media.mimeType,
        providerMediaIds: item.metadata.providerMedia,
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

/** Number of the next Generate run of a request, from the results already on the canvas. */
export const nextRun = (params: {
  readonly items: readonly Item[]
  readonly requestId: string
}): number =>
  1 +
  Math.max(
    0,
    ...params.items
      .map((item) => item.metadata.generation)
      .filter((generation) => generation?.requestId === params.requestId)
      .map((generation) => generation?.run ?? 0),
  )

/** Records provider media ids on the uploaded items so later requests can reuse them. */
export const rememberUploads = (params: {
  readonly items: readonly Item[]
  readonly uploads: readonly ProviderUpload[]
}): Item[] =>
  params.items.map((item) => {
    const own = params.uploads.filter((upload) => upload.itemId === item.id)
    if (own.length === 0) return item
    const providerMedia = Object.fromEntries(
      own.map((upload) => [upload.provider, upload.mediaId] as const),
    )
    return {
      ...item,
      metadata: {
        ...item.metadata,
        providerMedia: { ...item.metadata.providerMedia, ...providerMedia },
      },
    }
  })
