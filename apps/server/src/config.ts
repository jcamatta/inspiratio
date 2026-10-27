import { LogLevelSchema, type LogLevel } from '@inspiratio/shared'
import { isAbsolute, join, resolve } from 'node:path'
import type { LogFormat } from './shared/logging/sinks.ts'

export type Config = {
  readonly host: string
  readonly port: number
  readonly dataDir: string
  readonly libraryFile: string
  readonly mediaDir: string
  readonly trashDir: string
  readonly uploadCacheDir: string
  readonly logFile: string
  readonly logLevel: LogLevel
  readonly logFormat: LogFormat
  readonly webDistDir: string
  readonly maxImportBytes: number
  readonly fetchTimeoutMs: number
  readonly apiUrl: string
  /** Agent command started for each queued generation, or null when INSPIRATIO_AGENT is off. */
  readonly agentCommand: string | null
  readonly agentModel: string
  readonly agentDir: string
  readonly higgsfieldMcpUrl: string
}

export type Env = Readonly<Record<string, string | undefined>>

const MB = 1024 * 1024

const numberOr = (params: { readonly value: string | undefined; readonly fallback: number }) => {
  const parsed = Number(params.value)
  return params.value !== undefined && Number.isFinite(parsed) && parsed > 0
    ? parsed
    : params.fallback
}

/** Pure: derives configuration from environment variables and the repository root. */
export const loadConfig = (params: { readonly env: Env; readonly rootDir: string }): Config => {
  const { env } = params
  const rawDataDir = env.INSPIRATIO_DATA_DIR ?? 'data'
  const dataDir = isAbsolute(rawDataDir) ? rawDataDir : resolve(params.rootDir, rawDataDir)
  const port = numberOr({ value: env.INSPIRATIO_PORT, fallback: 4319 })
  const host = env.INSPIRATIO_HOST ?? '127.0.0.1'
  const level = LogLevelSchema.safeParse(env.INSPIRATIO_LOG_LEVEL)
  return {
    host,
    port,
    dataDir,
    libraryFile: join(dataDir, 'library.json'),
    mediaDir: join(dataDir, 'media'),
    trashDir: join(dataDir, 'trash'),
    uploadCacheDir: join(dataDir, 'upload-cache'),
    logFile: join(dataDir, 'logs', 'inspiratio.ndjson'),
    logLevel: level.success ? level.data : 'info',
    logFormat: env.INSPIRATIO_LOG_FORMAT === 'json' ? 'json' : 'pretty',
    webDistDir: resolve(params.rootDir, 'apps', 'web', 'dist'),
    maxImportBytes: numberOr({ value: env.INSPIRATIO_MAX_IMPORT_MB, fallback: 300 }) * MB,
    fetchTimeoutMs: numberOr({ value: env.INSPIRATIO_FETCH_TIMEOUT_MS, fallback: 60_000 }),
    apiUrl: env.INSPIRATIO_API_URL ?? `http://${host}:${port}`,
    agentCommand: env.INSPIRATIO_AGENT === 'off' ? null : (env.INSPIRATIO_AGENT ?? 'claude'),
    agentModel: env.INSPIRATIO_AGENT_MODEL ?? 'sonnet',
    agentDir: join(dataDir, 'agent'),
    higgsfieldMcpUrl: env.INSPIRATIO_HIGGSFIELD_MCP_URL ?? 'https://mcp.higgsfield.ai/mcp',
  }
}
