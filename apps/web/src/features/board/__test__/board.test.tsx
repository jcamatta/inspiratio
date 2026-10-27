import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppView } from '../../../app/App.view.tsx'
import {
  createFakeApi,
  makeGeneration,
  makeItem,
  makeSection,
  makeTag,
} from '../../../__test__/fake-api.ts'
import { renderWithApp } from '../../../__test__/render.tsx'

const seeded = () =>
  createFakeApi({
    items: [
      makeItem({ id: 'itm_a', title: 'Neon alley', zIndex: 2, tagIds: ['tag_noir'] }),
      makeItem({ id: 'itm_b', title: 'In section', sectionId: 'sec_1', position: { x: 5, y: 5 } }),
      makeItem({
        id: 'itm_v',
        kind: 'video',
        title: 'Clip',
        media: {
          fileName: 'itm_v.mp4',
          mimeType: 'video/mp4',
          bytes: 10,
          width: null,
          height: null,
        },
      }),
    ],
    tags: [
      makeTag({ id: 'tag_noir', name: 'noir' }),
      makeTag({ id: 'tag_ai', name: 'ai-generated', system: true }),
    ],
    sections: [makeSection({ id: 'sec_1', title: 'Act I', position: { x: 100, y: 100 } })],
  })

const transfer = ({
  data,
  files = [],
}: {
  readonly data: Record<string, string>
  readonly files?: File[]
}) => ({
  files,
  types: Object.keys(data),
  getData: (type: string) => data[type] ?? '',
  dropEffect: 'none',
})

const openMenuOn = async (element: Element) => {
  fireEvent.contextMenu(element, { clientX: 10, clientY: 10 })
  return screen.findByTestId('context-menu')
}

const pane = () => document.querySelector('.react-flow__pane') ?? screen.getByTestId('board')

const item = ({ api, id }: { readonly api: ReturnType<typeof seeded>; readonly id: string }) =>
  api.state.items.find((candidate) => candidate.id === id)

describe('Canvas', () => {
  it('renders the board with a bottom bar and an empty state when empty', async () => {
    renderWithApp({ ui: <AppView />, api: seeded() })
    expect(await screen.findByTestId('media-node-itm_a')).toBeInTheDocument()
    expect(screen.getByTestId('section-node-sec_1')).toBeInTheDocument()
    expect(screen.getByTestId('bottom-bar')).toBeInTheDocument()
    expect(screen.getByTestId('undo')).toHaveAttribute('data-disabled')
  })

  it('shows the empty state', async () => {
    renderWithApp({ ui: <AppView /> })
    expect(await screen.findByTestId('empty-state')).toHaveTextContent('Drop images or videos')
  })

  it('renames an image by double-clicking it and undoes it', async () => {
    const api = seeded()
    const { user } = renderWithApp({ ui: <AppView />, api })
    fireEvent.doubleClick(await screen.findByTestId('media-node-itm_a'))
    const input = await screen.findByTestId('node-title-input')
    await user.clear(input)
    await user.type(input, 'Night market{Enter}')
    await waitFor(() => {
      expect(item({ api, id: 'itm_a' })?.title).toBe('Night market')
    })
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })
    await waitFor(() => {
      expect(item({ api, id: 'itm_a' })?.title).toBe('Neon alley')
    })
    expect(await screen.findByText('Undone: Rename')).toBeInTheDocument()
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true, shiftKey: true })
    await waitFor(() => {
      expect(item({ api, id: 'itm_a' })?.title).toBe('Night market')
    })
    fireEvent.doubleClick(screen.getByTestId('media-node-itm_a'))
    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('node-title-input')).not.toBeInTheDocument()
  })

  it('adds and removes tags on a selected image', async () => {
    const api = seeded()
    const { user } = renderWithApp({ ui: <AppView />, api, workspace: { selection: ['itm_a'] } })
    const node = await screen.findByTestId('media-node-itm_a')
    await user.click(within(node).getByRole('button', { name: 'Remove noir' }))
    await waitFor(() => {
      expect(item({ api, id: 'itm_a' })?.tagIds).toEqual([])
    })
    await user.click(within(screen.getByTestId('media-node-itm_a')).getByTestId('node-add-tag'))
    await user.type(await screen.findByTestId('node-tag-picker'), 'storm{Enter}')
    await waitFor(() => {
      expect(item({ api, id: 'itm_a' })?.tagIds).toHaveLength(1)
    })
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByTestId('node-tag-picker')).not.toBeInTheDocument()
    })
    await user.click(screen.getByTestId('undo'))
    await waitFor(() => {
      expect(item({ api, id: 'itm_a' })?.tagIds).toEqual([])
    })
    await user.click(screen.getByTestId('redo'))
  })

  it('offers image actions in the context menu', async () => {
    const api = seeded()
    const { user } = renderWithApp({ ui: <AppView />, api })
    const node = await screen.findByTestId('media-node-itm_a')

    await user.click(within(await openMenuOn(node)).getByTestId('menu-front'))
    await waitFor(() => {
      expect(item({ api, id: 'itm_a' })?.zIndex).toBe(3)
    })
    await user.click(within(await openMenuOn(node)).getByTestId('menu-back'))
    await waitFor(() => {
      expect(item({ api, id: 'itm_a' })?.zIndex).toBeLessThan(0)
    })
    await user.click(within(await openMenuOn(node)).getByTestId('menu-rename'))
    expect(await screen.findByTestId('node-title-input')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await user.click(within(await openMenuOn(node)).getByTestId('menu-tags'))
    expect(await screen.findByTestId('node-tag-picker')).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await user.click(within(await openMenuOn(node)).getByTestId('menu-details'))
    const details = await screen.findByTestId('details')
    expect(within(details).getByTestId('details-metadata')).toHaveTextContent('640 × 360')
    await user.type(within(details).getByTestId('details-notes'), 'wet asphalt')
    await user.click(within(details).getByTestId('dialog-close'))
    await waitFor(() => {
      expect(item({ api, id: 'itm_a' })?.metadata.notes).toBe('wet asphalt')
    })

    await user.click(within(await openMenuOn(node)).getByTestId('menu-delete'))
    await waitFor(() => {
      expect(item({ api, id: 'itm_a' })).toBeUndefined()
    })
    await user.click(screen.getByTestId('undo'))
    await waitFor(() => {
      expect(item({ api, id: 'itm_a' })).toBeDefined()
    })
  })

  it('zooms, pans and closes the full-size viewer', async () => {
    const { user } = renderWithApp({ ui: <AppView />, api: seeded() })
    await user.click(
      within(await openMenuOn(await screen.findByTestId('media-node-itm_a'))).getByTestId(
        'menu-view',
      ),
    )
    const viewer = await screen.findByTestId('viewer')
    const zoom = within(viewer).getByTestId('viewer-zoom')
    expect(zoom).toHaveTextContent('100%')
    await user.click(within(viewer).getByTestId('viewer-zoom-in'))
    expect(zoom).toHaveTextContent('140%')
    await user.click(within(viewer).getByTestId('viewer-zoom-out'))
    expect(zoom).toHaveTextContent('100%')
    const stage = within(viewer).getByTestId('viewer-stage')
    stage.setPointerCapture = vi.fn()
    fireEvent.wheel(stage, { deltaY: -500, clientX: 50, clientY: 50 })
    expect(zoom).not.toHaveTextContent('100%')
    fireEvent.pointerDown(stage, { clientX: 10, clientY: 10, pointerId: 1 })
    fireEvent.pointerMove(stage, { clientX: 30, clientY: 40, pointerId: 1 })
    fireEvent.pointerUp(stage)
    fireEvent.pointerMove(stage, { clientX: 90, clientY: 90 })
    expect(within(viewer).getByTestId('viewer-content').style.transform).toContain('translate(')
    fireEvent.doubleClick(stage)
    expect(zoom).toHaveTextContent('100%')
    await user.click(within(viewer).getByTestId('viewer-reset'))
    await user.click(within(viewer).getByTestId('dialog-close'))
    await waitFor(() => {
      expect(screen.queryByTestId('viewer')).not.toBeInTheDocument()
    })
  })

  it('handles sections: detach, rename, delete and undo', async () => {
    const api = seeded()
    const { user } = renderWithApp({ ui: <AppView />, api })
    await user.click(
      within(await openMenuOn(await screen.findByTestId('media-node-itm_b'))).getByTestId(
        'menu-detach',
      ),
    )
    await waitFor(() => {
      expect(item({ api, id: 'itm_b' })).toMatchObject({
        sectionId: null,
        position: { x: 105, y: 105 },
      })
    })
    await user.click(screen.getByTestId('undo'))
    await waitFor(() => {
      expect(item({ api, id: 'itm_b' })?.sectionId).toBe('sec_1')
    })
    const section = screen.getByTestId('section-node-sec_1')
    await user.click(within(await openMenuOn(section)).getByTestId('menu-rename-section'))
    const input = await screen.findByTestId('section-title-input')
    await user.clear(input)
    await user.type(input, 'Act II{Enter}')
    await waitFor(() => {
      expect(api.state.sections[0]?.title).toBe('Act II')
    })
    fireEvent.doubleClick(await screen.findByTestId('section-title'))
    await user.keyboard('{Escape}')
    await user.click(
      within(await openMenuOn(screen.getByTestId('section-node-sec_1'))).getByTestId(
        'menu-delete-section',
      ),
    )
    await waitFor(() => {
      expect(api.state.sections).toHaveLength(0)
    })
    await user.click(screen.getByTestId('undo'))
    await waitFor(() => {
      expect(api.state.sections).toHaveLength(1)
      expect(item({ api, id: 'itm_b' })?.sectionId).toBe(api.state.sections[0]?.id)
    })
  })

  it('offers canvas actions in the context menu', async () => {
    const api = seeded()
    const { user } = renderWithApp({ ui: <AppView />, api })
    await screen.findByTestId('media-node-itm_a')
    await user.click(within(await openMenuOn(pane())).getByTestId('menu-add-section'))
    await waitFor(() => {
      expect(api.state.sections).toHaveLength(2)
    })
    await user.click(screen.getByTestId('undo'))
    await waitFor(() => {
      expect(api.state.sections).toHaveLength(1)
    })
    await user.click(within(await openMenuOn(pane())).getByTestId('menu-select-all'))
    expect(await screen.findByTestId('selection-count')).toHaveTextContent('3 selected')
    await user.click(within(await openMenuOn(pane())).getByTestId('menu-fit'))
    await user.click(within(await openMenuOn(pane())).getByTestId('menu-import-url'))
    const dialog = await screen.findByTestId('url-dialog')
    await user.type(
      within(dialog).getByTestId('url-input'),
      'https://www.pinterest.com/pin/1{Enter}',
    )
    await waitFor(() => {
      expect(api.state.items).toHaveLength(4)
    })
    await user.click(screen.getByTestId('zoom-in'))
    await user.click(screen.getByTestId('zoom-out'))
    await user.click(screen.getByTestId('fit'))
    expect(screen.getByTestId('zoom-level')).toHaveTextContent('%')
  })

  it('imports dropped files and links, and pasted images', async () => {
    const api = seeded()
    renderWithApp({ ui: <AppView />, api })
    const board = await screen.findByTestId('board')
    fireEvent.dragOver(board, { dataTransfer: transfer({ data: {} }) })
    fireEvent.dragLeave(board)
    fireEvent.drop(board, {
      dataTransfer: transfer({
        data: {},
        files: [new File(['x'], 'a.png', { type: 'image/png' })],
      }),
    })
    await waitFor(() => {
      expect(api.state.items).toHaveLength(4)
    })
    fireEvent.drop(board, {
      dataTransfer: transfer({
        data: { 'text/uri-list': 'https://a.dev/1.jpg\nhttps://a.dev/2.jpg' },
      }),
    })
    await waitFor(() => {
      expect(api.state.items).toHaveLength(6)
    })
    const paste = (params: { readonly target: EventTarget; readonly text: string }) => {
      const event = new Event('paste', { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'clipboardData', {
        value: transfer({ data: { 'text/plain': params.text } }),
      })
      act(() => {
        params.target.dispatchEvent(event)
      })
    }
    paste({ target: document.body, text: 'https://cosmos.so/e/9' })
    await waitFor(() => {
      expect(api.state.items).toHaveLength(7)
    })
    paste({ target: document.body, text: 'hello' })
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })
    await waitFor(() => {
      expect(api.state.items).toHaveLength(6)
    })
  })

  it('deletes selected nodes with the keyboard', async () => {
    const api = seeded()
    renderWithApp({ ui: <AppView />, api, workspace: { selection: ['itm_a'] } })
    await screen.findByTestId('media-node-itm_a')
    fireEvent.keyDown(document.body, { key: 'Delete', code: 'Delete' })
    fireEvent.keyUp(document.body, { key: 'Delete', code: 'Delete' })
    await waitFor(() => {
      expect(item({ api, id: 'itm_a' })).toBeUndefined()
    })
  })

  it('plays videos and reports their size', async () => {
    const api = seeded()
    const { user } = renderWithApp({ ui: <AppView />, api, workspace: { selection: ['itm_v'] } })
    const node = await screen.findByTestId('media-node-itm_v')
    const video = within(node).getByTestId('video-element')
    Object.defineProperty(video, 'videoWidth', { value: 1920 })
    Object.defineProperty(video, 'videoHeight', { value: 1080 })
    Object.defineProperty(video, 'duration', { value: 12 })
    fireEvent.loadedMetadata(video)
    await waitFor(() => {
      expect(item({ api, id: 'itm_v' })?.media.width).toBe(1920)
    })
    await user.click(within(node).getByTestId('video-toggle'))
    expect(within(node).getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    await user.click(within(node).getByTestId('video-toggle'))
    await user.click(within(node).getByTestId('video-restart'))
    Object.defineProperty(video, 'currentTime', { value: 3, writable: true })
    fireEvent.timeUpdate(video)
    expect(within(node).getByText('0:03/0:12')).toBeInTheDocument()
    fireEvent.change(within(node).getByRole('slider'), { target: { value: '6' } })
  })
})

describe('Prompt cards', () => {
  it('creates a prompt from the context menu and queues it', async () => {
    const api = seeded()
    const { user } = renderWithApp({ ui: <AppView />, api })
    const copy = vi.spyOn(navigator.clipboard, 'writeText')
    await user.click(
      within(await openMenuOn(await screen.findByTestId('media-node-itm_a'))).getByTestId(
        'menu-generate-image',
      ),
    )
    const card = await screen.findByTestId(/^prompt-node-/)
    expect(within(card).getAllByTestId('prompt-reference')).toHaveLength(1)
    expect(api.state.generations[0]).toMatchObject({ status: 'draft', prompt: '@1' })
    expect(
      within(screen.getByTestId('media-node-itm_a')).getByTestId('reference-label'),
    ).toHaveTextContent('@1')

    const brief = within(card).getByTestId('prompt-brief')
    await user.clear(brief)
    await user.type(brief, 'Storm over @1 and @2')
    expect(within(card).getByTestId('prompt-dangling')).toHaveTextContent('@2 has no reference')
    expect(within(card).getByTestId('prompt-generate')).toHaveAttribute('data-disabled')
    await user.clear(brief)
    await user.type(brief, 'Storm over @1')
    fireEvent.blur(brief)
    await waitFor(() => {
      expect(api.state.generations[0]?.prompt).toBe('Storm over @1')
    })

    const settings = await screen.findByTestId(/^prompt-node-/)
    await user.click(within(settings).getByTestId('prompt-model'))
    await user.click(await screen.findByRole('option', { name: 'Nano Banana Pro' }))
    await waitFor(() => {
      expect(api.state.generations[0]?.model).toBe('nano_banana_pro')
    })
    await user.click(
      within(await screen.findByTestId(/^prompt-node-/)).getByTestId('prompt-aspect'),
    )
    await user.click(await screen.findByRole('option', { name: '16:9' }))
    await user.click(within(await screen.findByTestId(/^prompt-node-/)).getByTestId('prompt-count'))
    await user.click(await screen.findByRole('option', { name: '2×' }))
    await waitFor(() => {
      expect(api.state.generations[0]).toMatchObject({ aspectRatio: '16:9', count: 2 })
    })
    await user.click(within(await screen.findByTestId(/^prompt-node-/)).getByTestId('prompt-model'))
    await user.click(await screen.findByRole('option', { name: 'Auto' }))
    await user.click(
      within(await screen.findByTestId(/^prompt-node-/)).getByTestId('prompt-aspect'),
    )
    await user.click(await screen.findByRole('option', { name: 'Auto' }))
    await waitFor(() => {
      expect(api.state.generations[0]).toMatchObject({ model: null, aspectRatio: null })
    })

    await user.click(
      within(await screen.findByTestId(/^prompt-node-/)).getByTestId('prompt-generate'),
    )
    await waitFor(() => {
      expect(api.state.generations[0]?.status).toBe('pending')
    })
    expect(await screen.findByText('Queued for Claude Code')).toBeInTheDocument()
    expect(copy).toHaveBeenCalledWith(expect.stringContaining(api.state.generations[0]?.id ?? 'x'))
    const queued = await screen.findByTestId(/^prompt-node-/)
    await waitFor(() => {
      expect(queued).toHaveAttribute('data-status', 'pending')
    })
    await user.click(within(await screen.findByTestId(/^prompt-node-/)).getByTestId('prompt-copy'))
    expect(await screen.findByText('Instruction copied')).toBeInTheDocument()
  })

  it('switches kind, removes references and deletes prompts with undo', async () => {
    const api = createFakeApi({
      items: [makeItem({ id: 'itm_a' }), makeItem({ id: 'itm_b', position: { x: 400, y: 0 } })],
      generations: [
        makeGeneration({
          id: 'gen_1',
          status: 'draft',
          prompt: '@1 and @2',
          references: [
            { itemId: 'itm_a', label: '@1' },
            { itemId: 'itm_b', label: '@2' },
          ],
        }),
      ],
    })
    const { user } = renderWithApp({ ui: <AppView />, api })
    const card = await screen.findByTestId('prompt-node-gen_1')
    await user.click(within(card).getByTestId('prompt-kind-video'))
    await waitFor(() => {
      expect(api.state.generations[0]?.kind).toBe('video')
    })
    await user.click(
      within(await screen.findByTestId('prompt-node-gen_1')).getByLabelText('Remove @1'),
    )
    await waitFor(() => {
      expect(api.state.generations[0]).toMatchObject({
        prompt: 'and @1',
        references: [{ itemId: 'itm_b' }],
      })
    })
    await user.click(screen.getByTestId('undo'))
    await waitFor(() => {
      expect(api.state.generations[0]?.references).toHaveLength(2)
    })
    await user.click(
      within(await openMenuOn(await screen.findByTestId('prompt-node-gen_1'))).getByTestId(
        'menu-delete-prompt',
      ),
    )
    await waitFor(() => {
      expect(api.state.generations).toHaveLength(0)
    })
    await user.click(screen.getByTestId('undo'))
    await waitFor(() => {
      expect(api.state.generations).toHaveLength(1)
    })
  })

  it('creates an empty prompt from the canvas menu and undoes it', async () => {
    const api = seeded()
    const { user } = renderWithApp({ ui: <AppView />, api })
    await screen.findByTestId('media-node-itm_a')
    await user.click(within(await openMenuOn(pane())).getByTestId('menu-new-prompt'))
    expect(await screen.findByTestId(/^prompt-node-/)).toHaveTextContent('Drop images here')
    await user.click(screen.getByTestId('undo'))
    await waitFor(() => {
      expect(api.state.generations).toHaveLength(0)
    })
  })

  it('shows results, errors and toasts as requests progress', async () => {
    const api = createFakeApi({
      items: [makeItem({ id: 'itm_a' }), makeItem({ id: 'itm_r', position: { x: 900, y: 0 } })],
      generations: [
        makeGeneration({ id: 'gen_run', status: 'pending', aspectRatio: '16:9' }),
        makeGeneration({
          id: 'gen_bad',
          status: 'failed',
          error: 'Out of credits',
          position: { x: 0, y: 900 },
        }),
      ],
    })
    const { user, queryClient } = renderWithApp({ ui: <AppView />, api })
    const failed = await screen.findByTestId('prompt-node-gen_bad')
    expect(within(failed).getByTestId('prompt-error')).toHaveTextContent('Out of credits')
    await user.click(within(failed).getByTestId('prompt-retry'))
    await waitFor(() => {
      expect(api.state.generations.find((request) => request.id === 'gen_bad')?.status).toBe(
        'pending',
      )
    })
    api.state.generations = api.state.generations.map((request) =>
      request.id === 'gen_run'
        ? { ...request, status: 'completed', resultItemIds: ['itm_r'] }
        : request,
    )
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['generations'] })
    })
    expect(await screen.findByText('Generation finished')).toBeInTheDocument()
    const done = await screen.findByTestId('prompt-node-gen_run')
    await user.click(within(done).getByLabelText('Show results'))
  })

  it('reports failed submissions without queuing', async () => {
    const api = createFakeApi({
      generations: [makeGeneration({ id: 'gen_1', status: 'draft', prompt: 'x' })],
    })
    api.failNext({ method: 'POST', resource: 'generations', message: 'Nope' })
    const { user } = renderWithApp({ ui: <AppView />, api })
    await user.click(
      within(await screen.findByTestId('prompt-node-gen_1')).getByTestId('prompt-generate'),
    )
    expect(await screen.findByText('Could not queue the prompt')).toBeInTheDocument()
    expect(screen.queryByText('Queued for Claude Code')).not.toBeInTheDocument()
  })

  it('shows the instruction when the clipboard is blocked', async () => {
    const api = createFakeApi({
      generations: [makeGeneration({ id: 'gen_1', status: 'draft', prompt: 'x' })],
    })
    const { user } = renderWithApp({ ui: <AppView />, api })
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'))
    await user.click(
      within(await screen.findByTestId('prompt-node-gen_1')).getByTestId('prompt-generate'),
    )
    expect(await screen.findByText(/inspiratio-generate skill/)).toBeInTheDocument()
  })
})
