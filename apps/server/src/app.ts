import { ok } from '@inspiratio/shared'
import type { Express } from 'express'
import { createGenerationCommands } from './features/generations/application/generation.commands.ts'
import { createGenerationQueries } from './features/generations/application/generation.queries.ts'
import { generationRoutes } from './features/generations/http/generation.routes.ts'
import { createItemCommands } from './features/items/application/item.commands.ts'
import type { ItemDeps } from './features/items/application/item.deps.ts'
import { createItemQueries } from './features/items/application/item.queries.ts'
import { itemRoutes } from './features/items/http/item.routes.ts'
import { logRoutes } from './features/logs/http/log.routes.ts'
import { createSectionCommands } from './features/sections/application/section.commands.ts'
import { sectionRoutes } from './features/sections/http/section.routes.ts'
import { createTagCommands } from './features/tags/application/tag.commands.ts'
import { tagRoutes } from './features/tags/http/tag.routes.ts'
import {
  createStorageCommands,
  createStorageQueries,
} from './features/storage/application/storage.service.ts'
import { storageRoutes } from './features/storage/http/storage.routes.ts'
import type { UploadPreparer } from './shared/media/upload-copy.ts'
import type { FolderOpener } from './shared/system/folder-opener.ts'
import { createExpressApp } from './shared/http/express-adapter.ts'
import { withRequest } from './shared/http/handlers.ts'
import type { Route } from './shared/http/http.types.ts'
import { json } from './shared/http/responses.ts'

export type AppDeps = ItemDeps & {
  readonly webDistDir: string | null
  readonly openFolder: FolderOpener
  readonly prepareUpload: UploadPreparer
  /** Logger used to re-emit browser records verbatim. */
  readonly clientLogSink: ItemDeps['logger']
}

/** Composition root for HTTP: wires use cases to routes. Adapters arrive already built. */
export const createRoutes = (deps: AppDeps): Route[] => {
  const itemCommands = createItemCommands(deps)
  const itemQueries = createItemQueries(deps)
  return [
    {
      method: 'get',
      path: '/api/health',
      handler: withRequest({
        run: () => ok({ status: 'ok', mediaDir: deps.storage.directory }),
        onOk: json,
      }),
    },
    ...itemRoutes({ commands: itemCommands, queries: itemQueries }),
    ...tagRoutes({ commands: createTagCommands(deps), store: deps.store }),
    ...sectionRoutes({ commands: createSectionCommands(deps) }),
    ...generationRoutes({
      commands: createGenerationCommands(deps),
      queries: createGenerationQueries(deps),
    }),
    ...storageRoutes({
      commands: createStorageCommands(deps),
      queries: createStorageQueries(deps),
    }),
    ...logRoutes({ sink: deps.clientLogSink }),
  ]
}

export const createApp = (deps: AppDeps): Express =>
  createExpressApp({
    routes: createRoutes(deps),
    logger: deps.logger,
    mediaDir: deps.storage.directory,
    webDistDir: deps.webDistDir,
    maxUploadBytes: deps.maxImportBytes,
  })
