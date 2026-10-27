import {
  ApiErrorSchema,
  childSpan,
  formatTraceparent,
  parseJsonBody,
  startTrace,
  TRACEPARENT_HEADER,
  type TraceContext,
} from '@inspiratio/shared'
import type { z } from 'zod'
import { logger, type BrowserLogger } from '../observability/logger.ts'

export type ApiRequestError = Error & {
  readonly kind: 'api_error'
  readonly code: string
  readonly status: number
  readonly traceId: string | null
}

export const apiError = (params: {
  readonly message: string
  readonly code: string
  readonly status: number
  readonly traceId: string | null
}): ApiRequestError =>
  Object.assign(new Error(params.message), {
    kind: 'api_error' as const,
    code: params.code,
    status: params.status,
    traceId: params.traceId,
  })

export const isApiRequestError = (value: unknown): value is ApiRequestError =>
  value instanceof Error && 'kind' in value && value.kind === 'api_error'

export type RequestParams<S extends z.ZodType> = {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  readonly path: string
  readonly schema: S
  readonly body?: unknown
  readonly form?: FormData
  /** The user action this request belongs to; a fresh trace is started when omitted. */
  readonly trace?: TraceContext
}

export type HttpClient = {
  readonly request: <S extends z.ZodType>(params: RequestParams<S>) => Promise<z.output<S>>
}

/** Fetch adapter: propagates W3C trace context, logs each call and validates responses with zod. */
export const createHttpClient = (deps: {
  readonly fetchFn: typeof fetch
  readonly logger: BrowserLogger
}): HttpClient => {
  const request = async <S extends z.ZodType>(params: RequestParams<S>): Promise<z.output<S>> => {
    const trace = params.trace === undefined ? startTrace() : childSpan(params.trace)
    const headers: Record<string, string> = { [TRACEPARENT_HEADER]: formatTraceparent(trace) }
    if (params.body !== undefined) headers['content-type'] = 'application/json'
    const startedAt = performance.now()
    deps.logger.debug({ msg: 'api.request', trace, method: params.method, path: params.path })

    const response = await deps.fetchFn(params.path, {
      method: params.method,
      headers,
      body: params.form ?? (params.body === undefined ? null : JSON.stringify(params.body)),
    })
    const text = await response.text()
    const payload = parseJsonBody(text)
    const durationMs = Math.round(performance.now() - startedAt)

    if (!response.ok) {
      const parsed = ApiErrorSchema.safeParse(payload)
      const error = apiError({
        message: parsed.success ? parsed.data.error.message : `Request failed (${response.status})`,
        code: parsed.success ? parsed.data.error.code : 'unknown',
        status: response.status,
        traceId: trace.traceId,
      })
      deps.logger.warn({
        msg: 'api.failed',
        trace,
        method: params.method,
        path: params.path,
        status: response.status,
        code: error.code,
        durationMs,
      })
      throw error
    }

    deps.logger.debug({
      msg: 'api.response',
      trace,
      path: params.path,
      status: response.status,
      durationMs,
    })
    const parsed = params.schema.safeParse(payload)
    if (!parsed.success) {
      deps.logger.error({ msg: 'api.invalid_response', trace, path: params.path })
      throw apiError({
        message: 'Unexpected response from server',
        code: 'invalid_response',
        status: 500,
        traceId: trace.traceId,
      })
    }
    return parsed.data
  }
  return { request }
}

export const http: HttpClient = createHttpClient({ fetchFn: (...args) => fetch(...args), logger })

/** Starts a trace for a user action; every request made for it shares the trace id. */
export const startAction = (params: {
  readonly name: string
  readonly fields?: Record<string, unknown>
}): TraceContext => {
  const trace = startTrace()
  logger.info({ msg: 'ui.action', trace, action: params.name, ...params.fields })
  return trace
}
