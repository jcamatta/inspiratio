import { err, ok, type AppError, type AppErrorCode, type Result } from '@inspiratio/shared'
import type { z } from 'zod'
import type { HttpResponse } from './http.types.ts'

const STATUS_BY_CODE: Readonly<Record<AppErrorCode, number>> = {
  validation: 400,
  not_found: 404,
  conflict: 409,
  invalid_state: 409,
  unsupported_media: 415,
  upstream: 502,
}

export const statusOf = (code: AppErrorCode): number => STATUS_BY_CODE[code]

export const errorResponse = (params: {
  readonly error: AppError
  readonly traceId: string | null
}): HttpResponse => ({
  status: statusOf(params.error.code),
  body: { error: { ...params.error, traceId: params.traceId } },
})

export const json = (body: unknown): HttpResponse => ({ status: 200, body })

export const created = (body: unknown): HttpResponse => ({ status: 201, body })

export const noContent = (): HttpResponse => ({ status: 204 })

/** Maps a command/query result to HTTP: success goes through `onOk`, failures become error bodies. */
export const fromResult = <T>(params: {
  readonly result: Result<T>
  readonly traceId: string
  readonly onOk: (value: T) => HttpResponse
}): HttpResponse =>
  params.result.ok
    ? params.onOk(params.result.value)
    : errorResponse({ error: params.result.error, traceId: params.traceId })

export const formatIssues = (issues: readonly z.core.$ZodIssue[]): string =>
  issues
    .map((issue) => (issue.path.length > 0 ? `${issue.path.join('.')}: ` : '') + issue.message)
    .join('; ')

export const parseWith = <S extends z.ZodType>(params: {
  readonly schema: S
  readonly input: unknown
}): Result<z.output<S>> => {
  const parsed = params.schema.safeParse(params.input)
  return parsed.success
    ? ok(parsed.data)
    : err({ code: 'validation', message: formatIssues(parsed.error.issues) })
}
