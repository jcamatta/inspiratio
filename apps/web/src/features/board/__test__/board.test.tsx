import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppView } from '../../../app/App.view.tsx'
import { createFakeApi, makeItem, makeSection, makeTag } from '../../../__test__/fake-api.ts'
import { renderWithApp } from '../../../__test__/render.tsx'
import { ITEM_DRAG_TYPE } from '../domain/drop-data.ts'

const api = () =>
  createFakeApi({
    items: [
      makeItem({ id: 'itm_a', title: 'Neon alley', zIndex: 2 }),
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
        tagIds: ['t_ai', 't1', 't2', 't3', 't4'],
      }),
    ],
    tags: [
      makeTag({ id: 't_ai', name: 'ai-generated', system: true }),
      ...['t1', 't2', 't3', 't4'].map((id) => makeTag({ id, name: id })),
    ],
    sections: [makeSection({ id: 'sec_1', title: 'Act I', position: { x: 100, y: 100 } })],
  })

/** DataTransfer double; `data` is shared so tests can read what a drag handler wrote. */
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
  setData: (...[type, value]: [string, string]) => {
    Object.assign(data, { [type]: value })
  },
  dropEffect: 'none',
  effectAllowed: 'all',
})

const openMenuOn = async (element: Element) => {
  fireEvent.contextMenu(element, { clientX: 10, clientY: 10 })
  return screen.findByTestId('context-menu')
}

describe('Board interactions', () => {
  it('offers item actions in the context menu', async () => {
    const fake = api()
    const { user } = renderWithApp({ ui: <AppView />, api: fake })
    const node = await screen.findByTestId('media-node-itm_a')

    await user.click(within(await openMenuOn(node)).getByTestId('menu-front'))
    await waitFor(() => {
      expect(fake.state.items.find((item) => item.id === 'itm_a')?.zIndex).toBe(3)
    })
    await user.click(within(await openMenuOn(node)).getByTestId('menu-back'))
    await waitFor(() => {
      expect(fake.state.items.find((item) => item.id === 'itm_a')?.zIndex).toBeLessThan(0)
    })
    await user.click(within(await openMenuOn(node)).getByTestId('menu-focus'))
    await user.click(within(await openMenuOn(node)).getByTestId('menu-view'))
    expect(await screen.findByTestId('viewer')).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await user.click(within(await openMenuOn(node)).getByTestId('menu-add-to-prompt'))
    expect(await screen.findAllByTestId('composer-reference')).toHaveLength(1)
    await user.click(within(await openMenuOn(node)).getByTestId('menu-generate-video'))
    expect(screen.getByTestId('composer-kind-video')).toHaveAttribute('data-pressed')

    await user.click(within(await openMenuOn(node)).getByTestId('menu-delete'))
    await waitFor(() => {
      expect(fake.state.items.some((item) => item.id === 'itm_a')).toBe(false)
    })
  })

  it('detaches items from sections and deletes sections', async () => {
    const fake = api()
    const { user } = renderWithApp({ ui: <AppView />, api: fake })
    const child = await screen.findByTestId('media-node-itm_b')
    await user.click(within(await openMenuOn(child)).getByTestId('menu-detach'))
    await waitFor(() => {
      expect(fake.state.items.find((item) => item.id === 'itm_b')).toMatchObject({
        sectionId: null,
        position: { x: 105, y: 105 },
      })
    })
    await user.click(
      within(await openMenuOn(screen.getByTestId('section-node-sec_1'))).getByTestId(
        'menu-delete-section',
      ),
    )
    await waitFor(() => {
      expect(fake.state.sections).toHaveLength(0)
    })
  })

  it('offers pane actions in the context menu', async () => {
    const fake = api()
    const { user } = renderWithApp({ ui: <AppView />, api: fake })
    await screen.findByTestId('media-node-itm_a')
    const pane = document.querySelector('.react-flow__pane') ?? screen.getByTestId('board')
    await user.click(within(await openMenuOn(pane)).getByTestId('menu-add-section'))
    await waitFor(() => {
      expect(fake.state.sections).toHaveLength(2)
    })
    await user.click(within(await openMenuOn(pane)).getByTestId('menu-select-all'))
    expect(await screen.findByTestId('inspector-multi')).toHaveTextContent('3 references selected')
    await user.click(within(await openMenuOn(pane)).getByTestId('menu-fit'))
    await user.click(within(await openMenuOn(pane)).getByTestId('menu-import-url'))
    const dialog = await screen.findByTestId('url-dialog')
    await user.type(within(dialog).getByTestId('url-input'), 'https://www.pinterest.com/pin/1')
    await user.click(within(dialog).getByTestId('url-submit'))
    await waitFor(() => {
      expect(fake.state.items).toHaveLength(4)
    })
  })

  it('imports files and links dropped on the canvas', async () => {
    const fake = api()
    renderWithApp({ ui: <AppView />, api: fake })
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
      expect(fake.state.items).toHaveLength(4)
    })
    fireEvent.drop(board, {
      dataTransfer: transfer({
        data: { 'text/uri-list': 'https://a.dev/1.jpg\nhttps://a.dev/2.jpg' },
      }),
    })
    await waitFor(() => {
      expect(fake.state.items).toHaveLength(6)
    })
    fireEvent.drop(board, { dataTransfer: transfer({ data: { [ITEM_DRAG_TYPE]: '["itm_a"]' } }) })
    expect(fake.state.items).toHaveLength(6)
  })

  it('imports pasted images but ignores pastes into text fields', async () => {
    const fake = api()
    renderWithApp({ ui: <AppView />, api: fake })
    await screen.findByTestId('media-node-itm_a')
    const paste = (params: {
      readonly target: EventTarget
      readonly data: ReturnType<typeof transfer>
    }) => {
      const event = new Event('paste', { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'clipboardData', { value: params.data })
      act(() => {
        params.target.dispatchEvent(event)
      })
    }
    paste({
      target: document.body,
      data: transfer({ data: { 'text/plain': 'https://cosmos.so/e/9' } }),
    })
    await waitFor(() => {
      expect(fake.state.items).toHaveLength(4)
    })
    paste({
      target: screen.getByTestId('filter-text'),
      data: transfer({ data: { 'text/plain': 'https://x.dev/y.png' } }),
    })
    paste({ target: document.body, data: transfer({ data: { 'text/plain': 'hello' } }) })
    expect(fake.state.items).toHaveLength(4)
  })

  it('deletes the selected nodes with the keyboard', async () => {
    const fake = api()
    renderWithApp({ ui: <AppView />, api: fake, workspace: { selection: ['itm_a'] } })
    await screen.findByTestId('media-node-itm_a')
    fireEvent.keyDown(document.body, { key: 'Delete', code: 'Delete' })
    fireEvent.keyUp(document.body, { key: 'Delete', code: 'Delete' })
    await waitFor(() => {
      expect(fake.state.items.some((item) => item.id === 'itm_a')).toBe(false)
    })
  })
})

describe('Media node', () => {
  it('renames through the caption and exposes toolbar actions', async () => {
    const fake = api()
    const { user } = renderWithApp({
      ui: <AppView />,
      api: fake,
      workspace: { selection: ['itm_a'] },
    })
    const node = await screen.findByTestId('media-node-itm_a')
    fireEvent.doubleClick(within(node).getByTestId('node-title'))
    const input = within(node).getByTestId('node-title-input')
    await user.clear(input)
    await user.type(input, 'Night market{Enter}')
    await waitFor(() => {
      expect(fake.state.items.find((item) => item.id === 'itm_a')?.title).toBe('Night market')
    })
    fireEvent.doubleClick(
      await within(screen.getByTestId('media-node-itm_a')).findByTestId('node-title'),
    )
    await user.keyboard('{Escape}')
    expect(
      within(screen.getByTestId('media-node-itm_a')).getByTestId('node-title'),
    ).toBeInTheDocument()

    const data: Record<string, string> = {}
    fireEvent.dragStart(await screen.findByTestId('node-drag-to-prompt'), {
      dataTransfer: transfer({ data }),
    })
    expect(data[ITEM_DRAG_TYPE]).toBe('["itm_a"]')

    await user.click(screen.getByTestId('node-add-to-prompt'))
    expect(await screen.findAllByTestId('composer-reference')).toHaveLength(1)
    await user.click(screen.getByTestId('node-focus'))
    await user.click(screen.getByTestId('node-view'))
    expect(await screen.findByTestId('viewer')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await user.click(screen.getByTestId('node-delete'))
    await waitFor(() => {
      expect(fake.state.items.some((item) => item.id === 'itm_a')).toBe(false)
    })
  })

  it('plays videos, reports their size and shows overflow tags', async () => {
    const fake = api()
    const { user } = renderWithApp({
      ui: <AppView />,
      api: fake,
      workspace: { selection: ['itm_v'] },
    })
    const node = await screen.findByTestId('media-node-itm_v')
    expect(within(node).getByText('+1')).toBeInTheDocument()
    const video = within(node).getByTestId('video-element')
    Object.defineProperty(video, 'videoWidth', { value: 1920 })
    Object.defineProperty(video, 'videoHeight', { value: 1080 })
    Object.defineProperty(video, 'duration', { value: 12 })
    fireEvent.loadedMetadata(video)
    await waitFor(() => {
      expect(fake.state.items.find((item) => item.id === 'itm_v')?.media.width).toBe(1920)
    })
    await user.click(within(node).getByTestId('video-toggle'))
    expect(within(node).getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    await user.click(within(node).getByTestId('video-toggle'))
    await user.click(within(node).getByTestId('video-restart'))
    Object.defineProperty(video, 'currentTime', { value: 3, writable: true })
    fireEvent.timeUpdate(video)
    expect(within(node).getByText('0:03/0:12')).toBeInTheDocument()
    within(node).getByTestId('video-seek').focus()
    await user.keyboard('{ArrowRight}')
  })
})

describe('Section node', () => {
  it('renames sections from their title', async () => {
    const fake = api()
    const { user } = renderWithApp({ ui: <AppView />, api: fake })
    const section = await screen.findByTestId('section-node-sec_1')
    fireEvent.doubleClick(within(section).getByTestId('section-title'))
    const input = within(section).getByTestId('section-title-input')
    await user.clear(input)
    await user.type(input, 'Act II{Enter}')
    await waitFor(() => {
      expect(fake.state.sections[0]?.title).toBe('Act II')
    })
    fireEvent.doubleClick(
      await within(screen.getByTestId('section-node-sec_1')).findByTestId('section-title'),
    )
    await user.keyboard('{Escape}')
    expect(
      within(screen.getByTestId('section-node-sec_1')).getByTestId('section-title'),
    ).toBeInTheDocument()
  })
})
