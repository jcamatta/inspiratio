import { CreateTagSchema, ok, UpdateTagSchema } from '@inspiratio/shared'
import { pathId, withBody, withRequest } from '../../../shared/http/handlers.ts'
import type { Route } from '../../../shared/http/http.types.ts'
import { created, json, noContent } from '../../../shared/http/responses.ts'
import { sortBy } from '../../../shared/lib/compare.ts'
import type { LibraryStore } from '../../../shared/persistence/library-store.ts'
import type { TagCommands } from '../application/tag.commands.ts'

export const tagRoutes = (params: {
  readonly commands: TagCommands
  readonly store: LibraryStore
}): Route[] => [
  {
    method: 'get',
    path: '/api/tags',
    handler: withRequest({
      run: () =>
        ok(sortBy({ values: params.store.read().tags, key: (tag) => tag.name.toLowerCase() })),
      onOk: json,
    }),
  },
  {
    method: 'post',
    path: '/api/tags',
    handler: withBody({
      schema: CreateTagSchema,
      run: ({ body }) => params.commands.create(body),
      onOk: created,
    }),
  },
  {
    method: 'patch',
    path: '/api/tags/:id',
    handler: withBody({
      schema: UpdateTagSchema,
      run: ({ body, request }) => params.commands.update({ id: pathId(request), input: body }),
      onOk: noContent,
    }),
  },
  {
    method: 'delete',
    path: '/api/tags/:id',
    handler: withRequest({
      run: (request) => params.commands.remove({ id: pathId(request) }),
      onOk: noContent,
    }),
  },
]
