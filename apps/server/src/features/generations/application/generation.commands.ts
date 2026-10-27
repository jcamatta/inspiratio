import {
  err,
  notFound,
  ok,
  type CompleteGenerationCommand,
  type CreateGenerationCommand,
  type GenerationRequest,
  type GenerationResult,
  type GenerationStatus,
  type Result,
} from '@inspiratio/shared'
import { findById, removeById, upsert } from '../../../shared/lib/collections.ts'
import { fetchRemoteMedia } from '../../../shared/media/remote-media.ts'
import type { ItemDeps } from '../../items/application/item.deps.ts'
import { ingestMedia } from '../../items/application/ingest-media.ts'
import {
  absolutePositionOf,
  INITIAL_EDGE,
  nextFreePosition,
  PLACEMENT_GAP,
} from '../../items/domain/item.ts'
import { generatedTagNames } from '../../tags/domain/tag.ts'
import { createGenerationRequest, resultPosition, transition } from '../domain/generation.ts'

export const createGenerationCommands = (deps: ItemDeps) => {
  const create = async (params: {
    readonly input: CreateGenerationCommand
    readonly traceId: string
  }): Promise<Result<{ readonly id: string }>> => {
    const items = deps.store.read().items
    const missing = params.input.referenceItemIds.find(
      (id) => findById({ list: items, id }) === undefined,
    )
    if (missing !== undefined) return notFound({ entity: 'Item', id: missing })
    const request = createGenerationRequest({
      id: deps.newId({ prefix: 'gen' }),
      now: deps.clock(),
      traceId: params.traceId,
      input: params.input,
    })
    await deps.store.update((state) => ({ ...state, generations: [...state.generations, request] }))
    deps.logger.info({
      msg: 'generation.requested',
      generationId: request.id,
      kind: request.kind,
      model: request.model,
      references: request.references.length,
    })
    return ok({ id: request.id })
  }

  const move = async (params: {
    readonly id: string
    readonly to: GenerationStatus
    readonly error?: string
    readonly resultItemIds?: readonly string[]
  }): Promise<Result<GenerationRequest>> => {
    const request = findById({ list: deps.store.read().generations, id: params.id })
    if (request === undefined) return notFound({ entity: 'Generation', id: params.id })
    const next = transition({ ...params, request, now: deps.clock() })
    if (!next.ok) return next
    await deps.store.update((state) => ({
      ...state,
      generations: upsert({ list: state.generations, entity: next.value }),
    }))
    deps.logger.info({
      msg: 'generation.status_changed',
      generationId: params.id,
      status: params.to,
    })
    return next
  }

  const bytesOf = async (result: GenerationResult): Promise<Result<Uint8Array>> => {
    if ('url' in result.source) {
      const remote = await fetchRemoteMedia({
        url: result.source.url,
        fetchFn: deps.fetchFn,
        maxBytes: deps.maxImportBytes,
        timeoutMs: deps.fetchTimeoutMs,
      })
      return remote.ok ? ok(remote.value.bytes) : remote
    }
    return deps.readFile({ filePath: result.source.filePath, maxBytes: deps.maxImportBytes })
  }

  /**
   * Imports the generated files into the library next to their references, tagged as AI
   * output with provider + model, and carrying the prompt as metadata.
   */
  const complete = async (params: {
    readonly id: string
    readonly input: CompleteGenerationCommand
  }): Promise<Result<{ readonly ids: string[] }>> => {
    const state = deps.store.read()
    const request = findById({ list: state.generations, id: params.id })
    if (request === undefined) return notFound({ entity: 'Generation', id: params.id })
    if (request.status === 'completed' || request.status === 'failed')
      return err({
        code: 'invalid_state',
        message: `Generation ${request.id} is ${request.status}`,
      })

    const anchors = request.references.flatMap((reference) => {
      const item = findById({ list: state.items, id: reference.itemId })
      return item === undefined
        ? []
        : [{ position: absolutePositionOf({ item, sections: state.sections }), size: item.size }]
    })
    const fallback = nextFreePosition(state.items)
    const ids: string[] = []
    const failures: string[] = []

    for (const [index, result] of params.input.results.entries()) {
      const bytes = await bytesOf(result)
      const ingested = bytes.ok
        ? await ingestMedia({
            deps,
            input: {
              bytes: bytes.value,
              origin: 'generated',
              sourceUrl: 'url' in result.source ? result.source.url : null,
              originalFileName: null,
              title: result.title ?? `${result.model} · ${request.prompt.slice(0, 60)}`,
              position: resultPosition({
                anchors,
                fallback,
                index,
                slotHeight: INITIAL_EDGE + PLACEMENT_GAP,
              }),
              sectionId: null,
              generation: {
                requestId: request.id,
                provider: result.provider,
                model: result.model,
                prompt: request.prompt,
                referenceItemIds: request.references.map((reference) => reference.itemId),
              },
              systemTagNames: generatedTagNames({ provider: result.provider, model: result.model }),
            },
          })
        : bytes
      if (ingested.ok) ids.push(ingested.value.id)
      else failures.push(ingested.error.message)
    }

    if (ids.length === 0) {
      const message = `No result could be imported: ${failures.join('; ')}`
      await move({ id: request.id, to: 'failed', error: message })
      return err({ code: 'upstream', message })
    }
    if (failures.length > 0)
      deps.logger.warn({ msg: 'generation.partial_import', generationId: request.id, failures })
    const moved = await move({ id: request.id, to: 'completed', resultItemIds: ids })
    return moved.ok ? ok({ ids }) : moved
  }

  const start = (params: { readonly id: string }) => move({ id: params.id, to: 'in_progress' })

  const fail = (params: { readonly id: string; readonly error: string }) =>
    move({ id: params.id, to: 'failed', error: params.error })

  const retry = (params: { readonly id: string }) => move({ id: params.id, to: 'pending' })

  const remove = async (params: { readonly id: string }): Promise<Result<undefined>> => {
    if (findById({ list: deps.store.read().generations, id: params.id }) === undefined)
      return notFound({ entity: 'Generation', id: params.id })
    await deps.store.update((state) => ({
      ...state,
      generations: removeById({ list: state.generations, id: params.id }),
    }))
    return ok(undefined)
  }

  return { create, start, complete, fail, retry, remove }
}

export type GenerationCommands = ReturnType<typeof createGenerationCommands>
