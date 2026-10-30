import {
  err,
  ok,
  type GenerationInfo,
  type Item,
  type ItemOrigin,
  type Result,
  type Vec2,
} from '@inspiratio/shared'
import { findById } from '../../../shared/lib/collections.ts'
import { detectMediaType, probeImageDimensions } from '../../../shared/media/media-type.ts'
import { ensureTags } from '../../tags/domain/tag.ts'
import { createItem, nextFreePosition, nextZIndex, titleFromSource } from '../domain/item.ts'
import type { ItemDeps } from './item.deps.ts'

export type IngestMediaInput = {
  readonly bytes: Uint8Array
  readonly origin: ItemOrigin
  readonly sourceUrl: string | null
  readonly originalFileName: string | null
  readonly title?: string | undefined
  readonly position?: Vec2 | undefined
  readonly sectionId?: string | null | undefined
  readonly generation?: GenerationInfo | null
  readonly systemTagNames?: readonly string[]
}

/**
 * Action shared by every import path (upload, URL, local file, AI result): validates the bytes,
 * stores the file and appends the item. All decisions are delegated to pure domain functions.
 */
export const ingestMedia = async (params: {
  readonly deps: ItemDeps
  readonly input: IngestMediaInput
}): Promise<Result<Item>> => {
  const { deps, input } = params
  const type = detectMediaType(input.bytes)
  if (type === null)
    return err({
      code: 'unsupported_media',
      message: 'Only images, videos and audio are supported',
    })

  const dimensions = type.kind === 'image' ? probeImageDimensions(input.bytes) : null
  const id = deps.newId({ prefix: 'itm' })
  const fileName = `${id}.${type.extension}`
  await deps.storage.save({ fileName, bytes: input.bytes })

  let created: Item | undefined
  await deps.store.update((state) => {
    const now = deps.clock()
    const tagged = ensureTags({
      tags: state.tags,
      names: input.systemTagNames ?? [],
      system: true,
      now,
      newId: deps.newId,
    })
    const sectionId =
      input.sectionId !== undefined &&
      input.sectionId !== null &&
      findById({ list: state.sections, id: input.sectionId }) !== undefined
        ? input.sectionId
        : null
    created = createItem({
      id,
      now,
      kind: type.kind,
      fileName,
      mimeType: type.mimeType,
      bytes: input.bytes.byteLength,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      title: titleFromSource({
        title: input.title,
        originalFileName: input.originalFileName,
        sourceUrl: input.sourceUrl,
      }),
      position: input.position ?? nextFreePosition(state.items),
      sectionId,
      zIndex: nextZIndex(state.items),
      origin: input.origin,
      sourceUrl: input.sourceUrl,
      originalFileName: input.originalFileName,
      tagIds: tagged.ids,
      generation: input.generation ?? null,
    })
    return { ...state, tags: tagged.tags, items: [...state.items, created] }
  })

  if (created === undefined) return err({ code: 'invalid_state', message: 'Item was not stored' })
  deps.logger.info({
    msg: 'item.ingested',
    itemId: created.id,
    kind: created.kind,
    origin: created.metadata.origin,
    bytes: created.media.bytes,
  })
  return ok(created)
}
