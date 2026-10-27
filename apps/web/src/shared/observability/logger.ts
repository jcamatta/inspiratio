import {
  isLevelEnabled,
  serializeError,
  type LogFields,
  type LogLevel,
  type LogRecord,
  type TraceContext,
} from '@inspiratio/shared'

/** Browser has no async context, so the trace travels explicitly with each entry. */
export type BrowserLogEntry = {
  readonly msg: string
  readonly trace?: TraceContext | undefined
} & LogFields

export type BrowserLogger = {
  readonly debug: (entry: BrowserLogEntry) => void
  readonly info: (entry: BrowserLogEntry) => void
  readonly warn: (entry: BrowserLogEntry) => void
  readonly error: (entry: BrowserLogEntry) => void
  readonly flush: () => Promise<void>
}

export type BrowserLoggerOptions = {
  readonly service: string
  readonly minLevel: LogLevel
  readonly ship: (records: readonly LogRecord[]) => Promise<void>
  readonly echo: (record: LogRecord) => void
  readonly clock: () => string
  readonly maxBatch: number
}

export const toRecord = (params: {
  readonly level: LogLevel
  readonly service: string
  readonly ts: string
  readonly entry: BrowserLogEntry
}): LogRecord => {
  const { msg, trace, ...fields } = params.entry
  return {
    ts: params.ts,
    level: params.level,
    service: params.service,
    msg,
    traceId: trace?.traceId ?? null,
    spanId: trace?.spanId ?? null,
    parentSpanId: trace?.parentSpanId ?? null,
    fields,
  }
}

/** Buffers records and ships them to the backend in batches; shipping failures are swallowed. */
export const createBrowserLogger = (options: BrowserLoggerOptions): BrowserLogger => {
  let buffer: LogRecord[] = []

  const flush = async (): Promise<void> => {
    if (buffer.length === 0) return
    const batch = buffer
    buffer = []
    try {
      await options.ship(batch)
    } catch {
      // Logging must never break the app.
    }
  }

  const log =
    (level: LogLevel) =>
    (entry: BrowserLogEntry): void => {
      if (!isLevelEnabled({ level, minLevel: options.minLevel })) return
      const record = toRecord({ level, service: options.service, ts: options.clock(), entry })
      options.echo(record)
      buffer.push(record)
      if (buffer.length >= options.maxBatch || level === 'error') void flush()
    }

  return { debug: log('debug'), info: log('info'), warn: log('warn'), error: log('error'), flush }
}

const consoleEcho = (record: LogRecord): void => {
  const line = `[${record.service}] ${record.msg}`
  const details = { traceId: record.traceId, ...record.fields }
  if (record.level === 'error') console.error(line, details)
  else if (record.level === 'warn') console.warn(line, details)
  else console.debug(line, details)
}

const shipToBackend = async (records: readonly LogRecord[]): Promise<void> => {
  await fetch('/api/logs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ records }),
    keepalive: true,
  })
}

export const logger: BrowserLogger = createBrowserLogger({
  service: 'web',
  minLevel: import.meta.env.DEV ? 'debug' : 'info',
  ship: shipToBackend,
  echo: import.meta.env.DEV ? consoleEcho : () => undefined,
  clock: () => new Date().toISOString(),
  maxBatch: 20,
})

/** Periodic flush plus global error capture. Returns a disposer. */
export const installLogging = (params: {
  readonly target: Window
  readonly intervalMs: number
}): (() => void) => {
  const timer = params.target.setInterval(() => void logger.flush(), params.intervalMs)
  const onError = (event: ErrorEvent) => {
    logger.error({ msg: 'ui.uncaught_error', error: serializeError(event.error ?? event.message) })
  }
  const onRejection = (event: PromiseRejectionEvent) => {
    logger.error({ msg: 'ui.unhandled_rejection', error: serializeError(event.reason) })
  }
  const onHide = () => void logger.flush()
  params.target.addEventListener('error', onError)
  params.target.addEventListener('unhandledrejection', onRejection)
  params.target.addEventListener('pagehide', onHide)
  return () => {
    params.target.clearInterval(timer)
    params.target.removeEventListener('error', onError)
    params.target.removeEventListener('unhandledrejection', onRejection)
    params.target.removeEventListener('pagehide', onHide)
  }
}
