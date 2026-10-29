import type { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { describe, expect, it } from 'vitest'
import {
  createClaudeIdeaHelper,
  ideaArgs,
  ideaPrompt,
  parseIdeaOutput,
  type IdeaRequest,
} from '../agent/idea-helper.ts'

const REQUEST: IdeaRequest = {
  kind: 'video',
  brief: 'make @1 move like a vortex',
  references: [
    { label: '@1', kind: 'image', title: 'blue-sky', path: '/media/sky.png' },
    { label: '@2', kind: 'video', title: 'waves', path: '/media/waves.mp4' },
  ],
  history: [],
}

const envelope = (result: string) => JSON.stringify({ type: 'result', is_error: false, result })

const fakeSpawn = (params: { readonly stdout: string; readonly code: number }) => {
  const calls: { args: readonly string[]; stdin: string }[] = []
  const spawnFn = ((...[, args]: [string, readonly string[]]) => {
    const stdin = new PassThrough()
    const call = { args, stdin: '' }
    calls.push(call)
    stdin.on('data', (chunk: Buffer) => {
      call.stdin += chunk.toString('utf8')
    })
    const child = Object.assign(new EventEmitter(), {
      stdin,
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: () => true,
    })
    setTimeout(() => {
      child.stdout.end(params.stdout)
      child.stderr.end()
      setTimeout(() => child.emit('close', params.code), 0)
    }, 0)
    return child
  }) as unknown as typeof spawn
  return { spawnFn, calls }
}

describe('idea helper', () => {
  it('asks about the idea, not the model, and lists the references', () => {
    const prompt = ideaPrompt(REQUEST)
    expect(prompt).toContain('make @1 move like a vortex')
    expect(prompt).toContain('- @1: image "blue-sky", file /media/sky.png')
    expect(prompt).toContain('- @2: video "waves" (not readable')
    expect(prompt).toContain('what the camera does')
    expect(prompt).toContain('No model names')
    expect(ideaPrompt({ ...REQUEST, kind: 'image', references: [] })).toContain('- none')
    expect(prompt).not.toContain('Refining so far')
  })

  it('revises its last version with the feedback of the user', () => {
    const prompt = ideaPrompt({
      ...REQUEST,
      history: [
        { suggestion: 'A slow vortex', feedback: 'faster' },
        { suggestion: 'A fast vortex', feedback: 'turn clockwise' },
      ],
    })
    expect(prompt).toContain(
      ['Your version 2:', 'A fast vortex', 'Feedback of the user on it:', 'turn clockwise'].join(
        '\n',
      ),
    )
    expect(prompt).toContain('Revise your last version following the last feedback')
  })

  it('runs Claude with only the Read tool and the media folder', () => {
    expect(ideaArgs({ model: 'sonnet', mediaDir: '/media' })).toEqual([
      '-p',
      '--model',
      'sonnet',
      '--strict-mcp-config',
      '--allowedTools',
      'Read',
      '--add-dir',
      '/media',
      '--output-format',
      'json',
    ])
  })

  it('reads the suggestion out of the Claude answer', () => {
    expect(
      parseIdeaOutput(envelope('Here:\n```json\n{"brief":"A vortex","questions":[]}\n```')),
    ).toEqual({ ok: true, value: { brief: 'A vortex', questions: [] } })
    expect(parseIdeaOutput('not json').ok).toBe(false)
    expect(
      parseIdeaOutput(JSON.stringify({ is_error: true, result: '{"brief":"x","questions":[]}' }))
        .ok,
    ).toBe(false)
    expect(parseIdeaOutput(envelope('no object here')).ok).toBe(false)
  })

  it('sends the prompt on stdin and fails when Claude exits with an error', async () => {
    const good = fakeSpawn({
      stdout: envelope('{"brief":"A vortex","questions":["Fast?"]}'),
      code: 0,
    })
    const helper = createClaudeIdeaHelper({
      command: 'claude',
      model: 'sonnet',
      cwd: '.',
      mediaDir: '/media',
      spawnFn: good.spawnFn,
    })
    expect(await helper(REQUEST)).toEqual({
      ok: true,
      value: { brief: 'A vortex', questions: ['Fast?'] },
    })
    expect(good.calls[0]?.stdin).toContain('make @1 move like a vortex')

    const bad = fakeSpawn({ stdout: '', code: 1 })
    const failing = createClaudeIdeaHelper({
      command: 'claude',
      model: 'sonnet',
      cwd: '.',
      mediaDir: '/media',
      spawnFn: bad.spawnFn,
    })
    expect((await failing(REQUEST)).ok).toBe(false)
  })
})
