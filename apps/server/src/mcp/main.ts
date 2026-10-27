import { serializeError } from '@inspiratio/shared'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { fileURLToPath } from 'node:url'
import { loadConfig } from '../config.ts'
import { createServiceLogger } from '../shared/logging/bootstrap.ts'
import { createApiClient } from './api-client.ts'
import { createMcpServer } from './server.ts'
import { createToolHandlers } from './tools.ts'

const rootDir = fileURLToPath(new URL('../../../../', import.meta.url))
const config = loadConfig({ env: process.env, rootDir })

// stdout carries the MCP protocol: logs go to stderr and the shared NDJSON file only.
const logger = createServiceLogger({
  service: 'mcp',
  logFile: config.logFile,
  minLevel: config.logLevel,
  format: 'json',
  write: (line) => process.stderr.write(line),
})

const handlers = createToolHandlers({
  api: createApiClient({ baseUrl: config.apiUrl, fetchFn: fetch }),
  logger,
})

createMcpServer(handlers)
  .connect(new StdioServerTransport())
  .then(() => {
    logger.info({ msg: 'mcp.started', apiUrl: config.apiUrl })
  })
  .catch((error: unknown) => {
    logger.error({ msg: 'mcp.start_failed', error: serializeError(error) })
    process.exit(1)
  })
