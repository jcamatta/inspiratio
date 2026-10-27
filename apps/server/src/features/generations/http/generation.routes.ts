import {
  CompleteGenerationSchema,
  CreateGenerationSchema,
  FailGenerationSchema,
  ListGenerationsSchema,
  UpdateGenerationSchema,
} from '@inspiratio/shared'
import { pathId, withBody, withRequest } from '../../../shared/http/handlers.ts'
import type { Route } from '../../../shared/http/http.types.ts'
import { created, json, noContent, parseWith } from '../../../shared/http/responses.ts'
import type { GenerationCommands } from '../application/generation.commands.ts'
import type { GenerationQueries } from '../application/generation.queries.ts'

export const generationRoutes = (params: {
  readonly commands: GenerationCommands
  readonly queries: GenerationQueries
}): Route[] => {
  const { commands, queries } = params
  return [
    {
      method: 'get',
      path: '/api/generations',
      handler: withRequest({
        run: (request) => parseWith({ schema: ListGenerationsSchema, input: request.query }),
        onOk: (input) => json(queries.list(input)),
      }),
    },
    {
      method: 'get',
      path: '/api/generations/:id',
      handler: withRequest({
        run: (request) => queries.details({ id: pathId(request) }),
        onOk: json,
      }),
    },
    {
      method: 'post',
      path: '/api/generations',
      handler: withBody({
        schema: CreateGenerationSchema,
        run: ({ body, request }) =>
          commands.create({ input: body, traceId: request.trace.traceId }),
        onOk: created,
      }),
    },
    {
      method: 'patch',
      path: '/api/generations/:id',
      handler: withBody({
        schema: UpdateGenerationSchema,
        run: ({ body, request }) => commands.update({ id: pathId(request), patch: body }),
        onOk: noContent,
      }),
    },
    {
      method: 'post',
      path: '/api/generations/:id/submit',
      handler: withRequest({
        run: (request) => commands.submit({ id: pathId(request), traceId: request.trace.traceId }),
        onOk: (submitted) => json({ id: submitted.id }),
      }),
    },
    {
      method: 'post',
      path: '/api/generations/:id/start',
      handler: withRequest({
        run: (request) => commands.start({ id: pathId(request) }),
        onOk: noContent,
      }),
    },
    {
      method: 'post',
      path: '/api/generations/:id/complete',
      handler: withBody({
        schema: CompleteGenerationSchema,
        run: ({ body, request }) => commands.complete({ id: pathId(request), input: body }),
        onOk: created,
      }),
    },
    {
      method: 'post',
      path: '/api/generations/:id/fail',
      handler: withBody({
        schema: FailGenerationSchema,
        run: ({ body, request }) => commands.fail({ id: pathId(request), error: body.error }),
        onOk: noContent,
      }),
    },
    {
      method: 'post',
      path: '/api/generations/:id/retry',
      handler: withRequest({
        run: (request) => commands.retry({ id: pathId(request) }),
        onOk: noContent,
      }),
    },
    {
      method: 'delete',
      path: '/api/generations/:id',
      handler: withRequest({
        run: (request) => commands.remove({ id: pathId(request) }),
        onOk: noContent,
      }),
    },
  ]
}
