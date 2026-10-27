import type { GenerationKind } from '@inspiratio/shared'
import { EMPTY_FILTER, type ItemFilter } from '../../board/domain/flow-mapping.ts'
import { AUTO_MODEL, dropReferences, removeReference } from '../../generation/domain/prompt.ts'

export type PanelTab = 'inspector' | 'generate' | 'queue'

export type Composer = {
  readonly prompt: string
  readonly references: readonly string[]
  readonly kind: GenerationKind
  readonly model: string
  readonly aspectRatio: string
  readonly count: number
}

/** Client-only UI state shared by the canvas, the inspector and the prompt composer. */
export type WorkspaceState = {
  readonly selection: readonly string[]
  readonly filter: ItemFilter
  readonly panelTab: PanelTab
  readonly panelOpen: boolean
  readonly viewerItemId: string | null
  readonly composer: Composer
}

export const EMPTY_COMPOSER: Composer = {
  prompt: '',
  references: [],
  kind: 'image',
  model: AUTO_MODEL,
  aspectRatio: 'auto',
  count: 1,
}

export const initialWorkspace: WorkspaceState = {
  selection: [],
  filter: EMPTY_FILTER,
  panelTab: 'inspector',
  panelOpen: true,
  viewerItemId: null,
  composer: EMPTY_COMPOSER,
}

export type WorkspaceAction =
  | { readonly type: 'selectionChanged'; readonly itemIds: readonly string[] }
  | { readonly type: 'filterChanged'; readonly filter: ItemFilter }
  | { readonly type: 'panelTabChanged'; readonly tab: PanelTab }
  | { readonly type: 'panelToggled' }
  | { readonly type: 'viewerOpened'; readonly itemId: string }
  | { readonly type: 'viewerClosed' }
  | { readonly type: 'promptChanged'; readonly prompt: string }
  | {
      readonly type: 'referencesAdded'
      readonly itemIds: readonly string[]
      readonly caret: number | null
    }
  | { readonly type: 'referenceRemoved'; readonly itemId: string }
  | {
      readonly type: 'composerSettingsChanged'
      readonly settings: Partial<Omit<Composer, 'prompt' | 'references'>>
    }
  | { readonly type: 'composerReset' }
  | { readonly type: 'itemsDeleted'; readonly itemIds: readonly string[] }
  | {
      readonly type: 'generateFromSelection'
      readonly itemIds: readonly string[]
      readonly kind: GenerationKind
    }

const withComposer = (params: {
  readonly state: WorkspaceState
  readonly composer: Composer
}): WorkspaceState => ({
  ...params.state,
  composer: params.composer,
})

/** Pure reducer: (state, action) packed in one param object to honour the single-param rule. */
export const reduceWorkspace = (params: {
  readonly state: WorkspaceState
  readonly action: WorkspaceAction
}): WorkspaceState => {
  const { state, action } = params
  switch (action.type) {
    case 'selectionChanged':
      return { ...state, selection: action.itemIds }
    case 'filterChanged':
      return { ...state, filter: action.filter }
    case 'panelTabChanged':
      return { ...state, panelTab: action.tab, panelOpen: true }
    case 'panelToggled':
      return { ...state, panelOpen: !state.panelOpen }
    case 'viewerOpened':
      return { ...state, viewerItemId: action.itemId }
    case 'viewerClosed':
      return { ...state, viewerItemId: null }
    case 'promptChanged':
      return withComposer({ state, composer: { ...state.composer, prompt: action.prompt } })
    case 'referencesAdded': {
      const next = dropReferences({
        prompt: state.composer.prompt,
        references: state.composer.references,
        itemIds: action.itemIds,
        caret: action.caret,
      })
      return {
        ...withComposer({ state, composer: { ...state.composer, ...next } }),
        panelTab: 'generate',
        panelOpen: true,
      }
    }
    case 'referenceRemoved':
      return withComposer({
        state,
        composer: {
          ...state.composer,
          ...removeReference({
            prompt: state.composer.prompt,
            references: state.composer.references,
            itemId: action.itemId,
          }),
        },
      })
    case 'composerSettingsChanged':
      return withComposer({ state, composer: { ...state.composer, ...action.settings } })
    case 'composerReset':
      return withComposer({
        state,
        composer: { ...EMPTY_COMPOSER, kind: state.composer.kind, model: state.composer.model },
      })
    case 'itemsDeleted': {
      const deleted = new Set(action.itemIds)
      let composer = state.composer
      for (const itemId of state.composer.references.filter((id) => deleted.has(id)).reverse()) {
        composer = {
          ...composer,
          ...removeReference({ prompt: composer.prompt, references: composer.references, itemId }),
        }
      }
      return {
        ...state,
        composer,
        selection: state.selection.filter((id) => !deleted.has(id)),
        viewerItemId:
          state.viewerItemId !== null && deleted.has(state.viewerItemId)
            ? null
            : state.viewerItemId,
      }
    }
    case 'generateFromSelection': {
      const next = dropReferences({
        prompt: '',
        references: [],
        itemIds: action.itemIds,
        caret: null,
      })
      return {
        ...state,
        panelTab: 'generate',
        panelOpen: true,
        composer: {
          ...state.composer,
          ...next,
          kind: action.kind,
          model: state.composer.kind === action.kind ? state.composer.model : AUTO_MODEL,
        },
      }
    }
  }
}
