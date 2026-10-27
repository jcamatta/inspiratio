import { AsyncLocalStorage } from 'node:async_hooks'
import type { TraceContext } from '@inspiratio/shared'

const storage = new AsyncLocalStorage<TraceContext>()

export const currentTrace = (): TraceContext | undefined => storage.getStore()

export const runWithTrace = <T>(params: {
  readonly trace: TraceContext
  readonly run: () => T
}): T => storage.run(params.trace, params.run)
