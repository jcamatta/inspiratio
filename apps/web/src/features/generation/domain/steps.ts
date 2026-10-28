import type { GenerationRequest, GenerationStep } from '@inspiratio/shared'

/** Compact duration: 45s, 1m 12s, 1h 3m. */
export const formatDuration = (milliseconds: number): string => {
  const total = Math.max(0, Math.round(milliseconds / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) return `${String(hours)}h ${String(minutes)}m`
  if (minutes > 0) return `${String(minutes)}m ${String(seconds)}s`
  return `${String(seconds)}s`
}

const spanOf = (params: {
  readonly from: string
  readonly to: string | null
  readonly now: number
}): number => (params.to === null ? params.now : Date.parse(params.to)) - Date.parse(params.from)

/** The step the agent is working on, if the run is still going. */
export const currentStep = (request: GenerationRequest): GenerationStep | null => {
  const last = request.steps.at(-1)
  return last?.endedAt === null ? last : null
}

/** Time from queuing to the end of the run, once it completed or failed. */
export const runDuration = (request: GenerationRequest): string | null =>
  request.queuedAt === null || request.finishedAt === null
    ? null
    : formatDuration(spanOf({ from: request.queuedAt, to: request.finishedAt, now: 0 }))

export type StepRow = { readonly label: string; readonly duration: string }

/** Each step with how long it took; a step still running counts up to now. */
export const stepRows = (params: {
  readonly steps: readonly GenerationStep[]
  readonly now: number
}): StepRow[] =>
  params.steps.map((step) => ({
    label: step.label,
    duration: formatDuration(spanOf({ from: step.startedAt, to: step.endedAt, now: params.now })),
  }))
