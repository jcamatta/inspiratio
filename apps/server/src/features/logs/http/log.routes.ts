import { IngestLogsSchema, ok } from '@inspiratio/shared'
import { withBody } from '../../../shared/http/handlers.ts'
import type { Route } from '../../../shared/http/http.types.ts'
import { noContent } from '../../../shared/http/responses.ts'
import type { Logger } from '../../../shared/logging/logger.ts'

/**
 * Browser logs are shipped here in batches and written to the same sinks as server logs,
 * so a single trace id links the click in the UI to every backend and MCP log line.
 */
export const logRoutes = (params: { readonly sink: Logger }): Route[] => [
  {
    method: 'post',
    path: '/api/logs',
    handler: withBody({
      schema: IngestLogsSchema,
      run: ({ body }) => {
        for (const record of body.records) params.sink.write(record)
        return Promise.resolve(ok(undefined))
      },
      onOk: noContent,
    }),
  },
]
