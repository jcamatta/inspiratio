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

  it('resolves items, sections and the pane', () => {
    expect(
      resolveContextTarget({
        element: host.querySelector('#inner'),
        position,
        itemIds,
        sectionIds,
      }),
    ).toEqual({ kind: 'item', id: 'itm_a', position })
    expect(
      resolveContextTarget({
        element: host.querySelector('[data-id=sec_1]'),
        position,
        itemIds,
        sectionIds,
      }),
    ).toEqual({ kind: 'section', id: 'sec_1', position })
    expect(
      resolveContextTarget({ element: host.querySelector('#pane'), position, itemIds, sectionIds }),
    ).toEqual({ kind: 'pane', position })
    expect(resolveContextTarget({ element: null, position, itemIds, sectionIds }).kind).toBe('pane')
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

describe('formatTime', () => {
  it('formats seconds as m:ss', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(75.9)).toBe('1:15')
    expect(formatTime(Number.NaN)).toBe('0:00')
  })
})
