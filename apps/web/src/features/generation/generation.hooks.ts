import type { GenerationRequest } from '@inspiratio/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useCommand } from '../../shared/api/use-command.ts'
import { BOARD_QUERY_KEY } from '../board/api/board.api.ts'
import { GENERATIONS_QUERY_KEY, generationApi } from './api/generation.api.ts'

export const isActive = (request: GenerationRequest): boolean =>
  request.status === 'pending' || request.status === 'in_progress'

/** Polls fast while Claude is working on something, slowly otherwise. */
export const pollInterval = (requests: readonly GenerationRequest[]): number =>
  requests.some(isActive) ? 2500 : 15000

export const finishedIds = (requests: readonly GenerationRequest[]): string =>
  requests
    .filter((request) => request.status === 'completed')
    .map((request) => request.id)
    .join(',')

export const useGenerationsQuery = () => {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: GENERATIONS_QUERY_KEY,
    queryFn: generationApi.list,
    refetchInterval: (current) => pollInterval(current.state.data ?? []),
  })
  const requests = query.data ?? []
  const completed = finishedIds(requests)
  const previous = useRef(completed)

  // When Claude completes a request the results land on the board: refresh it.
  useEffect(() => {
    if (previous.current !== completed)
      void queryClient.invalidateQueries({ queryKey: BOARD_QUERY_KEY })
    previous.current = completed
  }, [completed, queryClient])

  return { requests }
}

const GENERATIONS = [GENERATIONS_QUERY_KEY]

export const useGenerationCommands = () => ({
  create: useCommand({
    name: 'generation.queue',
    call: generationApi.create,
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
    errorTitle: 'Could not delete the request',
  }),
})
