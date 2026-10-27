import type { GenerationRequest, GenerationStatus } from '@inspiratio/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useCommand } from '../../shared/api/use-command.ts'
import { notify } from '../../shared/ui/index.ts'
import { BOARD_QUERY_KEY } from '../board/api/board.api.ts'
import { GENERATIONS_QUERY_KEY, generationApi } from './api/generation.api.ts'

export const isActive = (request: GenerationRequest): boolean =>
  request.status === 'pending' || request.status === 'in_progress'

export const pollInterval = (requests: readonly GenerationRequest[]): number =>
  requests.some(isActive) ? 2500 : 15000

export type StatusChange = {
  readonly request: GenerationRequest
  readonly from: GenerationStatus
}

/** Requests whose status changed between two polls (new requests are ignored). */
export const statusChanges = (params: {
  readonly previous: ReadonlyMap<string, GenerationStatus>
  readonly next: readonly GenerationRequest[]
}): StatusChange[] =>
  params.next.flatMap((request) => {
    const from = params.previous.get(request.id)
    return from === undefined || from === request.status ? [] : [{ request, from }]
  })

export const announce = (change: StatusChange): void => {
  const { request } = change
  if (request.status === 'completed')
    notify({
      title: 'Generation finished',
      description: `${request.resultItemIds.length} result(s) added next to the prompt`,
      tone: 'success',
    })
  if (request.status === 'failed')
    notify({ title: 'Generation failed', description: request.error ?? undefined, tone: 'error' })
  if (request.status === 'in_progress') notify({ title: 'Claude started generating' })
}

const EMPTY: readonly GenerationRequest[] = []

export const useGenerationsQuery = () => {
  const query = useQuery({
    queryKey: GENERATIONS_QUERY_KEY,
    queryFn: generationApi.list,
    refetchInterval: (current) => pollInterval(current.state.data ?? []),
  })
  return { requests: query.data ?? EMPTY }
}

/** Mounted once: toasts when a request starts, finishes or fails, and refreshes the board. */
export const useGenerationNotifications = () => {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: GENERATIONS_QUERY_KEY,
    queryFn: generationApi.list,
    refetchInterval: (current) => pollInterval(current.state.data ?? []),
  })
  const previous = useRef<ReadonlyMap<string, GenerationStatus> | null>(null)

  useEffect(() => {
    if (query.data === undefined) return
    const changes =
      previous.current === null
        ? []
        : statusChanges({ previous: previous.current, next: query.data })
    previous.current = new Map(query.data.map((request) => [request.id, request.status]))
    for (const change of changes) announce(change)
    if (changes.some((change) => change.request.status === 'completed'))
      void queryClient.invalidateQueries({ queryKey: BOARD_QUERY_KEY })
  }, [query.data, queryClient])
}

const GENERATIONS = [GENERATIONS_QUERY_KEY]

export const useGenerationCommands = () => ({
  create: useCommand({
    name: 'generation.create',
    call: generationApi.create,
    invalidate: GENERATIONS,
    errorTitle: 'Could not create the prompt',
  }),
  update: useCommand({
    name: 'generation.update',
    call: generationApi.update,
    invalidate: GENERATIONS,
    errorTitle: 'Could not save the prompt',
  }),
  submit: useCommand({
    name: 'generation.submit',
    call: generationApi.submit,
    invalidate: GENERATIONS,
    errorTitle: 'Could not queue the prompt',
  }),
  retry: useCommand({
    name: 'generation.retry',
    call: generationApi.retry,
    invalidate: GENERATIONS,
    errorTitle: 'Could not retry',
  }),
  remove: useCommand({
    name: 'generation.remove',
    call: generationApi.remove,
    invalidate: GENERATIONS,
    errorTitle: 'Could not delete the prompt',
  }),
})

export type GenerationCommands = ReturnType<typeof useGenerationCommands>
