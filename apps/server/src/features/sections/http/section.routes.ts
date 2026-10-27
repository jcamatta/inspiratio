import { CreateSectionSchema, UpdateSectionSchema } from '@inspiratio/shared'
import { pathId, withBody, withRequest } from '../../../shared/http/handlers.ts'
import type { Route } from '../../../shared/http/http.types.ts'
import { created, noContent } from '../../../shared/http/responses.ts'
import type { SectionCommands } from '../application/section.commands.ts'

export const sectionRoutes = (params: { readonly commands: SectionCommands }): Route[] => [
  {
    method: 'post',
    path: '/api/sections',
    handler: withBody({
      schema: CreateSectionSchema,
      run: ({ body }) => params.commands.create(body),
      onOk: created,
    }),
  },
  {
    method: 'patch',
    path: '/api/sections/:id',
    handler: withBody({
      schema: UpdateSectionSchema,
      run: ({ body, request }) => params.commands.update({ id: pathId(request), patch: body }),
      onOk: noContent,
    }),
  },
  {
    method: 'delete',
    path: '/api/sections/:id',
    handler: withRequest({
      run: (request) => params.commands.remove({ id: pathId(request) }),
      onOk: noContent,
    }),
  },
]
