import {
  ApplyLayoutSchema,
  ImportFileSchema,
  ImportPlacementSchema,
  ImportUrlSchema,
  ok,
  ReportMediaDimensionsSchema,
  SearchItemsSchema,
  SetItemTagsSchema,
  UpdateItemSchema,
} from '@inspiratio/shared'
import { pathId, withBody, withRequest } from '../../../shared/http/handlers.ts'
import type { Route } from '../../../shared/http/http.types.ts'
import { created, json, noContent, parseWith } from '../../../shared/http/responses.ts'
import type { ItemCommands } from '../application/item.commands.ts'
import type { ItemQueries } from '../application/item.queries.ts'

const optionalNumber = (value: unknown): number | undefined =>
  typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))
    ? Number(value)
    : undefined

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined

/** Multipart forms only carry strings: rebuild the placement object before validating it. */
export const placementFromForm = (body: unknown): unknown => {
  const form = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  const x = optionalNumber(form.x)
  const y = optionalNumber(form.y)
  return {
    position: x === undefined || y === undefined ? undefined : { x, y },
    title: optionalString(form.title),
    sectionId: optionalString(form.sectionId),
  }
}

export const searchFromQuery = (query: Readonly<Record<string, unknown>>): unknown => ({
  text: optionalString(query.text),
  kind: optionalString(query.kind),
  tags: optionalString(query.tags)
    ?.split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== ''),
})

export const itemRoutes = (params: {
  readonly commands: ItemCommands
  readonly queries: ItemQueries
}): Route[] => {
  const { commands, queries } = params
  return [
    // Queries
    {
      method: 'get',
      path: '/api/board',
      handler: withRequest({ run: () => ok(queries.board()), onOk: json }),
    },
    {
      method: 'get',
      path: '/api/items',
      handler: withRequest({
        run: (request) =>
          parseWith({ schema: SearchItemsSchema, input: searchFromQuery(request.query) }),
        onOk: (criteria) => json(queries.search(criteria)),
      }),
    },
    {
      method: 'get',
      path: '/api/items/:id',
      handler: withRequest({ run: (request) => queries.byId({ id: pathId(request) }), onOk: json }),
    },
    // Commands
    {
      method: 'post',
      path: '/api/items/upload',
      upload: true,
      handler: withRequest({
        run: async (request) => {
          const placement = parseWith({
            schema: ImportPlacementSchema,
            input: placementFromForm(request.body),
          })
          if (!placement.ok) return placement
          return commands.importUploads({ files: request.files, placement: placement.value })
        },
        onOk: created,
      }),
    },
    {
      method: 'post',
      path: '/api/items/import-url',
      handler: withBody({
        schema: ImportUrlSchema,
        run: ({ body }) => commands.importUrl(body),
        onOk: created,
      }),
    },
    {
      method: 'post',
      path: '/api/items/import-file',
      handler: withBody({
        schema: ImportFileSchema,
        run: ({ body }) => commands.importFile(body),
        onOk: created,
      }),
    },
    {
      method: 'post',
      path: '/api/items/layout',
      handler: withBody({
        schema: ApplyLayoutSchema,
        run: ({ body }) => commands.applyLayout(body),
        onOk: noContent,
      }),
    },
    {
      method: 'patch',
      path: '/api/items/:id',
      handler: withBody({
        schema: UpdateItemSchema,
        run: ({ body, request }) => commands.update({ id: pathId(request), patch: body }),
        onOk: noContent,
      }),
    },
    {
      method: 'put',
      path: '/api/items/:id/tags',
      handler: withBody({
        schema: SetItemTagsSchema,
        run: ({ body, request }) => commands.setTags({ id: pathId(request), input: body }),
        onOk: noContent,
      }),
    },
    {
      method: 'put',
      path: '/api/items/:id/dimensions',
      handler: withBody({
        schema: ReportMediaDimensionsSchema,
        run: ({ body, request }) => commands.reportDimensions({ id: pathId(request), input: body }),
        onOk: noContent,
      }),
    },
    {
      method: 'delete',
      path: '/api/items/:id',
      handler: withRequest({
        run: (request) => commands.remove({ id: pathId(request) }),
        onOk: noContent,
      }),
    },
  ]
}
