import { describe, expect, it } from 'vitest'
import { createQueryClient } from '../../../../app/query-client.ts'
import {
  EMPTY_COMPOSER,
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
  it('tracks selection, filters, panel and viewer', () => {
    const state = run([
      { type: 'selectionChanged', itemIds: ['a'] },
      { type: 'filterChanged', filter: { text: 'x', tagIds: [] } },
      { type: 'panelToggled' },
      { type: 'panelTabChanged', tab: 'queue' },
      { type: 'viewerOpened', itemId: 'a' },
    ])
    expect(state).toMatchObject({
      selection: ['a'],
      filter: { text: 'x' },
      panelTab: 'queue',
      panelOpen: true,
      viewerItemId: 'a',
    })
    expect(runFrom({ start: state, actions: [{ type: 'viewerClosed' }] }).viewerItemId).toBeNull()
  })

  it('adds references with prompt tokens and removes them with renumbering', () => {
    const added = run([
      { type: 'promptChanged', prompt: 'Shot like' },
      { type: 'referencesAdded', itemIds: ['a', 'b'], caret: null },
    ])
    expect(added.composer).toMatchObject({ prompt: 'Shot like @1 @2 ', references: ['a', 'b'] })
    expect(added.panelTab).toBe('generate')
    const removed = runFrom({ start: added, actions: [{ type: 'referenceRemoved', itemId: 'a' }] })
    expect(removed.composer).toMatchObject({ prompt: 'Shot like @1', references: ['b'] })
  })

  it('updates settings and resets the composer keeping kind and model', () => {
    const state = run([
      { type: 'composerSettingsChanged', settings: { kind: 'video', model: 'kling3_0', count: 2 } },
      { type: 'promptChanged', prompt: 'x' },
      { type: 'composerReset' },
    ])
    expect(state.composer).toEqual({ ...EMPTY_COMPOSER, kind: 'video', model: 'kling3_0' })
  })

  it('cleans references, selection and viewer when items are deleted', () => {
    const start = run([
      { type: 'referencesAdded', itemIds: ['a', 'b', 'c'], caret: null },
      { type: 'selectionChanged', itemIds: ['a', 'c'] },
      { type: 'viewerOpened', itemId: 'c' },
    ])
    const state = runFrom({
      start: start,
      actions: [{ type: 'itemsDeleted', itemIds: ['a', 'c'] }],
    })
    expect(state.composer.references).toEqual(['b'])
    expect(state.composer.prompt).toBe('@1')
    expect(state.selection).toEqual([])
    expect(state.viewerItemId).toBeNull()
    expect(
      runFrom({ start: start, actions: [{ type: 'itemsDeleted', itemIds: ['zz'] }] }).viewerItemId,
    ).toBe('c')
  })

  it('starts a fresh composer from a selection', () => {
    const state = run([
      { type: 'composerSettingsChanged', settings: { model: 'nano_banana_pro' } },
      { type: 'generateFromSelection', itemIds: ['x', 'y'], kind: 'image' },
    ])
    expect(state.composer).toMatchObject({
      prompt: '@1 @2 ',
      references: ['x', 'y'],
      kind: 'image',
      model: 'nano_banana_pro',
    })
    const video = runFrom({
      start: state,
      actions: [{ type: 'generateFromSelection', itemIds: ['x'], kind: 'video' }],
    })
    expect(video.composer).toMatchObject({ kind: 'video', model: 'auto' })
  })
})

describe('query client', () => {
  it('is configured for a local app', () => {
    expect(createQueryClient().getDefaultOptions().queries?.retry).toBe(1)
  })
})
