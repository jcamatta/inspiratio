export type Editing =
  | { readonly kind: 'title'; readonly id: string }
  | { readonly kind: 'tags'; readonly id: string }
  | { readonly kind: 'section-title'; readonly id: string }

/** Client-only UI state of the canvas. */
export type WorkspaceState = {
  readonly selection: readonly string[]
  readonly editing: Editing | null
  readonly viewerItemId: string | null
  readonly detailsItemId: string | null
  /** Prompt card currently under a dragged image. */
  readonly dropTargetId: string | null
}

export const initialWorkspace: WorkspaceState = {
  selection: [],
  editing: null,
  viewerItemId: null,
  detailsItemId: null,
  dropTargetId: null,
}

export type WorkspaceAction =
  | { readonly type: 'selectionChanged'; readonly itemIds: readonly string[] }
  | { readonly type: 'editingStarted'; readonly editing: Editing }
  | { readonly type: 'editingStopped' }
  | { readonly type: 'viewerOpened'; readonly itemId: string }
  | { readonly type: 'viewerClosed' }
  | { readonly type: 'detailsOpened'; readonly itemId: string }
  | { readonly type: 'detailsClosed' }
  | { readonly type: 'dropTargetChanged'; readonly promptId: string | null }
  | { readonly type: 'itemsDeleted'; readonly itemIds: readonly string[] }

const keepEditing = (params: {
  readonly editing: Editing | null
  readonly selection: readonly string[]
}): Editing | null =>
  params.editing !== null && params.selection.includes(params.editing.id) ? params.editing : null

export const reduceWorkspace = (params: {
  readonly state: WorkspaceState
  readonly action: WorkspaceAction
}): WorkspaceState => {
  const { state, action } = params
  switch (action.type) {
    case 'selectionChanged':
      return {
        ...state,
        selection: action.itemIds,
        editing:
          state.editing?.kind === 'section-title'
            ? state.editing
            : keepEditing({ editing: state.editing, selection: action.itemIds }),
      }
    case 'editingStarted':
      return { ...state, editing: action.editing }
    case 'editingStopped':
      return { ...state, editing: null }
    case 'viewerOpened':
      return { ...state, viewerItemId: action.itemId }
    case 'viewerClosed':
      return { ...state, viewerItemId: null }
    case 'detailsOpened':
      return { ...state, detailsItemId: action.itemId }
    case 'detailsClosed':
      return { ...state, detailsItemId: null }
    case 'dropTargetChanged':
      return state.dropTargetId === action.promptId
        ? state
        : { ...state, dropTargetId: action.promptId }
    case 'itemsDeleted': {
      const deleted = new Set(action.itemIds)
      const gone = (id: string | null) => (id !== null && deleted.has(id) ? null : id)
      return {
        ...state,
        selection: state.selection.filter((id) => !deleted.has(id)),
        editing: state.editing !== null && deleted.has(state.editing.id) ? null : state.editing,
        viewerItemId: gone(state.viewerItemId),
        detailsItemId: gone(state.detailsItemId),
      }
    }
  }
}
