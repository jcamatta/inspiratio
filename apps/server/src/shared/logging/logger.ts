import {
  isLevelEnabled,
  type LogFields,
  type LogLevel,
  type LogRecord,
  type TraceContext,
} from '@inspiratio/shared'
import type { Clock } from '../lib/runtime.ts'

/** Structured logging without third-party libraries: records are plain data, sinks are actions. */
export type LogEntry = { readonly msg: string } & LogFields

export type LogSink = (record: LogRecord) => void

export type Logger = {
  readonly debug: (entry: LogEntry) => void
  readonly info: (entry: LogEntry) => void
  readonly warn: (entry: LogEntry) => void
  readonly error: (entry: LogEntry) => void
  /** Emits an already-built record (e.g. forwarded from the browser), bypassing enrichment. */
  readonly write: (record: LogRecord) => void
  readonly child: (fields: LogFields) => Logger
}

export type LoggerOptions = {
  readonly service: string
  readonly sinks: readonly LogSink[]
  readonly minLevel: LogLevel
  readonly clock: Clock
  readonly getTrace: () => TraceContext | undefined
  readonly baseFields?: LogFields
}

export const buildRecord = (params: {
  readonly level: LogLevel
  readonly service: string
  readonly ts: string
  readonly entry: LogEntry
  readonly trace: TraceContext | undefined
  readonly baseFields: LogFields
}): LogRecord => {
  const { msg, ...fields } = params.entry
  return {
    ts: params.ts,
    level: params.level,
    service: params.service,
    msg,
    traceId: params.trace?.traceId ?? null,
    spanId: params.trace?.spanId ?? null,
    parentSpanId: params.trace?.parentSpanId ?? null,
    fields: { ...params.baseFields, ...fields },
  }
}

export const createLogger = (options: LoggerOptions): Logger => {
  const baseFields = options.baseFields ?? {}

  const emit = (record: LogRecord): void => {
    if (!isLevelEnabled({ level: record.level, minLevel: options.minLevel })) return
    for (const sink of options.sinks) sink(record)
  }

  const log =
    (level: LogLevel) =>
    (entry: LogEntry): void => {
      emit(
        buildRecord({
          level,
          service: options.service,
          ts: options.clock(),
          entry,
          trace: options.getTrace(),
          baseFields,
        }),
      )
    }

  return {
    debug: log('debug'),
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
    write: emit,
    child: (fields) => createLogger({ ...options, baseFields: { ...baseFields, ...fields } }),
  }
}

/** A logger that drops everything, for tests that do not assert on logs. */
export const silentLogger = (): Logger =>
  createLogger({
    service: 'silent',
    sinks: [],
    minLevel: 'error',
    clock: () => '',
    getTrace: () => undefined,
  })

/** Collects records in memory so tests can assert on them. */
export const memorySink = (): { readonly sink: LogSink; readonly records: LogRecord[] } => {
  const records: LogRecord[] = []
  return { sink: (record) => records.push(record), records }
}
