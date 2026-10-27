import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, open, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type AgentOutcome = { readonly exitCode: number | null; readonly logFile: string }

/** Runs an agent that fulfils one generation request and resolves when it exits. */
export type AgentRunner = (params: { readonly generationId: string }) => Promise<AgentOutcome>

export const AGENT_TOOLS = ['mcp__inspiratio', 'mcp__higgsfield', 'Bash(curl:*)'] as const

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

  return async ({ generationId }) => {
    const logFile = join(params.workDir, `${generationId}.log`)
    const log = await open(logFile, 'w')
    const child = spawnFn(
      params.command,
      agentArgs({ generationId, model: params.model, mcpConfigPath }),
      { cwd: params.cwd, stdio: ['ignore', log.fd, log.fd], windowsHide: true },
    )
    const exitCode = await once(child, 'exit').then(
      ([code]: unknown[]) => (typeof code === 'number' ? code : null),
      () => null,
    )
    await log.close()
    return { exitCode, logFile }
  }
}
