import type { TraceContext } from '@inspiratio/shared'
import type { Logger } from '../logging/logger.ts'

export type UploadedFile = {
  readonly originalName: string
  readonly mimeType: string
  readonly bytes: Uint8Array
}

/** Framework-agnostic request: controllers never see Express objects. */
export type HttpRequest = {
  readonly params: Readonly<Record<string, string>>
  readonly query: Readonly<Record<string, unknown>>
  readonly body: unknown
  readonly files: readonly UploadedFile[]
  readonly trace: TraceContext
  readonly logger: Logger
}

export type HttpResponse = {
  readonly status: number
  readonly body?: unknown
}

export type Handler = (request: HttpRequest) => Promise<HttpResponse>

export type HttpMethod = 'get' | 'post' | 'patch' | 'put' | 'delete'

export type Route = {
  readonly method: HttpMethod
  readonly path: string
  readonly handler: Handler
  /** Accept multipart uploads in the `files` field. */
  readonly upload?: boolean
}
