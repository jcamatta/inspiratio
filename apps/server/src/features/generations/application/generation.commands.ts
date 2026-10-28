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
  type UpdateGenerationInput,
} from '@inspiratio/shared'
import type { AgentRunner } from '../../../shared/agent/agent-runner.ts'
import type { ProviderCall } from '../../../shared/agent/agent-steps.ts'
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
import {
  CARD_SIZE,
  createGenerationRequest,
  nextRun,
  rememberUploads,
  reportProgress,
  resultPosition,
  startStep,
  transition,
  updateDraft,
} from '../domain/generation.ts'

export type GenerationDeps = ItemDeps & { readonly runAgent: AgentRunner | null }

export const createGenerationCommands = (deps: GenerationDeps) => {
  const running = new Set<string>()
  const providerCalls = new Map<string, ProviderCall>()

  const isOpen = (id: string): boolean => {
    const status = findById({ list: deps.store.read().generations, id })?.status
    return status === 'pending' || status === 'in_progress'
  }

  /** Hands a queued request to the agent; a run that exits with the request still open fails it. */
  const dispatch = (id: string): void => {
    const runAgent = deps.runAgent
    if (runAgent === null || running.has(id)) return
    running.add(id)
    deps.logger.info({ msg: 'agent.started', generationId: id })
    providerCalls.delete(id)
    void runAgent({
      generationId: id,
      onStep: (label) => {
        void recordStep({ id, label })
      },
      onProviderCall: (call) => {
        providerCalls.set(id, call)
        deps.logger.info({ msg: 'agent.provider_call', generationId: id, model: call.model })
      },
    }).then(async (outcome) => {
      running.delete(id)
      providerCalls.delete(id)
      deps.logger.info({ msg: 'agent.finished', generationId: id, exitCode: outcome.exitCode })
      if (isOpen(id))
        await move({
          id,
          to: 'failed',
          error: `Claude stopped without finishing. Log: ${outcome.logFile}`,
        })
    })
  }

  /** Steps are applied inside the store update so they never overwrite a concurrent change. */
  const recordStep = async (params: { readonly id: string; readonly label: string }) => {
    await deps.store.update((state) => {
      const request = findById({ list: state.generations, id: params.id })
      if (request === undefined) return state
      const next = startStep({ request, label: params.label, now: deps.clock() })
      return next === request
        ? state
        : { ...state, generations: upsert({ list: state.generations, entity: next }) }
    })
  }

  const missingItem = (itemIds: readonly string[]): string | undefined => {
    const items = deps.store.read().items
    return itemIds.find((id) => findById({ list: items, id }) === undefined)
  }

  const save = async (request: GenerationRequest): Promise<void> => {
    await deps.store.update((state) => ({
      ...state,
      generations: upsert({ list: state.generations, entity: request }),
    }))
  }

  const create = async (params: {
    readonly input: CreateGenerationCommand
    readonly traceId: string
  }): Promise<Result<{ readonly id: string }>> => {
    const missing = missingItem(params.input.referenceItemIds)
    if (missing !== undefined) return notFound({ entity: 'Item', id: missing })
    const state = deps.store.read()
    const anchors = params.input.referenceItemIds.flatMap((id) => {
      const item = findById({ list: state.items, id })
      return item === undefined
        ? []
        : [{ position: absolutePositionOf({ item, sections: state.sections }), size: item.size }]
    })
    const request = createGenerationRequest({
      id: deps.newId({ prefix: 'gen' }),
      now: deps.clock(),
      traceId: params.traceId,
      position:
        params.input.position ??
        resultPosition({
          anchors,
          fallback: nextFreePosition(state.items),
          index: 0,
          slotHeight: 0,
        }),
      input: params.input,
    })
    await save(request)
    if (request.status === 'pending') dispatch(request.id)
    deps.logger.info({
      msg: request.status === 'draft' ? 'generation.drafted' : 'generation.requested',
      generationId: request.id,
      kind: request.kind,
      model: request.model,
      references: request.references.length,
    })
    return ok({ id: request.id })
  }

  const update = async (params: {
    readonly id: string
    readonly patch: UpdateGenerationInput
  }): Promise<Result<undefined>> => {
    const request = findById({ list: deps.store.read().generations, id: params.id })
    if (request === undefined) return notFound({ entity: 'Generation', id: params.id })
    const missing = missingItem(params.patch.referenceItemIds ?? [])
    if (missing !== undefined) return notFound({ entity: 'Item', id: missing })
    const next = updateDraft({ request, patch: params.patch, now: deps.clock() })
    if (!next.ok) return next
    await save(next.value)
    return ok(undefined)
  }

  const move = async (params: {
    readonly id: string
    readonly to: GenerationStatus
    readonly error?: string
    readonly resultItemIds?: readonly string[]
    readonly traceId?: string
  }): Promise<Result<GenerationRequest>> => {
    const request = findById({ list: deps.store.read().generations, id: params.id })
    if (request === undefined) return notFound({ entity: 'Generation', id: params.id })
    const next = transition({ ...params, request, now: deps.clock() })
    if (!next.ok) return next
    const entity =
      params.traceId === undefined ? next.value : { ...next.value, traceId: params.traceId }
    await save(entity)
    deps.logger.info({
      msg: 'generation.status_changed',
      generationId: params.id,
      status: params.to,
    })
    if (params.to === 'pending') dispatch(params.id)
    return ok(entity)
  }

  const submit = async (params: {
    readonly id: string
    readonly traceId: string
  }): Promise<Result<GenerationRequest>> => {
    const request = findById({ list: deps.store.read().generations, id: params.id })
    if (request === undefined) return notFound({ entity: 'Generation', id: params.id })
    if (request.prompt.trim() === '')
      return err({ code: 'validation', message: 'Write a prompt before generating' })
    const missing = missingItem(request.references.map((reference) => reference.itemId))
    if (missing !== undefined) return notFound({ entity: 'Item', id: missing })
    return move({ id: params.id, to: 'pending', traceId: params.traceId })
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

  /** Results land to the right of their prompt card, tagged with provider and model. */
  const complete = async (params: {
    readonly id: string
    readonly input: CompleteGenerationCommand
  }): Promise<Result<{ readonly ids: string[] }>> => {
    const state = deps.store.read()
    const request = findById({ list: state.generations, id: params.id })
    if (request === undefined) return notFound({ entity: 'Generation', id: params.id })
    if (request.status !== 'pending' && request.status !== 'in_progress')
      return err({
        code: 'invalid_state',
        message: `Generation ${request.id} is ${request.status}`,
      })

    if (params.input.uploads.length > 0)
      await deps.store.update((current) => ({
        ...current,
        items: rememberUploads({ items: current.items, uploads: params.input.uploads }),
      }))

    const anchors = [{ position: request.position, size: CARD_SIZE }]
    const run = nextRun({ items: state.items, requestId: request.id })
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
                fallback: request.position,
                index,
                slotHeight: INITIAL_EDGE + PLACEMENT_GAP,
              }),
              sectionId: null,
              generation: {
                requestId: request.id,
                provider: result.provider,
                model: result.model,
                prompt: request.prompt,
                providerPrompt:
                  params.input.providerPrompt ?? providerCalls.get(request.id)?.prompt ?? null,
                run,
                promptGuide: null,
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

  /** Starting a request that is already in progress resumes it, e.g. from a new agent session. */
  const start = async (params: { readonly id: string }): Promise<Result<GenerationRequest>> => {
    const request = findById({ list: deps.store.read().generations, id: params.id })
    if (request?.status !== 'in_progress') return move({ id: params.id, to: 'in_progress' })
    deps.logger.info({ msg: 'generation.resumed', generationId: params.id })
    return ok(request)
  }

  const fail = (params: { readonly id: string; readonly error: string }) =>
    move({ id: params.id, to: 'failed', error: params.error })

  const progress = async (params: {
    readonly id: string
    readonly message: string
  }): Promise<Result<undefined>> => {
    const request = findById({ list: deps.store.read().generations, id: params.id })
    if (request === undefined) return notFound({ entity: 'Generation', id: params.id })
    const next = reportProgress({ request, message: params.message, now: deps.clock() })
    if (!next.ok) return next
    await save(next.value)
    deps.logger.info({
      msg: 'generation.progress',
      generationId: params.id,
      message: params.message,
    })
    return ok(undefined)
  }

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

  return { create, update, submit, start, progress, complete, fail, retry, remove }
}

export type GenerationCommands = ReturnType<typeof createGenerationCommands>
