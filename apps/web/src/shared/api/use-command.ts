import type { TraceContext } from '@inspiratio/shared'
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useCallback } from 'react'
import { notify } from '../ui/toast-manager.ts'
import { isApiRequestError, startAction } from './http-client.ts'

export type Traced = { readonly trace?: TraceContext }

export type CommandOptions<P, R> = {
  /** Action name used for the trace / logs, e.g. "item.rename". */
  readonly name: string
  /** API action; receives the command params plus the trace of this user action. */
  readonly call: (input: P & Traced) => Promise<R>
  readonly invalidate: readonly QueryKey[]
  readonly errorTitle: string
}

export const describeError = (error: unknown): string => {
  if (!isApiRequestError(error)) return error instanceof Error ? error.message : String(error)
  return error.traceId === null
    ? error.message
    : `${error.message} · trace ${error.traceId.slice(0, 8)}`
}

/**
 * Wraps a command (write) in a traced mutation: one trace per user action, server state is
 * re-fetched afterwards and failures surface as toasts. Resolves `undefined` on failure.
 */
export const useCommand = <P, R>(
  options: CommandOptions<P, R>,
): ((params: P) => Promise<R | undefined>) => {
  const queryClient = useQueryClient()
  const { mutateAsync } = useMutation({
    mutationFn: (params: P) =>
      options.call({ ...params, trace: startAction({ name: options.name }) }),
    onSettled: async () => {
      await Promise.all(
        options.invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      )
    },
  })
  const { errorTitle } = options
  return useCallback(
    async (params: P) => {
      try {
        return await mutateAsync(params)
      } catch (error) {
        notify({ title: errorTitle, description: describeError(error), tone: 'error' })
        return undefined
      }
    },
    [mutateAsync, errorTitle],
  )
}
