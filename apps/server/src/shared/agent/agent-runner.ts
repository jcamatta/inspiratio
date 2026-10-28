import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createWriteStream } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { parseAgentLine, STARTING_STEP, type ProviderCall } from './agent-steps.ts'

export type AgentOutcome = { readonly exitCode: number | null; readonly logFile: string }

export type AgentRunParams = {
  readonly generationId: string
  /** Called when the agent moves to a new step; consecutive identical steps are merged. */
  readonly onStep: (label: string) => void
  /** Called with the model and prompt of each generate call sent to the provider. */
  readonly onProviderCall: (call: ProviderCall) => void
}

/** Runs an agent that fulfils one generation request and resolves when it exits. */
export type AgentRunner = (params: AgentRunParams) => Promise<AgentOutcome>

export const AGENT_TOOLS = ['mcp__inspiratio', 'mcp__higgsfield', 'Bash(curl:*)', 'Read'] as const

export const agentPrompt = (generationId: string): string =>
  `Fulfil Inspiratio generation request ${generationId}: call mcp__inspiratio__get_generation_request and follow its guide exactly. Work fast, batch independent calls and do not explain.`

export const agentArgs = (params: {
  readonly generationId: string
  readonly model: string
  readonly mcpConfigPath: string
}): string[] => [
  '-p',
  agentPrompt(params.generationId),
  '--model',
  params.model,
  '--strict-mcp-config',
  '--mcp-config',
  params.mcpConfigPath,
  '--allowedTools',
  AGENT_TOOLS.join(','),
  '--output-format',
  'stream-json',
  '--verbose',
]

/** Headless Claude Code with only the Inspiratio and Higgsfield MCP servers; one log per request. */
export const createClaudeAgentRunner = async (params: {
  readonly command: string
  readonly model: string
  readonly cwd: string
  readonly workDir: string
  readonly mcpServers: Readonly<Record<string, unknown>>
  readonly spawnFn?: typeof spawn
}): Promise<AgentRunner> => {
  const spawnFn = params.spawnFn ?? spawn
  await mkdir(params.workDir, { recursive: true })
  const mcpConfigPath = join(params.workDir, 'mcp.json')
  await writeFile(mcpConfigPath, JSON.stringify({ mcpServers: params.mcpServers }, null, 2))

  return async ({ generationId, onStep, onProviderCall }) => {
    const logFile = join(params.workDir, `${generationId}.log`)
    const log = createWriteStream(logFile)
    await once(log, 'open')
    const child = spawnFn(
      params.command,
      agentArgs({ generationId, model: params.model, mcpConfigPath }),
      { cwd: params.cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
    )
    const step = { current: STARTING_STEP }
    onStep(STARTING_STEP)
    child.stdout.pipe(log, { end: false })
    child.stderr.pipe(log, { end: false })
    createInterface({ input: child.stdout, crlfDelay: Infinity }).on('line', (line: string) => {
      for (const signal of parseAgentLine(line)) {
        if (signal.type === 'provider_call') onProviderCall(signal.call)
        else if (signal.label !== step.current) {
          step.current = signal.label
          onStep(signal.label)
        }
      }
    })
    const exitCode = await once(child, 'close').then(
      ([code]: unknown[]) => (typeof code === 'number' ? code : null),
      () => null,
    )
    log.end()
    await once(log, 'close')
    return { exitCode, logFile }
  }
}
