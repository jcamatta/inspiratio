import {
  childSpan,
  CreatedManySchema,
  CreatedSchema,
  GenerationDetailsSchema,
  GenerationRequestSchema,
  GenerationStatusSchema,
  ItemKindSchema,
  ItemSchema,
  resumeTrace,
  startTrace,
  TagSchema,
  type Result,
  type TraceContext,
} from '@inspiratio/shared'
import { z } from 'zod'
import type { Logger } from '../shared/logging/logger.ts'
import { runWithTrace } from '../shared/logging/trace-context.ts'
import type { ApiClient } from './api-client.ts'

export type ToolResult = {
  readonly content: { readonly type: 'text'; readonly text: string }[]
  readonly isError?: boolean
}

const EmptySchema = z.object({})

const ItemViewSchema = ItemSchema.extend({
  tagNames: z.array(z.string()),
  absolutePath: z.string(),
  mediaUrl: z.string(),
})

export const toolInputs = {
  listGenerationRequests: z.object({
    status: GenerationStatusSchema.default('pending').describe(
      'Filter by status. Defaults to pending (requests waiting for you).',
    ),
  }),
  getGenerationRequest: z.object({
    id: z.string().describe('Generation request id, e.g. gen_ab12cd34ef56'),
  }),
  startGeneration: z.object({ id: z.string() }),
  reportProgress: z.object({
    id: z.string(),
    message: z
      .string()
      .min(1)
      .max(280)
      .describe('One short line about what you are doing now, e.g. "Uploading 2 references"'),
  }),
  completeGeneration: z.object({
    id: z.string(),
    results: z
      .array(
        z.object({
          url: z
            .url()
            .optional()
            .describe('Public URL of the generated media (e.g. Higgsfield result URL)'),
          filePath: z
            .string()
            .optional()
            .describe('Absolute local path, if you downloaded the file'),
          model: z.string().describe('Model used, e.g. nano_banana_pro, seedance_2_5'),
          provider: z.string().default('higgsfield'),
          title: z.string().optional(),
        }),
      )
      .min(1),
  }),
  failGeneration: z.object({ id: z.string(), error: z.string().min(1) }),
  searchReferences: z.object({
    text: z.string().optional().describe('Matches title, notes, prompt and tag names'),
    tags: z.array(z.string()).optional().describe('All of these tag names must be present'),
    kind: ItemKindSchema.optional(),
  }),
  listTags: EmptySchema,
  importMedia: z.object({
    url: z.url().optional(),
    filePath: z.string().optional(),
    title: z.string().optional(),
  }),
} as const

const text = (value: unknown): ToolResult => ({
  content: [
    { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) },
  ],
})

const failure = (message: string): ToolResult => ({
  content: [{ type: 'text', text: message }],
  isError: true,
})

const fromResult = <T>(params: {
  readonly result: Result<T>
  readonly present: (value: T) => unknown
}): ToolResult =>
  params.result.ok
    ? text(params.present(params.result.value))
    : failure(params.result.error.message)

export const HIGGSFIELD_GUIDE = [
  'How to fulfil this request with the Higgsfield MCP:',
  '1. Call start_generation with this id. Call report_progress with one short line before each of the steps below so the user sees what you are doing.',
  '2. For each resolvedReference: higgsfield media_upload {filename}, then PUT the file at absolutePath to upload_url with curl (--data-binary @<absolutePath>), then media_confirm.',
  '3. Rewrite the prompt replacing each label (@1, @2…) with a description of that reference role; pass the confirmed media ids in params.medias.',
  '4. Call higgsfield generate_image (kind=image) or generate_video (kind=video) with the requested model / aspect ratio / count (pick a model with models_explore when model is null). Wait with jobs_wait.',
  '5. Call complete_generation with the result URLs and the exact model id used. On any error call fail_generation.',
].join('\n')

/**
 * Tool handlers as plain functions over an API port, so they can be tested without the MCP SDK.
 * Generation tools resume the trace started by the browser click that created the request.
 */
export const createToolHandlers = (deps: { readonly api: ApiClient; readonly logger: Logger }) => {
  const traced = async (params: {
    readonly tool: string
    readonly trace: TraceContext
    readonly run: (trace: TraceContext) => Promise<ToolResult>
  }): Promise<ToolResult> =>
    runWithTrace({
      trace: params.trace,
      run: async () => {
        deps.logger.info({ msg: 'mcp.tool_called', tool: params.tool })
        const result = await params.run(params.trace)
        deps.logger.info({
          msg: 'mcp.tool_finished',
          tool: params.tool,
          isError: result.isError ?? false,
        })
        return result
      },
    })

  /** Looks the request up first so every following call joins the request's original trace. */
  const generationTrace = async (id: string): Promise<TraceContext> => {
    const lookup = await deps.api.request({
      method: 'GET',
      path: `/api/generations/${encodeURIComponent(id)}`,
      trace: startTrace(),
      schema: GenerationRequestSchema.pick({ traceId: true }),
    })
    return lookup.ok ? resumeTrace(lookup.value.traceId) : startTrace()
  }

  const listGenerationRequests = (input: z.output<typeof toolInputs.listGenerationRequests>) =>
    traced({
      tool: 'list_generation_requests',
      trace: startTrace(),
      run: async (trace) =>
        fromResult({
          result: await deps.api.request({
            method: 'GET',
            path: `/api/generations?status=${input.status}`,
            trace,
            schema: z.array(GenerationRequestSchema),
          }),
          present: (requests) =>
            requests.length === 0
              ? `No ${input.status} generation requests.`
              : requests.map((request) => ({
                  id: request.id,
                  kind: request.kind,
                  model: request.model,
                  prompt: request.prompt,
                  references: request.references.length,
                  createdAt: request.createdAt,
                })),
        }),
    })

  const getGenerationRequest = async (input: z.output<typeof toolInputs.getGenerationRequest>) =>
    traced({
      tool: 'get_generation_request',
      trace: await generationTrace(input.id),
      run: async (trace) =>
        fromResult({
          result: await deps.api.request({
            method: 'GET',
            path: `/api/generations/${encodeURIComponent(input.id)}`,
            trace: childSpan(trace),
            schema: GenerationDetailsSchema,
          }),
          present: (details) => ({ request: details, guide: HIGGSFIELD_GUIDE }),
        }),
    })

  const transitionTool =
    (params: { readonly tool: string; readonly action: 'start' | 'fail' }) =>
    async (input: { readonly id: string; readonly error?: string }) =>
      traced({
        tool: params.tool,
        trace: await generationTrace(input.id),
        run: async (trace) =>
          fromResult({
            result: await deps.api.request({
              method: 'POST',
              path: `/api/generations/${encodeURIComponent(input.id)}/${params.action}`,
              body: params.action === 'fail' ? { error: input.error } : undefined,
              trace: childSpan(trace),
              schema: z.undefined(),
            }),
            present: () =>
              `Generation ${input.id} ${params.action === 'start' ? 'started' : 'marked as failed'}.`,
          }),
      })

  const reportProgress = async (input: z.output<typeof toolInputs.reportProgress>) =>
    traced({
      tool: 'report_progress',
      trace: await generationTrace(input.id),
      run: async (trace) =>
        fromResult({
          result: await deps.api.request({
            method: 'POST',
            path: `/api/generations/${encodeURIComponent(input.id)}/progress`,
            body: { message: input.message },
            trace: childSpan(trace),
            schema: z.undefined(),
          }),
          present: () => `Progress reported on ${input.id}.`,
        }),
    })

  const completeGeneration = async (input: z.output<typeof toolInputs.completeGeneration>) => {
    const results = input.results.map((result) => ({
      source: result.url === undefined ? { filePath: result.filePath ?? '' } : { url: result.url },
      model: result.model,
      provider: result.provider,
      title: result.title,
    }))
    if (input.results.some((result) => result.url === undefined && result.filePath === undefined))
      return failure('Every result needs either a url or a filePath.')
    return traced({
      tool: 'complete_generation',
      trace: await generationTrace(input.id),
      run: async (trace) =>
        fromResult({
          result: await deps.api.request({
            method: 'POST',
            path: `/api/generations/${encodeURIComponent(input.id)}/complete`,
            body: { results },
            trace: childSpan(trace),
            schema: CreatedManySchema,
          }),
          present: (created) =>
            `Imported ${created.ids.length} result(s) into the Inspiratio canvas: ${created.ids.join(', ')}`,
        }),
    })
  }

  const searchReferences = (input: z.output<typeof toolInputs.searchReferences>) => {
    const query = new URLSearchParams()
    if (input.text !== undefined) query.set('text', input.text)
    if (input.kind !== undefined) query.set('kind', input.kind)
    if (input.tags !== undefined && input.tags.length > 0) query.set('tags', input.tags.join(','))
    return traced({
      tool: 'search_references',
      trace: startTrace(),
      run: async (trace) =>
        fromResult({
          result: await deps.api.request({
            method: 'GET',
            path: `/api/items?${query.toString()}`,
            trace,
            schema: z.array(ItemViewSchema),
          }),
          present: (items) =>
            items.map((item) => ({
              id: item.id,
              title: item.title,
              kind: item.kind,
              tags: item.tagNames,
              absolutePath: item.absolutePath,
              mimeType: item.media.mimeType,
              prompt: item.metadata.generation?.prompt ?? null,
            })),
        }),
    })
  }

  const listTags = () =>
    traced({
      tool: 'list_tags',
      trace: startTrace(),
      run: async (trace) =>
        fromResult({
          result: await deps.api.request({
            method: 'GET',
            path: '/api/tags',
            trace,
            schema: z.array(TagSchema),
          }),
          present: (tags) => tags.map((tag) => tag.name),
        }),
    })

  const importMedia = (input: z.output<typeof toolInputs.importMedia>) => {
    if (input.url === undefined && input.filePath === undefined)
      return Promise.resolve(failure('Provide either url or filePath.'))
    const isUrl = input.url !== undefined
    return traced({
      tool: 'import_media',
      trace: startTrace(),
      run: async (trace) =>
        fromResult({
          result: await deps.api.request({
            method: 'POST',
            path: isUrl ? '/api/items/import-url' : '/api/items/import-file',
            body: isUrl
              ? { url: input.url, title: input.title }
              : { filePath: input.filePath, title: input.title },
            trace,
            schema: CreatedSchema,
          }),
          present: (created) => `Added item ${created.id} to the canvas.`,
        }),
    })
  }

  return {
    listGenerationRequests,
    getGenerationRequest,
    startGeneration: transitionTool({ tool: 'start_generation', action: 'start' }),
    failGeneration: transitionTool({ tool: 'fail_generation', action: 'fail' }),
    reportProgress,
    completeGeneration,
    searchReferences,
    listTags,
    importMedia,
  }
}

export type ToolHandlers = ReturnType<typeof createToolHandlers>
