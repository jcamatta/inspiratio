import type { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
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

type FakeChild = EventEmitter & { readonly stdout: PassThrough; readonly stderr: PassThrough }

const fakeSpawn = (params: { readonly emit: (child: FakeChild) => void }) => {
  const calls: { command: string; args: readonly string[] }[] = []
  const spawnFn = ((...[command, args]: [string, readonly string[]]) => {
    calls.push({ command, args })
    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
    })
    setTimeout(() => params.emit(child), 0)
    return child
  }) as unknown as typeof spawn
  return { spawnFn, calls }
}

const finish = (params: { readonly child: FakeChild; readonly code: number }) => {
  params.child.stdout.end()
  params.child.stderr.end()
  params.child.stdout.on('end', () => {
    setTimeout(() => params.child.emit('close', params.code), 0)
  })
  params.child.stdout.resume()
}

const toolUse = (params: { readonly name: string; readonly input: object }): string =>
  JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', id: 't', name: params.name, input: params.input }] },
  })

const ignore = () => undefined

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
    expect(AGENT_TOOLS).toContain('Read')
  })

  it('writes the MCP config, logs each run and reports the exit code', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'agent-'))
    const { spawnFn, calls } = fakeSpawn({ emit: (child) => finish({ child, code: 0 }) })
    const run = await createClaudeAgentRunner({
      command: 'claude',
      model: 'sonnet',
      cwd: workDir,
      workDir,
      mcpServers: { inspiratio: { command: 'node' } },
      spawnFn,
    })
    const outcome = await run({ generationId: 'gen_1', onStep: ignore, onProviderCall: ignore })
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
    const outcome = await run({ generationId: 'gen_2', onStep: ignore, onProviderCall: ignore })
    expect(outcome.exitCode).toBeNull()
  })

  it('logs the raw output and reports steps and provider calls as they stream', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'agent-'))
    const lines = [
      JSON.stringify({ type: 'system', subtype: 'init' }),
      toolUse({ name: 'ToolSearch', input: { query: 'select:x' } }),
      toolUse({ name: 'mcp__inspiratio__get_generation_request', input: { id: 'gen_3' } }),
      toolUse({ name: 'mcp__inspiratio__start_generation', input: { id: 'gen_3' } }),
      toolUse({
        name: 'mcp__higgsfield__generate_image',
        input: { params: { model: 'nano_banana_pro', prompt: 'Rain at night' } },
      }),
    ]
    const { spawnFn } = fakeSpawn({
      emit: (child) => {
        child.stdout.write(`${lines.join('\r\n')}\n`)
        child.stderr.write('warning\n')
        finish({ child, code: 0 })
      },
    })
    const run = await createClaudeAgentRunner({
      command: 'claude',
      model: 'sonnet',
      cwd: workDir,
      workDir,
      mcpServers: {},
      spawnFn,
    })
    const steps: string[] = []
    const calls: unknown[] = []
    await run({
      generationId: 'gen_3',
      onStep: (label) => steps.push(label),
      onProviderCall: (call) => calls.push(call),
    })
    expect(steps).toEqual([
      'Starting Claude',
      'Reading the request',
      'Generating with nano_banana_pro',
    ])
    expect(calls).toEqual([{ model: 'nano_banana_pro', prompt: 'Rain at night' }])
    const log = await readFile(join(workDir, 'gen_3.log'), 'utf8')
    expect(log).toContain('generate_image')
    expect(log).toContain('warning')
  })
})
