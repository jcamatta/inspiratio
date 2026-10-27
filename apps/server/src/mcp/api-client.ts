import {
  ApiErrorSchema,
  err,
  formatTraceparent,
  ok,
  parseJsonBody,
  TRACEPARENT_HEADER,
  type Result,
  type TraceContext,
} from '@inspiratio/shared'
import type { z } from 'zod'
import type { FetchFn } from '../shared/media/remote-media.ts'

export type ApiRequest<S extends z.ZodType> = {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  readonly path: string
  readonly body?: unknown
  readonly trace: TraceContext
  readonly schema: S
}

export type ApiClient = {
  readonly request: <S extends z.ZodType>(params: ApiRequest<S>) => Promise<Result<z.output<S>>>
}

/** HTTP adapter the MCP server uses to talk to the Inspiratio backend, propagating the trace. */
export const createApiClient = (params: {
  readonly baseUrl: string
  readonly fetchFn: FetchFn
}): ApiClient => {
  const request = async <S extends z.ZodType>(
    call: ApiRequest<S>,
  ): Promise<Result<z.output<S>>> => {
    try {
      const response = await params.fetchFn(`${params.baseUrl}${call.path}`, {
        method: call.method,
        headers: {
          'content-type': 'application/json',
          [TRACEPARENT_HEADER]: formatTraceparent(call.trace),
        },
        body: call.body === undefined ? null : JSON.stringify(call.body),
      })
      const text = await response.text()
      const payload = parseJsonBody(text)
      if (!response.ok) {
        const apiError = ApiErrorSchema.safeParse(payload)
        return err(
          apiError.success
            ? {
                code: 'upstream',
                message: `${apiError.data.error.code}: ${apiError.data.error.message}`,
              }
            : { code: 'upstream', message: `HTTP ${response.status}` },
        )
      }
      const parsed = call.schema.safeParse(payload)
      return parsed.success
        ? ok(parsed.data)
        : err({ code: 'upstream', message: 'Unexpected response from Inspiratio' })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return err({
        code: 'upstream',
        message: `Cannot reach Inspiratio at ${params.baseUrl} (${message}). Is \`npm run dev\` running?`,
      })
    }
  }
  return { request }
}
