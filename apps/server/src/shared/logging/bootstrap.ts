import type { LogLevel } from '@inspiratio/shared'
import { systemClock } from '../lib/runtime.ts'
import { createLogger, type Logger } from './logger.ts'
import { createFileSink, createStreamSink, type LogFormat } from './sinks.ts'
import { currentTrace } from './trace-context.ts'

/** Builds a service logger that writes to a stream (stdout/stderr) and the shared NDJSON file. */
export const createServiceLogger = (params: {
  readonly service: string
  readonly logFile: string
  readonly minLevel: LogLevel
  readonly format: LogFormat
  readonly write: (line: string) => void
}): Logger =>
  createLogger({
    service: params.service,
    minLevel: params.minLevel,
    clock: systemClock,
    getTrace: currentTrace,
    sinks: [
      createStreamSink({ format: params.format, write: params.write }),
      createFileSink({ filePath: params.logFile }),
    ],
  })
