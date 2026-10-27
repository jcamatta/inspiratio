import type { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AGENT_TOOLS,
  agentArgs,
  agentPrompt,
  createClaudeAgentRunner,
} from '../agent/agent-runner.ts'

const fakeSpawn = (params: { readonly emit: (child: EventEmitter) => void }) => {
  const calls: { command: string; args: readonly string[] }[] = []
  const spawnFn = ((...[command, args]: [string, readonly string[]]) => {
    calls.push({ command, args })
    const child = new EventEmitter()
    setTimeout(() => params.emit(child), 0)
    return child
  }) as unknown as typeof spawn
  return { spawnFn, calls }
}

describe('agent runner', () => {
  it('builds a headless Claude call limited to the generation tools', () => {
    const args = agentArgs({ generationId: 'gen_1', model: 'sonnet', mcpConfigPath: 'm.json' })
    expect(args.slice(0, 2)).toEqual(['-p', agentPrompt('gen_1')])
    expect(agentPrompt('gen_1')).toContain('gen_1')
    expect(args).toEqual(
      expect.arrayContaining([
        '--model',
        'sonnet',
        '--mcp-config',
        'm.json',
        '--strict-mcp-config',
      ]),
    )
    expect(args).toContain(AGENT_TOOLS.join(','))
  })

  it('writes the MCP config, logs each run and reports the exit code', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'agent-'))
    const { spawnFn, calls } = fakeSpawn({ emit: (child) => child.emit('exit', 0) })
    const run = await createClaudeAgentRunner({
      command: 'claude',
      model: 'sonnet',
      cwd: workDir,
      workDir,
      mcpServers: { inspiratio: { command: 'node' } },
      spawnFn,
    })
    const outcome = await run({ generationId: 'gen_1' })
    expect(outcome).toEqual({ exitCode: 0, logFile: join(workDir, 'gen_1.log') })
    expect(calls[0]?.command).toBe('claude')
    const config = JSON.parse(await readFile(join(workDir, 'mcp.json'), 'utf8')) as unknown
    expect(config).toEqual({ mcpServers: { inspiratio: { command: 'node' } } })
  })

  it('reports a missing command as no exit code', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'agent-'))
    const { spawnFn } = fakeSpawn({ emit: (child) => child.emit('error', new Error('ENOENT')) })
    const run = await createClaudeAgentRunner({
      command: 'nope',
      model: 'sonnet',
      cwd: workDir,
      workDir,
      mcpServers: {},
      spawnFn,
    })
    expect((await run({ generationId: 'gen_2' })).exitCode).toBeNull()
  })
})
