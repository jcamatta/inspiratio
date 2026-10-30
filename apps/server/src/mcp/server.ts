import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { toolInputs, type ToolHandlers } from './tools.ts'

export const MCP_INSTRUCTIONS = [
  "Inspiratio is the user's local reference canvas for short-film inspiration.",
  'The user composes prompts in the app and drags reference images/videos/audio into them; each becomes an image, video or speech generation request.',
  'Typical flow: list_generation_requests → get_generation_request (has reference files on disk + a Higgsfield guide) →',
  'start_generation → upload references and generate with the Higgsfield MCP, calling report_progress once per phase → complete_generation with the result URLs.',
  'Results are imported into the canvas automatically, tagged ai-generated / by:<provider> / model:<model>, with the prompt stored as metadata.',
].join(' ')

/** Adapter: exposes the tool handlers through the MCP SDK. */
export const createMcpServer = (handlers: ToolHandlers): McpServer => {
  const server = new McpServer(
    { name: 'inspiratio', version: '0.1.0' },
    { instructions: MCP_INSTRUCTIONS },
  )

  server.registerTool(
    'list_generation_requests',
    {
      title: 'List generation requests',
      description:
        'Lists prompts the user queued in Inspiratio: pending and in_progress ones by default.',
      inputSchema: toolInputs.listGenerationRequests.shape,
    },
    (input) => handlers.listGenerationRequests(input),
  )
  server.registerTool(
    'get_generation_request',
    {
      title: 'Get generation request',
      description:
        'Returns the prompt, settings and resolved references (absolute file paths, tags, notes), the promptGuide (model to use and the guide to follow for the provider prompt) plus a step-by-step Higgsfield guide.',
      inputSchema: toolInputs.getGenerationRequest.shape,
    },
    (input) => handlers.getGenerationRequest(input),
  )
  server.registerTool(
    'start_generation',
    {
      title: 'Start generation',
      description:
        'Marks a request as in progress so the app shows it is being worked on. On a request already in progress it resumes it.',
      inputSchema: toolInputs.startGeneration.shape,
    },
    (input) => handlers.startGeneration(input),
  )
  server.registerTool(
    'report_progress',
    {
      title: 'Report progress',
      description:
        'Shows a short status line on the prompt card (e.g. "Uploading references", "Generating with nano_banana_pro"). Call it before each step.',
      inputSchema: toolInputs.reportProgress.shape,
    },
    (input) => handlers.reportProgress(input),
  )
  server.registerTool(
    'complete_generation',
    {
      title: 'Complete generation',
      description:
        'Imports the generated media (URLs or local files) into the canvas next to the references, tagged with provider and model, with the prompt as metadata.',
      inputSchema: toolInputs.completeGeneration.shape,
    },
    (input) => handlers.completeGeneration(input),
  )
  server.registerTool(
    'fail_generation',
    {
      title: 'Fail generation',
      description: 'Marks a request as failed with a human readable reason shown in the app.',
      inputSchema: toolInputs.failGeneration.shape,
    },
    (input) => handlers.failGeneration(input),
  )
  server.registerTool(
    'search_references',
    {
      title: 'Search references',
      description:
        'Searches the canvas by text and tags; returns absolute file paths usable as references.',
      inputSchema: toolInputs.searchReferences.shape,
      annotations: { readOnlyHint: true },
    },
    (input) => handlers.searchReferences(input),
  )
  server.registerTool(
    'list_tags',
    {
      title: 'List tags',
      description: 'Lists every global tag in the library.',
      annotations: { readOnlyHint: true },
    },
    () => handlers.listTags(),
  )
  server.registerTool(
    'import_media',
    {
      title: 'Import media',
      description:
        'Adds an image or video to the canvas from a URL or an absolute local file path.',
      inputSchema: toolInputs.importMedia.shape,
    },
    (input) => handlers.importMedia(input),
  )
  return server
}
