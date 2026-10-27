/** W3C Trace Context helpers (https://www.w3.org/TR/trace-context/). Pure functions only. */

export type TraceContext = {
  readonly traceId: string
  readonly spanId: string
  readonly parentSpanId: string | null
}

export const TRACEPARENT_HEADER = 'traceparent'

const TRACEPARENT_PATTERN = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/
const INVALID_TRACE_ID = '0'.repeat(32)
const INVALID_SPAN_ID = '0'.repeat(16)

export const randomHex = (params: { readonly bytes: number }): string => {
  const buffer = new Uint8Array(params.bytes)
  globalThis.crypto.getRandomValues(buffer)
  return Array.from(buffer, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const newTraceId = (): string => randomHex({ bytes: 16 })

export const newSpanId = (): string => randomHex({ bytes: 8 })

export const startTrace = (): TraceContext => ({
  traceId: newTraceId(),
  spanId: newSpanId(),
  parentSpanId: null,
})

export const childSpan = (parent: TraceContext): TraceContext => ({
  traceId: parent.traceId,
  spanId: newSpanId(),
  parentSpanId: parent.spanId,
})

export const formatTraceparent = (context: TraceContext): string =>
  `00-${context.traceId}-${context.spanId}-01`

export const parseTraceparent = (header: string | null | undefined): TraceContext | null => {
  const match = TRACEPARENT_PATTERN.exec(header?.trim().toLowerCase() ?? '')
  const traceId = match?.[1]
  const spanId = match?.[2]
  if (traceId === undefined || spanId === undefined) return null
  if (traceId === INVALID_TRACE_ID || spanId === INVALID_SPAN_ID) return null
  return { traceId, spanId, parentSpanId: null }
}

/** Continues an incoming trace (new span, parent = caller span) or starts a fresh one. */
export const continueTrace = (header: string | null | undefined): TraceContext => {
  const incoming = parseTraceparent(header)
  return incoming === null ? startTrace() : childSpan(incoming)
}

/** Resumes a trace that is only known by id (e.g. persisted on a generation request). */
export const resumeTrace = (traceId: string): TraceContext =>
  /^[0-9a-f]{32}$/.test(traceId)
    ? { traceId, spanId: newSpanId(), parentSpanId: null }
    : startTrace()
