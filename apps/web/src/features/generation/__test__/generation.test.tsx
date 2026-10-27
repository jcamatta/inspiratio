import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppView } from '../../../app/App.view.tsx'
import { createFakeApi, makeGeneration, makeItem, makeTag } from '../../../__test__/fake-api.ts'
import { renderWithApp } from '../../../__test__/render.tsx'
import { EMPTY_COMPOSER } from '../../workspace/domain/workspace.ts'
import { ITEM_DRAG_TYPE } from '../../board/domain/drop-data.ts'

const items = [
  makeItem({ id: 'itm_a', title: 'Neon' }),
  makeItem({
    id: 'itm_b',
    title: 'Clip',
    kind: 'video',
    media: { fileName: 'b.mp4', mimeType: 'video/mp4', bytes: 1, width: 1, height: 1 },
  }),
]

const dropEvent = (data: Record<string, string>) => ({
  dataTransfer: {
    types: Object.keys(data),
    getData: (type: string) => data[type] ?? '',
    dropEffect: 'none',
  },
})

describe('Composer', () => {
  it('accepts references dropped on the tray and the prompt', async () => {
    const { user } = renderWithApp({
      ui: <AppView />,
      api: createFakeApi({ items }),
      workspace: { panelTab: 'generate' },
    })
    const zone = await screen.findByTestId('composer-dropzone')
    fireEvent.dragOver(zone, dropEvent({ 'text/plain': 'x' }))
    fireEvent.dragOver(zone, dropEvent({ [ITEM_DRAG_TYPE]: '["itm_a"]' }))
    fireEvent.dragLeave(zone)
    fireEvent.drop(zone, dropEvent({ [ITEM_DRAG_TYPE]: '["itm_a"]' }))
    await waitFor(() => {
      expect(screen.getAllByTestId('composer-reference')).toHaveLength(1)
    })
    const prompt = screen.getByTestId('composer-prompt')
    fireEvent.drop(prompt, dropEvent({ [ITEM_DRAG_TYPE]: '["itm_b"]' }))
    fireEvent.drop(prompt, dropEvent({ 'text/plain': 'nothing' }))
    expect(screen.getAllByTestId('composer-reference')).toHaveLength(2)
    expect(prompt).toHaveValue('@1 @2 ')
    await user.click(screen.getByRole('button', { name: 'Remove @1' }))
    expect(screen.getAllByTestId('composer-reference')).toHaveLength(1)
    expect(prompt).toHaveValue('@1')
  })

  it('warns about dangling tokens and blocks submission', async () => {
    const { user } = renderWithApp({
      ui: <AppView />,
      api: createFakeApi({ items }),
      workspace: { panelTab: 'generate' },
    })
    await user.type(await screen.findByTestId('composer-prompt'), 'like @3')
    expect(screen.getByTestId('composer-dangling')).toHaveTextContent(
      '@3 does not match any reference',
    )
    expect(screen.getByTestId('composer-submit')).toHaveAttribute('data-disabled')
    await user.type(screen.getByTestId('composer-prompt'), ' @4')
    expect(screen.getByTestId('composer-dangling')).toHaveTextContent('do not match')
  })

  it('uses the selection, changes settings and submits with Ctrl+Enter', async () => {
    const api = createFakeApi({ items })
    const { user } = renderWithApp({
      ui: <AppView />,
      api,
      workspace: { panelTab: 'generate', selection: ['itm_b'] },
    })
    await screen.findByTestId('media-node-itm_b')
    await user.click(screen.getByTestId('composer-use-selection'))
    await user.click(screen.getByTestId('composer-kind-video'))
    await user.click(screen.getByTestId('composer-model'))
    await user.click(await screen.findByRole('option', { name: 'Kling 3.0' }))
    await user.click(screen.getByTestId('composer-aspect'))
    await user.click(await screen.findByRole('option', { name: '9:16' }))
    await user.click(screen.getByTestId('composer-count'))
    await user.click(await screen.findByRole('option', { name: '2×' }))
    await user.type(screen.getByTestId('composer-prompt'), 'slow dolly{Control>}{Enter}{/Control}')
    await waitFor(() => {
      expect(api.requestsTo({ method: 'POST', path: '/api/generations' })[0]?.body).toEqual({
        prompt: '@1 slow dolly',
        kind: 'video',
        model: 'kling3_0',
        aspectRatio: '9:16',
        count: 2,
        referenceItemIds: ['itm_b'],
      })
    })
    expect(await screen.findByText('Queued for Claude Code')).toBeInTheDocument()
  })

  it('shows the instruction when the clipboard is unavailable', async () => {
    const { user } = renderWithApp({
      ui: <AppView />,
      api: createFakeApi({ items }),
      workspace: { panelTab: 'generate', composer: { ...EMPTY_COMPOSER, prompt: 'Neon rain' } },
    })
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'))
    await user.click(await screen.findByTestId('composer-submit'))
    expect(await screen.findByText(/Use the inspiratio-generate skill/)).toBeInTheDocument()
  })
})

describe('Queue', () => {
  it('copies instructions and focuses references and results', async () => {
    const api = createFakeApi({
      items: [...items, makeItem({ id: 'itm_r' })],
      generations: [
        makeGeneration({
          id: 'gen_1',
          references: [
            { itemId: 'itm_a', label: '@1' },
            { itemId: 'itm_b', label: '@2' },
          ],
        }),
        makeGeneration({ id: 'gen_2', status: 'completed', resultItemIds: ['itm_r', 'itm_gone'] }),
        makeGeneration({
          id: 'gen_3',
          status: 'in_progress',
          references: [{ itemId: 'itm_gone', label: '@1' }],
        }),
      ],
    })
    const { user } = renderWithApp({ ui: <AppView />, api, workspace: { panelTab: 'queue' } })
    const copy = vi.spyOn(navigator.clipboard, 'writeText')
    const [pending, completed] = await screen.findAllByTestId('queue-item')
    await user.click(
      within(pending ?? document.body).getByRole('button', {
        name: 'Copy Claude Code instruction',
      }),
    )
    expect(copy).toHaveBeenCalledWith(expect.stringContaining('gen_1'))
    await user.click(
      within(pending ?? document.body).getByRole('button', { name: 'Show on canvas' }),
    )
    await user.click(
      within(completed ?? document.body).getByRole('button', { name: 'Show on canvas' }),
    )
    expect(screen.getByTestId('tab-queue')).toHaveTextContent('2')
  })

  it('shows an empty state and refreshes the board when a request completes', async () => {
    const api = createFakeApi({ items })
    const { queryClient } = renderWithApp({
      ui: <AppView />,
      api,
      workspace: { panelTab: 'queue' },
    })
    expect(await screen.findByTestId('queue-empty')).toBeInTheDocument()
    api.state.items.push(makeItem({ id: 'itm_new', title: 'Result' }))
    api.state.generations.push(
      makeGeneration({ id: 'gen_done', status: 'completed', resultItemIds: ['itm_new'] }),
    )
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['generations'] })
    })
    expect(await screen.findByTestId('media-node-itm_new')).toBeInTheDocument()
  })
})

describe('Item details', () => {
  it('shows generation metadata with prompt actions', async () => {
    const generated = makeItem({
      id: 'itm_g',
      title: 'Generated',
      tagIds: ['t_ai'],
      metadata: {
        ...makeItem({ id: 'x' }).metadata,
        origin: 'generated',
        sourceUrl: 'https://cdn.higgsfield.ai/out.png',
        generation: {
          requestId: 'gen_1',
          provider: 'higgsfield',
          model: 'nano_banana_pro',
          prompt: 'Neon rain like @1',
          referenceItemIds: ['itm_a', 'itm_b'],
        },
      },
    })
    const api = createFakeApi({
      items: [...items, generated],
      tags: [makeTag({ id: 't_ai', name: 'ai-generated', system: true })],
    })
    const { user } = renderWithApp({ ui: <AppView />, api, workspace: { selection: ['itm_g'] } })
    const copy = vi.spyOn(navigator.clipboard, 'writeText')
    expect(await screen.findByTestId('inspector-model')).toHaveTextContent(
      'higgsfield · nano_banana_pro',
    )
    expect(screen.getByTestId('inspector-prompt')).toHaveTextContent('Neon rain like @1')
    await user.click(screen.getByRole('button', { name: 'Copy prompt' }))
    expect(copy).toHaveBeenCalledWith('Neon rain like @1')
    await user.click(screen.getByRole('button', { name: 'Show Neon' }))
    await user.click(
      within(screen.getByTestId('inspector')).getByRole('button', { name: 'View full size' }),
    )
    expect(await screen.findByTestId('viewer')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    const chip = screen.getByTestId('chip-ai-generated')
    await user.click(within(chip).getByRole('button', { name: 'Remove ai-generated' }))
    await waitFor(() => {
      expect(api.state.items.find((item) => item.id === 'itm_g')?.tagIds).toEqual([])
    })
    expect(screen.getByText('cdn.higgsfield.ai')).toHaveAttribute(
      'href',
      'https://cdn.higgsfield.ai/out.png',
    )
  })

  it('does not save unchanged or empty titles', async () => {
    const api = createFakeApi({ items })
    const { user } = renderWithApp({ ui: <AppView />, api, workspace: { selection: ['itm_b'] } })
    const title = await screen.findByTestId('inspector-title')
    await user.clear(title)
    fireEvent.blur(title)
    fireEvent.blur(screen.getByTestId('inspector-notes'))
    expect(api.requestsTo({ method: 'PATCH', path: '/api/items/itm_b' })).toHaveLength(0)
  })
})
