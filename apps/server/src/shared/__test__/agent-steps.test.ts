import { describe, expect, it } from 'vitest'
import { parseAgentLine, providerCallOf, toolNameOf, toolSignals } from '../agent/agent-steps.ts'

const assistant = (content: readonly unknown[]): string =>
  JSON.stringify({
    type: 'assistant',
    message: { id: 'msg_1', role: 'assistant', model: 'claude-sonnet', content },
    session_id: 's',
  })

const toolUse = (params: { readonly name: string; readonly input?: object }) => ({
  type: 'tool_use',
  id: 'toolu_1',
  name: params.name,
  input: params.input ?? {},
})

const labelsOf = (line: string): string[] =>
  parseAgentLine(line).flatMap((signal) => (signal.type === 'step' ? [signal.label] : []))

describe('agent steps', () => {
  it('names the step of each generation tool', () => {
    expect(
      labelsOf(assistant([toolUse({ name: 'mcp__inspiratio__get_generation_request' })])),
    ).toEqual(['Reading the request'])
    expect(labelsOf(assistant([toolUse({ name: 'mcp__inspiratio__start_generation' })]))).toEqual([
      'Reading the request',
    ])
    expect(
      labelsOf(
        assistant([
          toolUse({ name: 'mcp__higgsfield__media_upload' }),
          toolUse({ name: 'mcp__higgsfield__media_confirm' }),
        ]),
      ),
    ).toEqual(['Uploading references', 'Uploading references'])
    expect(labelsOf(assistant([toolUse({ name: 'mcp__higgsfield__jobs_wait' })]))).toEqual([
      'Rendering on Higgsfield',
    ])
    expect(
      labelsOf(assistant([toolUse({ name: 'mcp__inspiratio__complete_generation' })])),
    ).toEqual(['Importing results'])
  })

  it('treats curl uploads as uploading and ignores other shell commands', () => {
    expect(
      labelsOf(
        assistant([
          toolUse({
            name: 'Bash',
            input: { command: 'curl -X PUT --upload-file "a.jpg" "https://s3/x"' },
          }),
        ]),
      ),
    ).toEqual(['Uploading references'])
    expect(labelsOf(assistant([toolUse({ name: 'Bash', input: { command: 'ls' } })]))).toEqual([])
    expect(toolSignals({ name: 'Bash', input: {} })).toEqual([])
  })

  it('reads the model and prompt sent to the provider', () => {
    const line = assistant([
      { type: 'text', text: 'Generating now' },
      toolUse({
        name: 'mcp__higgsfield__generate_video',
        input: { params: { model: 'kling3_0', prompt: 'Slow dolly in', aspect_ratio: '16:9' } },
      }),
    ])
    expect(parseAgentLine(line)).toEqual([
      { type: 'step', label: 'Generating with kling3_0' },
      { type: 'provider_call', call: { model: 'kling3_0', prompt: 'Slow dolly in' } },
    ])
    expect(providerCallOf({ model: 'm', prompt: ' ' })).toEqual({ model: 'm', prompt: null })
    expect(labelsOf(assistant([toolUse({ name: 'mcp__higgsfield__generate_image' })]))).toEqual([
      'Generating',
    ])
  })

  it('ignores progress reports, tool search, failures and anything that is not a tool call', () => {
    expect(
      labelsOf(
        assistant([
          toolUse({ name: 'ToolSearch', input: { query: 'select:mcp__higgsfield__jobs_wait' } }),
          toolUse({ name: 'mcp__inspiratio__report_progress', input: { message: 'Uploading' } }),
          toolUse({ name: 'mcp__inspiratio__fail_generation', input: { error: 'x' } }),
          { type: 'tool_use', id: 'x' },
          'text',
        ]),
      ),
    ).toEqual([])
    expect(parseAgentLine(JSON.stringify({ type: 'system', subtype: 'init' }))).toEqual([])
    expect(parseAgentLine(JSON.stringify({ type: 'assistant', message: {} }))).toEqual([])
    expect(parseAgentLine(JSON.stringify({ type: 'assistant' }))).toEqual([])
    expect(parseAgentLine(JSON.stringify(['array']))).toEqual([])
    expect(parseAgentLine('not json')).toEqual([])
    expect(parseAgentLine('')).toEqual([])
  })

  it('strips the MCP server prefix from tool names', () => {
    expect(toolNameOf('mcp__higgsfield__generate_image')).toBe('generate_image')
    expect(toolNameOf('Bash')).toBe('Bash')
  })

  it('accepts a tool call without input', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', name: 'mcp__higgsfield__jobs_wait' }] },
    })
    expect(labelsOf(line)).toEqual(['Rendering on Higgsfield'])
  })
})
