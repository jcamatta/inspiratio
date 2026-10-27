import {
  err,
  gridSlot,
  notFound,
  ok,
  type ApplyLayoutInput,
  type ImportFileInput,
  type ImportPlacement,
  type ImportUrlInput,
  type Item,
  type ReportMediaDimensionsInput,
  type Result,
  type SetItemTagsInput,
  type UpdateItemInput,
} from '@inspiratio/shared'
import { findById, removeById, upsert, upsertMany } from '../../../shared/lib/collections.ts'
import { fetchRemoteMedia } from '../../../shared/media/remote-media.ts'
import type { UploadedFile } from '../../../shared/http/http.types.ts'
import { applyLayoutChange, setItemTags, updateItem, withMediaDimensions } from '../domain/item.ts'
import type { ItemDeps } from './item.deps.ts'
import { ingestMedia } from './ingest-media.ts'

/** Commands mutate state and return at most the id of what they created (CQS). */
export type ItemCommands = ReturnType<typeof createItemCommands>

type Id = { readonly id: string }

export const createItemCommands = (deps: ItemDeps) => {
  const importUploads = async (params: {
    readonly files: readonly UploadedFile[]
    readonly placement: ImportPlacement
  }): Promise<Result<{ readonly ids: string[] }>> => {
    if (params.files.length === 0) return err({ code: 'validation', message: 'No files uploaded' })
    const ids: string[] = []
    for (const [index, file] of params.files.entries()) {
      const result = await ingestMedia({
        deps,
        input: {
          bytes: file.bytes,
          origin: 'upload',
          sourceUrl: null,
          originalFileName: file.originalName,
          title: params.files.length === 1 ? params.placement.title : undefined,
          position:
            params.placement.position === undefined
              ? undefined
              : gridSlot({ origin: params.placement.position, index }),
          sectionId: params.placement.sectionId,
        },
      })
      if (!result.ok) return result
      ids.push(result.value.id)
    }
    return ok({ ids })
  }

  const importUrl = async (input: ImportUrlInput): Promise<Result<Id>> => {
    const remote = await fetchRemoteMedia({
      url: input.url,
      fetchFn: deps.fetchFn,
      maxBytes: deps.maxImportBytes,
      timeoutMs: deps.fetchTimeoutMs,
    })
    if (!remote.ok) return remote
    const result = await ingestMedia({
      deps,
      input: {
        bytes: remote.value.bytes,
        origin: 'url',
        sourceUrl: input.url,
        originalFileName: null,
        title: input.title,
        position: input.position,
        sectionId: input.sectionId,
      },
    })
    return result.ok ? ok({ id: result.value.id }) : result
  }

  const importFile = async (input: ImportFileInput): Promise<Result<Id>> => {
    const file = await deps.readFile({ filePath: input.filePath, maxBytes: deps.maxImportBytes })
    if (!file.ok) return file
    const result = await ingestMedia({
      deps,
      input: {
        bytes: file.value,
        origin: 'file',
        sourceUrl: null,
        originalFileName: input.filePath.split(/[\\/]/).at(-1) ?? null,
        title: input.title,
        position: input.position,
        sectionId: input.sectionId,
      },
    })
    return result.ok ? ok({ id: result.value.id }) : result
  }

  /** Applies a pure item transformation to one item, or fails with not_found. */
  const modify = async (params: {
    readonly id: string
    readonly change: (item: Item) => Item
  }): Promise<Result<undefined>> => {
    if (findById({ list: deps.store.read().items, id: params.id }) === undefined)
      return notFound({ entity: 'Item', id: params.id })
    await deps.store.update((state) => {
      const item = findById({ list: state.items, id: params.id })
      if (item === undefined) return state
      return { ...state, items: upsert({ list: state.items, entity: params.change(item) }) }
    })
    return ok(undefined)
  }

  const update = (params: { readonly id: string; readonly patch: UpdateItemInput }) =>
    modify({
      id: params.id,
      change: (item) => updateItem({ item, patch: params.patch, now: deps.clock() }),
    })

  const setTags = async (params: {
    readonly id: string
    readonly input: SetItemTagsInput
  }): Promise<Result<undefined>> => {
    const known = new Set(deps.store.read().tags.map((tag) => tag.id))
    const unknown = params.input.tagIds.find((tagId) => !known.has(tagId))
    if (unknown !== undefined) return notFound({ entity: 'Tag', id: unknown })
    return modify({
      id: params.id,
      change: (item) => setItemTags({ item, tagIds: params.input.tagIds, now: deps.clock() }),
    })
  }

  const reportDimensions = (params: {
    readonly id: string
    readonly input: ReportMediaDimensionsInput
  }) =>
    modify({
      id: params.id,
      change: (item) =>
        withMediaDimensions({
          item,
          width: params.input.width,
          height: params.input.height,
          now: deps.clock(),
        }),
    })

  /** Layout changes for many items in a single write (multi-select drags, section moves). */
  const applyLayout = async (input: ApplyLayoutInput): Promise<Result<undefined>> => {
    const state = deps.store.read()
    const missing = input.changes.find(
      (change) => findById({ list: state.items, id: change.id }) === undefined,
    )
    if (missing !== undefined) return notFound({ entity: 'Item', id: missing.id })
    const badSection = input.changes.find(
      (change) =>
        typeof change.sectionId === 'string' &&
        findById({ list: state.sections, id: change.sectionId }) === undefined,
    )
    if (badSection?.sectionId) return notFound({ entity: 'Section', id: badSection.sectionId })

    await deps.store.update((current) => {
      const now = deps.clock()
      const changed = input.changes.flatMap((change) => {
        const item = findById({ list: current.items, id: change.id })
        return item === undefined ? [] : [applyLayoutChange({ item, change, now })]
      })
      return { ...current, items: upsertMany({ list: current.items, entities: changed }) }
    })
    return ok(undefined)
  }

  const remove = async (params: Id): Promise<Result<undefined>> => {
    const item = findById({ list: deps.store.read().items, id: params.id })
    if (item === undefined) return notFound({ entity: 'Item', id: params.id })
    await deps.store.update((state) => ({
      ...state,
      items: removeById({ list: state.items, id: params.id }),
      trash: upsert({ list: state.trash, entity: item }),
    }))
    await deps.storage.moveToTrash(item.media.fileName)
    deps.logger.info({ msg: 'item.removed', itemId: item.id })
    return ok(undefined)
  }

  const restore = async (params: Id): Promise<Result<undefined>> => {
    const item = findById({ list: deps.store.read().trash, id: params.id })
    if (item === undefined) return notFound({ entity: 'Deleted item', id: params.id })
    await deps.storage.restoreFromTrash(item.media.fileName)
    await deps.store.update((state) => ({
      ...state,
      trash: removeById({ list: state.trash, id: params.id }),
      items: upsert({ list: state.items, entity: item }),
    }))
    deps.logger.info({ msg: 'item.restored', itemId: item.id })
    return ok(undefined)
  }

  return {
    importUploads,
    importUrl,
    importFile,
    update,
    setTags,
    reportDimensions,
    applyLayout,
    remove,
    restore,
  }
}
