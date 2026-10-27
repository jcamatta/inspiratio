import { OpenFolderSchema } from '@inspiratio/shared'
import { withBody, withRequest } from '../../../shared/http/handlers.ts'
import type { Route } from '../../../shared/http/http.types.ts'
import { json, noContent } from '../../../shared/http/responses.ts'
import type { StorageCommands, StorageQueries } from '../application/storage.service.ts'

export const storageRoutes = (params: {
  readonly commands: StorageCommands
  readonly queries: StorageQueries
}): Route[] => [
  {
    method: 'get',
    path: '/api/storage',
    handler: withRequest({ run: () => params.queries.info(), onOk: json }),
  },
  {
    method: 'post',
    path: '/api/storage/open',
    handler: withBody({
      schema: OpenFolderSchema,
      run: ({ body }) => params.commands.open(body),
      onOk: noContent,
    }),
  },
]
