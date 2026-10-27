import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { LogLevel, LogRecord } from '@inspiratio/shared'
import type { LogSink } from './logger.ts'

export type LogFormat = 'json' | 'pretty'

const LEVEL_LABEL: Readonly<Record<LogLevel, string>> = {
  debug: 'DBG',
  info: 'INF',
  warn: 'WRN',
  error: 'ERR',
}

export const formatJson = (record: LogRecord): string => JSON.stringify(record)

export const formatPretty = (record: LogRecord): string => {
  const time = record.ts.slice(11, 23)
  const trace = record.traceId === null ? '-' : record.traceId.slice(0, 8)
  const fields = Object.keys(record.fields).length > 0 ? ` ${JSON.stringify(record.fields)}` : ''
  return `${time} ${LEVEL_LABEL[record.level]} [${record.service}] (${trace}) ${record.msg}${fields}`
}

export const formatRecord = (params: {
  readonly record: LogRecord
  readonly format: LogFormat
}): string => (params.format === 'json' ? formatJson(params.record) : formatPretty(params.record))

/** Writes to a text stream; the MCP server must use stderr because stdout carries the protocol. */
export const createStreamSink = (params: {
  readonly format: LogFormat
  readonly write: (line: string) => void
}): LogSink => {
  return (record) => {
    params.write(`${formatRecord({ record, format: params.format })}\n`)
  }
}

/** Appends NDJSON lines; every service writes to the same file so a trace can be followed end to end. */
export const createFileSink = (params: { readonly filePath: string }): LogSink => {
  mkdirSync(dirname(params.filePath), { recursive: true })
  return (record) => {
    appendFileSync(params.filePath, `${formatJson(record)}\n`)
  }
}
