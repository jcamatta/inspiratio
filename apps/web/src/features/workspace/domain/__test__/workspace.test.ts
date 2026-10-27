import { describe, expect, it } from 'vitest'
import { createQueryClient } from '../../../../app/query-client.ts'
import {
  emptyHistory,
  historyShortcut,
  MAX_HISTORY,
  recordEntry,
  stepBack,
  stepForward,
  type HistoryEntry,
  type ShortcutKey,
} from '../../../history/domain/history.ts'
import { IDENTITY, panBy, toCss, wheelFactor, zoomAt } from '../../../viewer/domain/zoom.ts'
import {
  initialWorkspace,
  reduceWorkspace,
  type WorkspaceAction,
  type WorkspaceState,
} from '../workspace.ts'

const runFrom = (params: {
  readonly start: WorkspaceState
  readonly actions: readonly WorkspaceAction[]
}): WorkspaceState => {
  let state = params.start
  for (const action of params.actions) state = reduceWorkspace({ state, action })
  return state
}

const run = (actions: readonly WorkspaceAction[]): WorkspaceState =>
  runFrom({ start: initialWorkspace, actions })

describe('workspace reducer', () => {
  it('tracks selection, viewer, details and drop target', () => {
    const state = run([
      { type: 'selectionChanged', itemIds: ['a'] },
      { type: 'viewerOpened', itemId: 'a' },
      { type: 'detailsOpened', itemId: 'a' },
      { type: 'dropTargetChanged', promptId: 'gen_1' },
    ])
    expect(state).toMatchObject({
      selection: ['a'],
      viewerItemId: 'a',
      detailsItemId: 'a',
      dropTargetId: 'gen_1',
    })
    expect(
      runFrom({ start: state, actions: [{ type: 'dropTargetChanged', promptId: 'gen_1' }] }),
    ).toBe(state)
    expect(
      runFrom({ start: state, actions: [{ type: 'viewerClosed' }, { type: 'detailsClosed' }] }),
    ).toMatchObject({ viewerItemId: null, detailsItemId: null })
  })

  it('keeps editing only while the edited item stays selected', () => {
    const editing = run([
      { type: 'selectionChanged', itemIds: ['a'] },
      { type: 'editingStarted', editing: { kind: 'tags', id: 'a' } },
    ])
    expect(
      runFrom({ start: editing, actions: [{ type: 'selectionChanged', itemIds: ['a', 'b'] }] })
        .editing,
    ).toEqual({ kind: 'tags', id: 'a' })
    expect(
      runFrom({ start: editing, actions: [{ type: 'selectionChanged', itemIds: ['b'] }] }).editing,
    ).toBeNull()
    const section = run([
      { type: 'editingStarted', editing: { kind: 'section-title', id: 's' } },
      { type: 'selectionChanged', itemIds: [] },
    ])
    expect(section.editing).toEqual({ kind: 'section-title', id: 's' })
    expect(runFrom({ start: section, actions: [{ type: 'editingStopped' }] }).editing).toBeNull()
  })

  it('cleans state when items are deleted', () => {
    const start = run([
      { type: 'selectionChanged', itemIds: ['a', 'b'] },
      { type: 'editingStarted', editing: { kind: 'title', id: 'a' } },
      { type: 'viewerOpened', itemId: 'a' },
      { type: 'detailsOpened', itemId: 'b' },
    ])
    expect(
      runFrom({ start, actions: [{ type: 'itemsDeleted', itemIds: ['a', 'b'] }] }),
    ).toMatchObject({ selection: [], editing: null, viewerItemId: null, detailsItemId: null })
    expect(runFrom({ start, actions: [{ type: 'itemsDeleted', itemIds: ['z'] }] })).toMatchObject({
      viewerItemId: 'a',
      editing: { kind: 'title', id: 'a' },
    })
  })
})

describe('history', () => {
  const entry = (label: string): HistoryEntry => ({
    label,
    undo: () => Promise.resolve(),
    redo: () => Promise.resolve(),
  })

  it('records, steps back and forward', () => {
    const recorded = recordEntry({
      history: recordEntry({ history: emptyHistory, entry: entry('a') }),
      entry: entry('b'),
    })
    const back = stepBack(recorded)
    expect(back.entry?.label).toBe('b')
    expect(back.history.future.map((item) => item.label)).toEqual(['b'])
    expect(stepForward(back.history).entry?.label).toBe('b')
    expect(stepBack(emptyHistory).entry).toBeNull()
    expect(stepForward(emptyHistory).entry).toBeNull()
    expect(recordEntry({ history: back.history, entry: entry('c') }).future).toEqual([])
  })

  it('caps the history length', () => {
    let history = emptyHistory
    for (let index = 0; index < MAX_HISTORY + 5; index += 1)
      history = recordEntry({ history, entry: entry(String(index)) })
    expect(history.past).toHaveLength(MAX_HISTORY)
  })

  it('maps keyboard shortcuts', () => {
    const key = (overrides: Partial<ShortcutKey>): ShortcutKey => ({
      key: 'z',
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      ...overrides,
    })
    expect(historyShortcut(key({}))).toBe('undo')
    expect(historyShortcut(key({ shiftKey: true, key: 'Z' }))).toBe('redo')
    expect(historyShortcut(key({ key: 'y' }))).toBe('redo')
    expect(historyShortcut(key({ ctrlKey: false, metaKey: true }))).toBe('undo')
    expect(historyShortcut(key({ ctrlKey: false }))).toBeNull()
    expect(historyShortcut(key({ key: 'a' }))).toBeNull()
  })
})

describe('viewer zoom', () => {
  it('zooms around a point, clamps and pans', () => {
    const zoomed = zoomAt({ view: IDENTITY, factor: 2, point: { x: 100, y: 50 } })
    expect(zoomed).toEqual({ scale: 2, x: -100, y: -50 })
    expect(zoomAt({ view: IDENTITY, factor: 1000, point: { x: 0, y: 0 } }).scale).toBe(20)
    expect(zoomAt({ view: IDENTITY, factor: 0.001, point: { x: 0, y: 0 } }).scale).toBe(0.2)
    expect(panBy({ view: zoomed, delta: { x: 10, y: 5 } })).toEqual({ scale: 2, x: -90, y: -45 })
    expect(wheelFactor(-100)).toBeGreaterThan(1)
    expect(toCss(zoomed)).toBe('translate(-100px, -50px) scale(2)')
  })
})

describe('query client', () => {
  it('is configured for a local app', () => {
    expect(createQueryClient().getDefaultOptions().queries?.retry).toBe(1)
  })
})
