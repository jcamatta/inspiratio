import type { Result } from '@inspiratio/shared'
import type { z } from 'zod'
import type { Handler, HttpRequest, HttpResponse } from './http.types.ts'
import { errorResponse, fromResult, parseWith } from './responses.ts'

/** Validates the JSON body with a schema, runs the use case and maps its result to HTTP. */
export const withBody = <S extends z.ZodType, T>(params: {
  readonly schema: S
  readonly run: (input: {
    readonly body: z.output<S>
    readonly request: HttpRequest
  }) => Promise<Result<T>>
  readonly onOk: (value: T) => HttpResponse
}): Handler => {
  return async (request) => {
    const body = parseWith({ schema: params.schema, input: request.body })
    if (!body.ok) return errorResponse({ error: body.error, traceId: request.trace.traceId })
    const result = await params.run({ body: body.value, request })
    return fromResult({ result, traceId: request.trace.traceId, onOk: params.onOk })
  }
}

/** Runs a use case that only needs the request (path params, query) and maps its result. */
export const withRequest = <T>(params: {
  readonly run: (request: HttpRequest) => Promise<Result<T>> | Result<T>
  readonly onOk: (value: T) => HttpResponse
}): Handler => {
  return async (request) => {
    const result = await params.run(request)
    return fromResult({ result, traceId: request.trace.traceId, onOk: params.onOk })
  }
}

export const pathId = (request: HttpRequest): string => request.params.id ?? ''
