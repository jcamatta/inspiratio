import { describe, expect, it } from 'vitest'
import {
  childSpan,
  continueTrace,
  formatTraceparent,
  newSpanId,
  newTraceId,
  parseTraceparent,
  randomHex,
  resumeTrace,
  startTrace,
} from '../traceparent.ts'

describe('traceparent', () => {
  it('generates hex ids of the W3C sizes', () => {
    expect(newTraceId()).toMatch(/^[0-9a-f]{32}$/)
    expect(newSpanId()).toMatch(/^[0-9a-f]{16}$/)
    expect(randomHex({ bytes: 3 })).toHaveLength(6)
  })

  it('round-trips a trace through the header format', () => {
    const trace = startTrace()
    const parsed = parseTraceparent(formatTraceparent(trace))
    expect(parsed).toEqual({ traceId: trace.traceId, spanId: trace.spanId, parentSpanId: null })
  })

  it.each([
    null,
    undefined,
    '',
    'garbage',
    `00-${'0'.repeat(32)}-${'a'.repeat(16)}-01`,
    `00-${'a'.repeat(32)}-${'0'.repeat(16)}-01`,
  ])('rejects invalid header %s', (header) => {
    expect(parseTraceparent(header)).toBeNull()
  })

  it('creates child spans that keep the trace id', () => {
    const parent = startTrace()
    const child = childSpan(parent)
    expect(child.traceId).toBe(parent.traceId)
    expect(child.parentSpanId).toBe(parent.spanId)
    expect(child.spanId).not.toBe(parent.spanId)
  })

  it('continues an incoming trace or starts a new one', () => {
    const parent = startTrace()
    expect(continueTrace(formatTraceparent(parent)).traceId).toBe(parent.traceId)
    expect(continueTrace(undefined).parentSpanId).toBeNull()
  })

  it('resumes persisted trace ids and ignores invalid ones', () => {
    const traceId = newTraceId()
    expect(resumeTrace(traceId).traceId).toBe(traceId)
    expect(resumeTrace('not-a-trace').traceId).not.toBe('not-a-trace')
  })
})
