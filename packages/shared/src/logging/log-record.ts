import { z } from 'zod'

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const

export const LogLevelSchema = z.enum(LOG_LEVELS)
export type LogLevel = z.infer<typeof LogLevelSchema>

export const LOG_LEVEL_WEIGHT: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

export const LogFieldsSchema = z.record(z.string(), z.unknown())
export type LogFields = z.infer<typeof LogFieldsSchema>

export const LogRecordSchema = z.object({
  ts: z.string(),
  level: LogLevelSchema,
  service: z.string().min(1).max(64),
  msg: z.string().max(2000),
  traceId: z.string().nullable(),
  spanId: z.string().nullable(),
  parentSpanId: z.string().nullable(),
  fields: LogFieldsSchema,
})
export type LogRecord = z.infer<typeof LogRecordSchema>

export const IngestLogsSchema = z.object({
  records: z.array(LogRecordSchema).min(1).max(200),
})
export type IngestLogsInput = z.infer<typeof IngestLogsSchema>

export const isLevelEnabled = (params: {
  readonly level: LogLevel
  readonly minLevel: LogLevel
}): boolean => LOG_LEVEL_WEIGHT[params.level] >= LOG_LEVEL_WEIGHT[params.minLevel]

/** Turns an unknown thrown value into a serialisable log field. */
export const serializeError = (error: unknown): LogFields =>
  error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack ?? null }
    : { message: String(error) }
