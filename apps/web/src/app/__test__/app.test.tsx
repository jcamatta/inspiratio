import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  createFakeApi,
  makeGeneration,
  makeItem,
  makeSection,
  makeTag,
} from '../../__test__/fake-api.ts'
import { renderWithApp } from '../../__test__/render.tsx'
import { AppView } from '../App.view.tsx'

const seeded = () =>
  createFakeApi({
    items: [
      makeItem({ id: 'itm_a', title: 'Neon alley', position: { x: 0, y: 0 } }),
      makeItem({
        id: 'itm_b',
        title: 'Fog forest',
        position: { x: 400, y: 0 },
        tagIds: ['tag_noir'],
      }),
    ],
    tags: [makeTag({ id: 'tag_noir', name: 'noir' })],
    sections: [makeSection({ id: 'sec_1', title: 'Act I', position: { x: 0, y: 400 } })],
  })

describe('App', () => {
  it('renders the board from the backend', async () => {
    renderWithApp({ ui: <AppView />, api: seeded() })
    expect(await screen.findByTestId('media-node-itm_a')).toBeInTheDocument()
    expect(screen.getByTestId('media-node-itm_b')).toBeInTheDocument()
    expect(screen.getByTestId('section-node-sec_1')).toBeInTheDocument()
    expect(screen.getByText('2 refs')).toBeInTheDocument()
    expect(screen.getByTestId('inspector-empty')).toBeInTheDocument()
  })

  it('shows the empty state when the library is empty', async () => {
    renderWithApp({ ui: <AppView /> })
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument()
  })

  it('queues a generation from the composer with traced requests', async () => {
    const api = seeded()
    const { user } = renderWithApp({
      ui: <AppView />,
      api,
      workspace: {
        panelTab: 'generate',
        composer: {
          prompt: '',
          references: ['itm_a'],
          kind: 'image',
          model: 'auto',
          aspectRatio: 'auto',
          count: 1,
        },
      },
    })
    await screen.findByTestId('media-node-itm_a')
    expect(screen.getAllByTestId('composer-reference')).toHaveLength(1)
    await user.type(screen.getByTestId('composer-prompt'), 'Rainy street like @1')
    await user.click(screen.getByTestId('composer-submit'))
    await waitFor(() => {
      expect(api.state.generations).toHaveLength(1)
    })
    const [created] = api.requestsTo({ method: 'POST', path: '/api/generations' })
    expect(created?.body).toMatchObject({
      prompt: 'Rainy street like @1',
      referenceItemIds: ['itm_a'],
      model: null,
      aspectRatio: null,
    })
    expect(created?.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/)
    expect(await screen.findByTestId('queue-item')).toHaveAttribute('data-status', 'pending')
  })

  it('lists completed generations with their results in the queue', async () => {
    const api = createFakeApi({
      items: [makeItem({ id: 'itm_a' }), makeItem({ id: 'itm_r' })],
      generations: [
        makeGeneration({
          id: 'gen_1',
          status: 'completed',
          references: [{ itemId: 'itm_a', label: '@1' }],
          resultItemIds: ['itm_r'],
        }),
        makeGeneration({ id: 'gen_2', status: 'failed', error: 'Out of credits' }),
      ],
    })
    const { user } = renderWithApp({ ui: <AppView />, api, workspace: { panelTab: 'queue' } })
    const cards = await screen.findAllByTestId('queue-item')
    expect(cards).toHaveLength(2)
    expect(within(cards[1] ?? document.body).getByText('Out of credits')).toBeInTheDocument()
    await user.click(within(cards[1] ?? document.body).getByRole('button', { name: 'Retry' }))
    await waitFor(() => {
      expect(api.state.generations.find((request) => request.id === 'gen_2')?.status).toBe(
        'pending',
      )
    })
    await user.click(within(cards[0] ?? document.body).getByTestId('queue-delete'))
    await waitFor(() => {
      expect(api.state.generations.map((request) => request.id)).toEqual(['gen_2'])
    })
  })

  it('edits the selected item in the inspector', async () => {
    const api = seeded()
    const { user } = renderWithApp({ ui: <AppView />, api, workspace: { selection: ['itm_b'] } })
    const title = await screen.findByTestId('inspector-title')
    await user.clear(title)
    await user.type(title, 'Misty pines{Enter}')
    await waitFor(() => {
      expect(api.state.items.find((item) => item.id === 'itm_b')?.title).toBe('Misty pines')
    })
    await user.type(screen.getByTestId('inspector-notes'), 'soft light')
    fireEvent.blur(screen.getByTestId('inspector-notes'))
    await waitFor(() => {
      expect(api.state.items.find((item) => item.id === 'itm_b')?.metadata.notes).toBe('soft light')
    })
    expect(screen.getByTestId('inspector-metadata')).toHaveTextContent('640 × 360')
    expect(screen.getByTestId('chip-noir')).toBeInTheDocument()
  })

  it('applies shared tags to a multi-selection', async () => {
    const api = seeded()
    const { user } = renderWithApp({
      ui: <AppView />,
      api,
      workspace: { selection: ['itm_a', 'itm_b'] },
    })
    expect(await screen.findByTestId('inspector-multi')).toHaveTextContent('2 references selected')
    const input = within(screen.getByTestId('inspector-multi')).getByTestId('tag-picker')
    await user.type(input, 'warm{Enter}')
    await waitFor(() => {
      const warm = api.state.tags.find((tag) => tag.name === 'warm')
      expect(warm).toBeDefined()
      expect(api.state.items.every((item) => item.tagIds.includes(warm?.id ?? ''))).toBe(true)
    })
    await user.click(screen.getByTestId('inspector-use-references'))
    expect(await screen.findAllByTestId('composer-reference')).toHaveLength(2)
  })

  it('filters the board by text and dims non matching items', async () => {
    const { user } = renderWithApp({ ui: <AppView />, api: seeded() })
    await screen.findByTestId('media-node-itm_a')
    await user.type(screen.getByTestId('filter-text'), 'fog')
    await waitFor(() => {
      expect(screen.getByTestId('media-node-itm_a').className).toContain('opacity-20')
    })
    expect(screen.getByTestId('media-node-itm_b').className).not.toContain('opacity-20')
  })

  it('creates sections and toggles the side panel from the toolbar', async () => {
    const api = seeded()
    const { user } = renderWithApp({ ui: <AppView />, api })
    await screen.findByTestId('media-node-itm_a')
    await user.click(screen.getByTestId('toolbar-add-section'))
    await waitFor(() => {
      expect(api.state.sections).toHaveLength(2)
    })
    await user.click(screen.getByTestId('toolbar-panel'))
    expect(screen.queryByTestId('side-panel')).not.toBeInTheDocument()
    await user.click(screen.getByTestId('toolbar-fit'))
    await user.click(screen.getByRole('button', { name: 'Zoom in' }))
    await user.click(screen.getByRole('button', { name: 'Zoom out' }))
    expect(screen.getByTestId('zoom-level')).toHaveTextContent('%')
  })

  it('uploads files picked from the toolbar', async () => {
    const api = seeded()
    const { user } = renderWithApp({ ui: <AppView />, api })
    await screen.findByTestId('media-node-itm_a')
    await user.upload(
      screen.getByTestId('file-input'),
      new File(['png'], 'still.png', { type: 'image/png' }),
    )
    await waitFor(() => {
      expect(api.state.items).toHaveLength(3)
    })
    expect(await screen.findByText('Added 1 reference(s)')).toBeInTheDocument()
  })

  it('imports a URL through the toolbar dialog', async () => {
    const api = seeded()
    const { user } = renderWithApp({ ui: <AppView />, api })
    await screen.findByTestId('media-node-itm_a')
    await user.click(screen.getByTestId('toolbar-import-url'))
    const dialog = await screen.findByTestId('url-dialog')
    const submit = within(dialog).getByTestId('url-submit')
    expect(submit).toHaveAttribute('data-disabled')
    await user.type(within(dialog).getByTestId('url-input'), 'https://cosmos.so/e/1{Enter}')
    await waitFor(() => {
      expect(
        api.state.items.some((item) => item.metadata.sourceUrl === 'https://cosmos.so/e/1'),
      ).toBe(true)
    })
  })

  it('reports failed commands with a toast that carries the trace id', async () => {
    const api = seeded()
    api.failNext({ method: 'POST', resource: 'sections', message: 'Disk full' })
    const { user } = renderWithApp({ ui: <AppView />, api })
    await screen.findByTestId('media-node-itm_a')
    await user.click(screen.getByTestId('toolbar-add-section'))
    expect(await screen.findByText('Could not create the section')).toBeInTheDocument()
    expect(screen.getByText(/Disk full · trace/)).toBeInTheDocument()
  })
})
