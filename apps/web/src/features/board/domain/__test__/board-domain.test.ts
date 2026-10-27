import { describe, expect, it } from 'vitest'
import { makeItem, makeSection } from '../../../../__test__/fake-api.ts'
import {
  actionTargets,
  backZIndex,
  detachChanges,
  frontZIndex,
  resolveContextTarget,
} from '../context-target.ts'
import {
  dragPayload,
  extractMediaSources,
  isImportableUrl,
  ITEM_DRAG_TYPE,
  parseItemIds,
  parseTransfer,
  parseUriList,
  snapshotTransfer,
  unwrapRedirect,
  type TransferSnapshot,
} from '../drop-data.ts'
import { formatTime } from '../time.ts'

const snapshot = (overrides: Partial<TransferSnapshot>): TransferSnapshot => ({
  files: [],
  uriList: '',
  html: '',
  text: '',
  items: '',
  ...overrides,
})

describe('drop data', () => {
  it('prefers internal items, then media files', () => {
    expect(parseTransfer(snapshot({ items: '["a","b"]', text: 'https://x' }))).toEqual({
      kind: 'items',
      itemIds: ['a', 'b'],
    })
    const png = new File(['x'], 'a.png', { type: 'image/png' })
    const txt = new File(['x'], 'a.txt', { type: 'text/plain' })
    expect(parseTransfer(snapshot({ files: [png, txt] }))).toEqual({ kind: 'files', files: [png] })
  })

  it('extracts page media before links and unwraps redirects', () => {
    const html =
      '<a href="x"><img alt="" src="https://img.example/a.jpg?w=1&amp;h=2"></a><video src="relative.mp4">'
    expect(parseTransfer(snapshot({ html, uriList: 'https://page.example' }))).toEqual({
      kind: 'urls',
      urls: ['https://img.example/a.jpg?w=1&h=2'],
    })
    const google =
      'https://www.google.com/imgres?imgurl=https%3A%2F%2Fcdn.example%2Fstill.jpg&imgrefurl=x'
    expect(
      parseTransfer(snapshot({ uriList: `# comment\n${google}\r\nnot a url`, text: google })),
    ).toEqual({
      kind: 'urls',
      urls: ['https://cdn.example/still.jpg'],
    })
    expect(parseTransfer(snapshot({ text: 'just words' }))).toEqual({ kind: 'none' })
  })

  it('parses helpers defensively', () => {
    expect(unwrapRedirect('nope')).toBe('nope')
    expect(unwrapRedirect('https://x.dev/?url=javascript:alert(1)')).toBe(
      'https://x.dev/?url=javascript:alert(1)',
    )
    expect(extractMediaSources('<img src="data:image/png;base64,xx">')).toEqual([])
    expect(parseUriList('ftp://x\nhttps://ok.dev')).toEqual(['https://ok.dev'])
    expect(parseItemIds('{bad')).toEqual([])
    expect(parseItemIds('{"a":1}')).toEqual([])
    expect(parseItemIds('["a",2]')).toEqual(['a'])
    expect(isImportableUrl(' https://x.dev ')).toBe(true)
    expect(isImportableUrl('mailto:x')).toBe(false)
    expect(isImportableUrl('')).toBe(false)
  })

  it('snapshots DataTransfer objects', () => {
    const data: Record<string, string> = { 'text/plain': 'hello', [ITEM_DRAG_TYPE]: '["a"]' }
    const transfer = {
      files: [],
      getData: (type: string) => data[type] ?? '',
    } as unknown as DataTransfer
    expect(snapshotTransfer(transfer)).toEqual({
      files: [],
      uriList: '',
      html: '',
      text: 'hello',
      items: '["a"]',
    })
    expect(snapshotTransfer(null)).toEqual(snapshot({}))
  })

  it('drags the whole selection when the dragged item is part of it', () => {
    expect(dragPayload({ id: 'a', selection: ['a', 'b'] })).toEqual(['a', 'b'])
    expect(dragPayload({ id: 'c', selection: ['a'] })).toEqual(['c'])
  })
})

describe('context targets', () => {
  const host = document.createElement('div')
  host.innerHTML =
    '<div class="react-flow__node" data-id="itm_a"><span id="inner"></span></div><div class="react-flow__node" data-id="sec_1"></div><div id="pane"></div>'
  const position = { x: 1, y: 2 }
  const itemIds = new Set(['itm_a'])
  const sectionIds = new Set(['sec_1'])
  const promptIds = new Set(['gen_1'])

  it('resolves items, sections and the pane', () => {
    expect(
      resolveContextTarget({
        element: host.querySelector('#inner'),
        position,
        itemIds,
        sectionIds,
        promptIds,
      }),
    ).toEqual({ kind: 'item', id: 'itm_a', position })
    expect(
      resolveContextTarget({
        element: host.querySelector('[data-id=sec_1]'),
        position,
        itemIds,
        sectionIds,
        promptIds,
      }),
    ).toEqual({ kind: 'section', id: 'sec_1', position })
    expect(
      resolveContextTarget({
        element: host.querySelector('#pane'),
        position,
        itemIds,
        sectionIds,
        promptIds,
      }),
    ).toEqual({ kind: 'pane', position })
    expect(
      resolveContextTarget({ element: null, position, itemIds, sectionIds, promptIds }).kind,
    ).toBe('pane')
  })

  it('computes targets, z-order and detach changes', () => {
    expect(actionTargets({ id: 'a', selection: ['a', 'b'] })).toEqual(['a', 'b'])
    expect(actionTargets({ id: 'c', selection: ['a'] })).toEqual(['c'])
    const items = [
      makeItem({ id: 'a', zIndex: 3, sectionId: 'sec_1', position: { x: 1, y: 1 } }),
      makeItem({ id: 'b', zIndex: -2 }),
    ]
    expect(frontZIndex(items)).toBe(4)
    expect(backZIndex(items)).toBe(-3)
    const sections = [makeSection({ id: 'sec_1', position: { x: 10, y: 10 } })]
    expect(detachChanges({ ids: ['a', 'b', 'zz'], items, sections })).toEqual([
      { id: 'a', sectionId: null, position: { x: 11, y: 11 } },
    ])
  })
})

describe('sectionAround', () => {
  it('wraps the items with padding and places them inside', async () => {
    const { sectionAround, SECTION_PADDING, CAPTION_ROOM } = await import('../context-target.ts')
    const sections = [makeSection({ id: 'sec_1', position: { x: 1000, y: 1000 } })]
    const items = [
      makeItem({ id: 'a', position: { x: 100, y: 200 }, size: { width: 300, height: 200 } }),
      makeItem({
        id: 'b',
        sectionId: 'sec_1',
        position: { x: 10, y: 10 },
        size: { width: 100, height: 100 },
      }),
      makeItem({ id: 'c', position: { x: 5000, y: 5000 } }),
    ]
    expect(sectionAround({ ids: ['a', 'b'], items, sections })).toEqual({
      position: { x: 100 - SECTION_PADDING, y: 200 - SECTION_PADDING },
      size: { width: 1010 + 2 * SECTION_PADDING, height: 910 + 2 * SECTION_PADDING + CAPTION_ROOM },
      members: [
        { id: 'a', position: { x: SECTION_PADDING, y: SECTION_PADDING } },
        { id: 'b', position: { x: 910 + SECTION_PADDING, y: 810 + SECTION_PADDING } },
      ],
    })
    expect(sectionAround({ ids: ['ghost'], items, sections })).toBeNull()
  })
})

describe('formatTime', () => {
  it('formats seconds as m:ss', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(75.9)).toBe('1:15')
    expect(formatTime(Number.NaN)).toBe('0:00')
  })
})

describe('prompt placement and targets', () => {
  it('resolves prompt cards and places new ones next to their references', async () => {
    const { promptPlacement, resolveContextTarget: resolve } = await import('../context-target.ts')
    const host = document.createElement('div')
    host.innerHTML = '<div class="react-flow__node" data-id="gen_1"><span id="in"></span></div>'
    expect(
      resolve({
        element: host.querySelector('#in'),
        position: { x: 0, y: 0 },
        itemIds: new Set(),
        sectionIds: new Set(),
        promptIds: new Set(['gen_1']),
      }),
    ).toEqual({ kind: 'prompt', id: 'gen_1', position: { x: 0, y: 0 } })
    const items = [
      makeItem({ id: 'a', position: { x: 0, y: 30 } }),
      makeItem({ id: 'b', position: { x: 400, y: 10 } }),
      makeItem({ id: 'c', sectionId: 's' }),
    ]
    expect(
      promptPlacement({ ids: ['a', 'b'], items, prompts: [], fallback: { x: 1, y: 1 } }),
    ).toEqual({ x: 768, y: 10 })
    expect(
      promptPlacement({ ids: ['a'], items, prompts: [{ x: 800, y: 0 }], fallback: { x: 1, y: 1 } }),
    ).toEqual({ x: 1188, y: 30 })
    expect(
      promptPlacement({ ids: ['c'], items, prompts: [], fallback: { x: 5000, y: 1 } }),
    ).toEqual({ x: 5000, y: 1 })
  })
})
