import { serializeError } from '@inspiratio/shared'
import { fileURLToPath } from 'node:url'
import { createApp } from './app.ts'
import { loadConfig } from './config.ts'
import { randomIds, systemClock } from './shared/lib/runtime.ts'
import { createServiceLogger } from './shared/logging/bootstrap.ts'
import { createFsMediaStorage, readLocalFile } from './shared/media/media-storage.ts'
import { createFileLibraryStore } from './shared/persistence/library-store.ts'

const rootDir = fileURLToPath(new URL('../../../', import.meta.url))
const config = loadConfig({ env: process.env, rootDir })

const logger = createServiceLogger({
  service: 'server',
  logFile: config.logFile,
  minLevel: config.logLevel,
  format: config.logFormat,
  write: (line) => process.stdout.write(line),
})

const clientLogSink = createServiceLogger({
  service: 'web',
  logFile: config.logFile,
  minLevel: 'debug',
  format: config.logFormat,
  write: (line) => process.stdout.write(line),
})

const start = async (): Promise<void> => {
  const store = await createFileLibraryStore({ filePath: config.libraryFile, logger })
  const storage = await createFsMediaStorage({
    mediaDir: config.mediaDir,
    trashDir: config.trashDir,
  })
  const app = createApp({
    store,
    storage,
    logger,
    clientLogSink,
    clock: systemClock,
    newId: randomIds,
    fetchFn: fetch,
    readFile: readLocalFile,
    maxImportBytes: config.maxImportBytes,
    fetchTimeoutMs: config.fetchTimeoutMs,
    webDistDir: config.webDistDir,
  })
  app.listen(config.port, config.host, () => {
    logger.info({
      msg: 'server.started',
      url: `http://${config.host}:${config.port}`,
      dataDir: config.dataDir,
    })
  })
}

start().catch((error: unknown) => {
  logger.error({ msg: 'server.start_failed', error: serializeError(error) })
  process.exit(1)
})
