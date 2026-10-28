export const STARTING_STEP = 'Starting Claude'

/** What the agent sent to the generation provider, read from its generate tool call. */
export type ProviderCall = { readonly model: string | null; readonly prompt: string | null }

export type AgentSignal =
  | { readonly type: 'step'; readonly label: string }
  | { readonly type: 'provider_call'; readonly call: ProviderCall }

type ToolUse = { readonly name: string; readonly input: Readonly<Record<string, unknown>> }

const STEP_BY_TOOL: Readonly<Record<string, string>> = {
  get_generation_request: 'Reading the request',
  start_generation: 'Reading the request',
  media_upload: 'Uploading references',
  media_confirm: 'Uploading references',
  jobs_wait: 'Rendering on Higgsfield',
  complete_generation: 'Importing results',
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const stringOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null

/** `mcp__higgsfield__generate_image` → `generate_image`; built-in tools keep their name. */
export const toolNameOf = (name: string): string => name.split('__').at(-1) ?? name

export const providerCallOf = (input: Readonly<Record<string, unknown>>): ProviderCall => {
  const params = isRecord(input.params) ? input.params : input
  return { model: stringOrNull(params.model), prompt: stringOrNull(params.prompt) }
}

/** Signals for one tool call; tools that say nothing about progress yield none. */
export const toolSignals = (tool: ToolUse): AgentSignal[] => {
  const name = toolNameOf(tool.name)
  if (name === 'generate_image' || name === 'generate_video') {
    const call = providerCallOf(tool.input)
    const label = call.model === null ? 'Generating' : `Generating with ${call.model}`
    return [
      { type: 'step', label },
      { type: 'provider_call', call },
    ]
  }
  if (name === 'Bash')
    return typeof tool.input.command === 'string' && tool.input.command.includes('curl')
      ? [{ type: 'step', label: 'Uploading references' }]
      : []
  const label = STEP_BY_TOOL[name]
  return label === undefined ? [] : [{ type: 'step', label }]
}

const toolUsesOf = (event: unknown): ToolUse[] => {
  if (!isRecord(event) || event.type !== 'assistant' || !isRecord(event.message)) return []
  const content = event.message.content
  if (!Array.isArray(content)) return []
  return content.flatMap((part: unknown) =>
    isRecord(part) && part.type === 'tool_use' && typeof part.name === 'string'
      ? [{ name: part.name, input: isRecord(part.input) ? part.input : {} }]
      : [],
  )
}

const parseJson = (line: string): unknown => {
  try {
    return JSON.parse(line) as unknown
  } catch {
    return null
  }
}

/** Signals carried by one line of `claude --output-format stream-json` output. */
export const parseAgentLine = (line: string): AgentSignal[] =>
  toolUsesOf(parseJson(line.trim())).flatMap(toolSignals)
