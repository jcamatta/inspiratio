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
    status: GenerationStatusSchema.optional().describe(
      'Filter by status. Defaults to open requests: pending ones waiting for you and in_progress ones a previous session may have left unfinished.',
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
      .describe(
        'One short line about what you are doing now, e.g. "Uploading 2 references". Include Higgsfield job ids while waiting so another session can resume.',
      ),
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
          model: z
            .string()
            .describe('Model used, e.g. nano_banana_pro, seedance_2_5, elevenlabs_v4'),
          provider: z.string().default('higgsfield'),
          title: z.string().optional(),
        }),
      )
      .min(1),
    providerPrompt: z
      .string()
      .min(1)
      .optional()
      .describe('The exact prompt you sent to the provider after rewriting the brief'),
    uploads: z
      .array(
        z.object({
          itemId: z.string(),
          mediaId: z.string().describe('Confirmed provider media id of that reference'),
          provider: z.string().default('higgsfield'),
        }),
      )
      .optional()
      .describe('References you uploaded in this run, so later requests reuse them'),
    promptGuide: z
      .string()
      .min(1)
      .optional()
      .describe('The guide you followed: request.promptGuide.guide from get_generation_request'),
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
  'How to fulfil this request with the Higgsfield MCP (be quick: batch calls, no extra lookups):',
  '1. start_generation with this id. If it was already in_progress, read progress and check higgsfield show_generations for a job already submitted before generating again. Call report_progress once per phase: "Uploading references", "Generating with <model> (job <id>)", "Importing results".',
  '2. References: when providerMediaIds.higgsfield is set, use that media id and do not upload. Upload the rest together: one media_upload {files: [{filename: basename of uploadPath}]}, then every PUT in a single Bash command (curl -sS -o /dev/null -w "%{http_code}" -X PUT -H "Content-Type: <uploadMimeType>" --data-binary @<uploadPath> "<upload_url>" chained with &&), then one media_confirm {media_ids, type: "image"} (type "video" for videos, "audio" for audio). Never upload absolutePath. Skip this step when request.kind is audio: the speech model takes no media, and references only inform the voice choice.',
  '3. Model: generate with request.promptGuide.model, always. It is already resolved (nano_banana_pro for images, seedance_2_5 for videos and elevenlabs_v4 for audio when the card has none); never pick another model and never call models_explore unless request.promptGuide.content tells you to check roles or aspect ratios.',
  '4. Prompt: write the provider prompt by following request.promptGuide.content exactly (structure, wording rules, what to avoid); it is the guide for that model. Keep the user intent and replace each label (@1, @2…) with what that reference contributes, as the guide describes. Pass media ids in params.medias in label order, with aspect_ratio when set and count.',
  '4b. Settings: spread request.resolvedOptions into params unchanged (e.g. resolution, quality, variant, background, duration, bitrate_mode, generate_audio). They are the user choices on the card; never override them. The guide says how they shape the prompt and which extra params (such as mode for video) you choose yourself.',
  '5. generate_image (kind=image), generate_video (kind=video) or generate_audio (kind=audio); repeat jobs_wait {jobs: [{index, job_id}], timeout_seconds: 15} until terminal.',
  '6. complete_generation with one result per output URL, the exact model id, providerPrompt set to the exact prompt you sent, promptGuide set to request.promptGuide.guide and uploads listing {itemId, mediaId} for every reference you uploaded in step 2. On any error call fail_generation with a short reason; if a reused media id is rejected, upload that file again once.',
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
            path:
              input.status === undefined
                ? '/api/generations'
                : `/api/generations?status=${input.status}`,
            trace,
            schema: z.array(GenerationRequestSchema),
          }),
          present: (requests) => {
            const listed =
              input.status === undefined
                ? requests.filter(
                    (request) => request.status === 'pending' || request.status === 'in_progress',
                  )
                : requests
            return listed.length === 0
              ? `No ${input.status ?? 'open'} generation requests.`
              : listed.map((request) => ({
                  id: request.id,
                  status: request.status,
                  kind: request.kind,
                  model: request.model,
                  prompt: request.prompt,
                  progress: request.progress,
                  references: request.references.length,
                  createdAt: request.createdAt,
                }))
          },
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
            body: {
              results,
              providerPrompt: input.providerPrompt,
              promptGuide: input.promptGuide,
              uploads: input.uploads ?? [],
            },
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
