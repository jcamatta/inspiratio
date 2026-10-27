import type { LogRecord } from '@inspiratio/shared'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { expect, test } from '@playwright/test'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  API_URL,
  board,
  generations,
  nodeByTitle,
  pngFile,
  resetLibrary,
  uploadThroughToolbar,
} from './fixtures/app.ts'
import { makePng } from './fixtures/make-png.ts'

const DATA_DIR = resolve(import.meta.dirname, '..', '.e2e-data')

/** Starts the real Inspiratio MCP server over stdio, exactly like Claude Code does. */
const connectMcp = async (): Promise<Client> => {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  )
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', 'apps/server/src/mcp/main.ts'],
    cwd: resolve(import.meta.dirname, '..'),
    env: { ...env, INSPIRATIO_API_URL: API_URL, INSPIRATIO_DATA_DIR: DATA_DIR },
    stderr: 'ignore',
  })
  const client = new Client({ name: 'e2e-claude', version: '1.0.0' })
  await client.connect(transport)
  return client
}

const textOf = (result: Awaited<ReturnType<Client['callTool']>>): string => {
  const [first] = result.content as { type: string; text: string }[]
  return first?.text ?? ''
}

test.beforeEach(async ({ page, request }) => {
  await resetLibrary(request)
  await page.goto('/')
})

test('queues a prompt with references, fulfils it through the MCP and lands the result on the canvas', async ({
  page,
  request,
}) => {
  await uploadThroughToolbar({
    page,
    files: [
      pngFile({ name: 'location.png', from: [10, 20, 40], to: [60, 200, 255] }),
      pngFile({ name: 'lighting.png', from: [252, 120, 88], to: [40, 10, 10] }),
    ],
  })

  // Build the prompt: right-click → Create image… then drag the second reference into the prompt.
  await nodeByTitle({ page, title: 'location' }).click({ button: 'right' })
  await page.getByTestId('menu-generate-image').click()
  await expect(page.getByTestId('composer-reference')).toHaveCount(1)
  await nodeByTitle({ page, title: 'lighting' }).click()
  await page.getByTestId('node-drag-to-prompt').dragTo(page.getByTestId('composer-prompt'))
  await expect(page.getByTestId('composer-reference')).toHaveCount(2)
  const prompt = page.getByTestId('composer-prompt')
  await expect(prompt).toHaveValue(/@1 .*@2/)
  await prompt.fill('Wide night exterior of @1, lit like @2, anamorphic 2.39:1, light rain')
  await page.getByTestId('composer-aspect').click()
  await page.getByRole('option', { name: '21:9' }).click()
  await page.getByTestId('composer-submit').click()
  await expect(page.getByTestId('queue-item')).toHaveAttribute('data-status', 'pending')

  // Claude Code side: discover, start and complete the request through the Inspiratio MCP.
  const mcp = await connectMcp()
  try {
    const pending = JSON.parse(
      textOf(await mcp.callTool({ name: 'list_generation_requests', arguments: {} })),
    ) as { id: string }[]
    expect(pending).toHaveLength(1)
    const id = pending[0]?.id ?? ''
    const details = JSON.parse(
      textOf(await mcp.callTool({ name: 'get_generation_request', arguments: { id } })),
    ) as {
      request: {
        aspectRatio: string
        resolvedReferences: { label: string; absolutePath: string }[]
      }
    }
    expect(details.request.aspectRatio).toBe('21:9')
    expect(details.request.resolvedReferences.map((reference) => reference.label)).toEqual([
      '@1',
      '@2',
    ])
    await readFile(details.request.resolvedReferences[0]?.absolutePath ?? '')

    await mcp.callTool({ name: 'start_generation', arguments: { id } })
    await expect(page.getByTestId('queue-item')).toHaveAttribute('data-status', 'in_progress')

    const output = join(await mkdtemp(join(tmpdir(), 'inspiratio-e2e-')), 'result.png')
    await writeFile(
      output,
      makePng({ width: 960, height: 410, from: [20, 30, 80], to: [250, 120, 90] }),
    )
    const completed = textOf(
      await mcp.callTool({
        name: 'complete_generation',
        arguments: { id, results: [{ filePath: output, model: 'nano_banana_pro' }] },
      }),
    )
    expect(completed).toContain('Imported 1 result')
  } finally {
    await mcp.close()
  }

  // The result appears on the canvas, tagged and carrying its prompt.
  await expect(page.getByTestId('queue-item')).toHaveAttribute('data-status', 'completed', {
    timeout: 15_000,
  })
  await expect(page.locator('[data-testid^="media-node-"]')).toHaveCount(3)
  const snapshot = await board(request)
  const result = snapshot.items.find((item) => item.metadata.origin === 'generated')
  expect(result?.metadata.generation).toMatchObject({
    model: 'nano_banana_pro',
    provider: 'higgsfield',
  })
  expect(snapshot.tags.map((tag) => tag.name).sort()).toEqual([
    'ai-generated',
    'by:higgsfield',
    'model:nano_banana_pro',
  ])

  await page.getByTestId(`media-node-${result?.id ?? ''}`).click()
  await page.getByTestId('tab-inspector').click()
  await expect(page.getByTestId('inspector-model')).toHaveText('higgsfield · nano_banana_pro')
  await expect(page.getByTestId('inspector-prompt')).toContainText('lit like @2')

  // One trace links the browser click, the backend and the MCP calls.
  const [request0] = await generations(request)
  const lines = (await readFile(join(DATA_DIR, 'logs', 'inspiratio.ndjson'), 'utf8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as LogRecord)
  await expect
    .poll(async () => {
      const fresh = (await readFile(join(DATA_DIR, 'logs', 'inspiratio.ndjson'), 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as LogRecord)
      return [
        ...new Set(
          fresh
            .filter((record) => record.traceId === request0?.traceId)
            .map((record) => record.service),
        ),
      ].sort()
    })
    .toEqual(['mcp', 'server', 'web'])
  expect(lines.length).toBeGreaterThan(0)
})
