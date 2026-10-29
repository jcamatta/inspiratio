import { gridSlot, type GenerationKind, type Vec2 } from '@inspiratio/shared'
import {
  applyNodeChanges,
  useReactFlow,
  useViewport,
  type NodeChange,
  type OnSelectionChangeParams,
} from '@xyflow/react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
} from 'react'
import { notify } from '../../shared/ui/index.ts'
import { copyItemImage } from '../details/copy-image.ts'
import { useGenerationNotifications, useGenerationsQuery } from '../generation/generation.hooks.ts'
import { useHistory } from '../history/history.context.ts'
import { useWorkspace } from '../workspace/workspace.context.ts'
import { useBoardActions } from './board.actions.ts'
import { useBoardCommands, useBoardQuery } from './board.hooks.ts'
import { BoardView, type BoardMenu, type SelectionToolbar } from './Board.view.tsx'
import {
  actionTargets,
  backZIndex,
  detachChanges,
  frontZIndex,
  promptPlacement,
  resolveContextTarget,
  type ContextTarget,
} from './domain/context-target.ts'
import { parseTransfer, snapshotTransfer, type DropPayload } from './domain/drop-data.ts'
import { dimOutside, lineageOf } from './domain/lineage.ts'
import {
  applyReparenting,
  deletableNodes,
  hoveredPrompt,
  isDragging,
  isMediaNode,
  isPromptNode,
  isSectionNode,
  planPersistence,
  revertPositions,
  selectedItemIds,
  toFlowNodes,
  type BoardNode,
  type PersistencePlan,
} from './domain/flow-mapping.ts'

const sameIds = (params: {
  readonly left: readonly string[]
  readonly right: readonly string[]
}): boolean =>
  params.left.length === params.right.length && params.left.every((id) => params.right.includes(id))

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

const hasWork = (plan: PersistencePlan): boolean =>
  plan.items.length + plan.sections.length + plan.prompts.length + plan.drops.length > 0

export const Board = () => {
  useGenerationNotifications()
  const { board, isLoading } = useBoardQuery()
  const { requests } = useGenerationsQuery()
  const { state, dispatch } = useWorkspace()
  const commands = useBoardCommands()
  const actions = useBoardActions()
  const history = useHistory()
  const flow = useReactFlow<BoardNode>()
  const { zoom } = useViewport()
  const [nodes, setNodes] = useState<BoardNode[]>([])
  const nodesRef = useRef<BoardNode[]>([])
  const [wrapper, setWrapper] = useState<HTMLDivElement | null>(null)
  const [menuTarget, setMenuTarget] = useState<ContextTarget>({
    kind: 'pane',
    position: { x: 0, y: 0 },
  })
  const [fileDropActive, setFileDropActive] = useState(false)
  const [urlDialog, setUrlDialog] = useState<{ readonly open: boolean; readonly position: Vec2 }>({
    open: false,
    position: { x: 0, y: 0 },
  })

  const commitNodes = useCallback((next: BoardNode[]) => {
    nodesRef.current = next
    setNodes(next)
  }, [])

  useEffect(() => {
    commitNodes(
      toFlowNodes({
        board,
        generations: requests,
        selection: state.selection,
        dropTargetId: state.dropTargetId,
        previous: nodesRef.current,
      }),
    )
  }, [board, requests, state.selection, state.dropTargetId, commitNodes])

  const onNodesChange = useCallback(
    (changes: NodeChange<BoardNode>[]) => {
      const applied = applyNodeChanges(changes, nodesRef.current)
      if (isDragging(changes))
        dispatch({
          type: 'dropTargetChanged',
          promptId: hoveredPrompt({ changes, nodes: applied }),
        })
      const plan = planPersistence({ changes, nodes: applied })
      const dropped = plan.drops.flatMap((drop) => drop.itemIds)
      const reverted = revertPositions({ nodes: applied, itemIds: dropped, items: board.items })
      commitNodes(applyReparenting({ nodes: reverted, changes: plan.items }))
      if (!hasWork(plan)) return
      dispatch({ type: 'dropTargetChanged', promptId: null })
      actions.persistPlan(plan)
    },
    [actions, board.items, commitNodes, dispatch],
  )

  const onSelectionChange = useCallback(
    (selection: OnSelectionChangeParams<BoardNode>) => {
      if (nodesRef.current.length === 0) return
      const ids = selectedItemIds(selection.nodes)
      if (!sameIds({ left: ids, right: state.selection }))
        dispatch({ type: 'selectionChanged', itemIds: ids })
    },
    [dispatch, state.selection],
  )

  const onDelete = useCallback(
    (deleted: { readonly nodes: readonly BoardNode[] }) => {
      const nodes = deletableNodes(deleted.nodes)
      const itemIds = nodes.filter(isMediaNode).map((node) => node.id)
      actions.deleteItems(itemIds)
      for (const node of nodes.filter(isSectionNode)) actions.deleteSection(node.id)
      for (const node of nodes.filter(isPromptNode)) actions.deletePrompt(node.id)
      if (itemIds.length > 0) dispatch({ type: 'itemsDeleted', itemIds })
    },
    [actions, dispatch],
  )

  const viewportCenter = useCallback((): Vec2 => {
    const rect = wrapper?.getBoundingClientRect()
    return flow.screenToFlowPosition({
      x: rect === undefined ? window.innerWidth / 2 : rect.left + rect.width / 2,
      y: rect === undefined ? window.innerHeight / 2 : rect.top + rect.height / 2,
    })
  }, [flow, wrapper])

  const importPayload = useCallback(
    async (params: { readonly payload: DropPayload; readonly position: Vec2 }) => {
      const { payload, position } = params
      const ids: string[] = []
      if (payload.kind === 'files') {
        const created = await commands.uploadFiles({ files: payload.files, position })
        ids.push(...(created?.ids ?? []))
      }
      if (payload.kind === 'urls') {
        for (const [index, url] of payload.urls.entries()) {
          const created = await commands.importUrl({
            url,
            position: gridSlot({ origin: position, index }),
          })
          if (created !== undefined) ids.push(created.id)
        }
      }
      if (ids.length > 0) {
        actions.recordImport(ids)
        notify({ title: `Added ${String(ids.length)} reference(s)`, tone: 'success' })
      }
    },
    [actions, commands],
  )

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (isTyping(event.target)) return
      const payload = parseTransfer(snapshotTransfer(event.clipboardData))
      if (payload.kind === 'none' || payload.kind === 'items') return
      event.preventDefault()
      void importPayload({ payload, position: viewportCenter() })
    }
    document.addEventListener('paste', onPaste)
    return () => {
      document.removeEventListener('paste', onPaste)
    }
  }, [importPayload, viewportCenter])

  const itemIds = useMemo(() => new Set(board.items.map((item) => item.id)), [board.items])
  const sectionIds = useMemo(
    () => new Set(board.sections.map((section) => section.id)),
    [board.sections],
  )
  const promptIds = useMemo(() => new Set(requests.map((request) => request.id)), [requests])
  const focusKey = nodes
    .filter((node) => node.selected === true && !isSectionNode(node))
    .map((node) => node.id)
    .join(' ')
  const lineage = useMemo(
    () =>
      lineageOf({
        focus: focusKey === '' ? [] : focusKey.split(' '),
        items: board.items,
        generations: requests,
      }),
    [focusKey, board.items, requests],
  )
  const shownNodes = useMemo(() => dimOutside({ nodes, lineage }), [nodes, lineage])

  const onContextMenu = useCallback(
    (event: MouseEvent) => {
      const target = resolveContextTarget({
        element: event.target instanceof Element ? event.target : null,
        position: flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
        itemIds,
        sectionIds,
        promptIds,
      })
      setMenuTarget(target)
      if (target.kind !== 'pane' && !state.selection.includes(target.id))
        commitNodes(nodesRef.current.map((node) => ({ ...node, selected: node.id === target.id })))
    },
    [flow, itemIds, sectionIds, promptIds, state.selection, commitNodes],
  )

  const targetIds =
    menuTarget.kind === 'item'
      ? actionTargets({ id: menuTarget.id, selection: state.selection })
      : []

  const generateFrom = (params: {
    readonly kind: GenerationKind
    readonly ids: readonly string[]
  }) => {
    actions.createPrompt({
      kind: params.kind,
      referenceItemIds: params.ids,
      position: promptPlacement({
        ids: params.ids,
        items: board.items,
        prompts: requests.map((request) => request.position),
        fallback: menuTarget.position,
      }),
    })
  }

  const dragging = nodes.some((node) => node.dragging === true)
  const toolbar: SelectionToolbar = {
    ids: dragging || state.editing !== null ? [] : state.selection,
    onGenerate: (kind) => {
      generateFrom({ kind, ids: state.selection })
    },
    onCreateSection: () => {
      actions.createSectionFrom(state.selection)
    },
    onView: () => {
      const [id] = state.selection
      if (id !== undefined) dispatch({ type: 'viewerOpened', itemId: id })
    },
    onDetails: () => {
      const [id] = state.selection
      if (id !== undefined) dispatch({ type: 'detailsOpened', itemId: id })
    },
    onDelete: () => {
      void flow.deleteElements({ nodes: state.selection.map((id) => ({ id })) })
    },
  }

  const menuImage =
    menuTarget.kind === 'item'
      ? board.items.find((item) => item.id === menuTarget.id && item.kind === 'image')
      : undefined
  const menu: BoardMenu = {
    target: menuTarget,
    targetCount: targetIds.length,
    targetInSection: targetIds.some(
      (id) => board.items.find((item) => item.id === id)?.sectionId !== null,
    ),
    onGenerate: (kind) => {
      generateFrom({ kind, ids: targetIds })
    },
    onCreateSection: () => {
      actions.createSectionFrom(targetIds)
    },
    onRename: () => {
      if (menuTarget.kind === 'item')
        dispatch({ type: 'editingStarted', editing: { kind: 'title', id: menuTarget.id } })
      if (menuTarget.kind === 'section')
        dispatch({ type: 'editingStarted', editing: { kind: 'section-title', id: menuTarget.id } })
    },
    onAddTags: () => {
      if (menuTarget.kind === 'item')
        dispatch({ type: 'editingStarted', editing: { kind: 'tags', id: menuTarget.id } })
    },
    onView: () => {
      if (menuTarget.kind === 'item') dispatch({ type: 'viewerOpened', itemId: menuTarget.id })
    },
    onDetails: () => {
      if (menuTarget.kind === 'item') dispatch({ type: 'detailsOpened', itemId: menuTarget.id })
    },
    onCopyImage: menuImage === undefined ? null : () => copyItemImage(menuImage),
    onBringToFront: () => {
      actions.setZIndex({ ids: targetIds, zIndex: frontZIndex(board.items) })
    },
    onSendToBack: () => {
      actions.setZIndex({ ids: targetIds, zIndex: backZIndex(board.items) })
    },
    onDetach: () => {
      actions.detach(
        detachChanges({ ids: targetIds, items: board.items, sections: board.sections }),
      )
    },
    onDelete: () => {
      const ids =
        menuTarget.kind === 'item' ? targetIds : menuTarget.kind === 'pane' ? [] : [menuTarget.id]
      void flow.deleteElements({ nodes: ids.map((id) => ({ id })) })
    },
    onNewPrompt: (kind) => {
      actions.createPrompt({ kind, referenceItemIds: [], position: menuTarget.position })
    },
    onAddSection: () => {
      actions.createSection(menuTarget.position)
    },
    onImportUrl: () => {
      setUrlDialog({ open: true, position: menuTarget.position })
    },
    onFitView: () => {
      void flow.fitView({ duration: 400, padding: 0.1 })
    },
    onSelectAll: () => {
      commitNodes(nodesRef.current.map((node) => ({ ...node, selected: isMediaNode(node) })))
      dispatch({ type: 'selectionChanged', itemIds: board.items.map((item) => item.id) })
    },
  }

  return (
    <BoardView
      onWrapperElement={setWrapper}
      nodes={shownNodes}
      edges={lineage.edges}
      isEmpty={
        !isLoading &&
        board.items.length === 0 &&
        board.sections.length === 0 &&
        requests.length === 0
      }
      fileDropActive={fileDropActive}
      onNodesChange={onNodesChange}
      onSelectionChange={onSelectionChange}
      onDelete={onDelete}
      onDrop={(event: DragEvent) => {
        event.preventDefault()
        setFileDropActive(false)
        void importPayload({
          payload: parseTransfer(snapshotTransfer(event.dataTransfer)),
          position: flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
        })
      }}
      onDragOver={(event: DragEvent) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        setFileDropActive(true)
      }}
      onDragLeave={() => {
        setFileDropActive(false)
      }}
      onContextMenu={onContextMenu}
      menu={menu}
      toolbar={toolbar}
      zoom={zoom}
      selectionCount={state.selection.length}
      canUndo={history.canUndo}
      canRedo={history.canRedo}
      onUndo={() => {
        void history.undo()
      }}
      onRedo={() => {
        void history.redo()
      }}
      onZoomIn={() => {
        void flow.zoomIn({ duration: 200 })
      }}
      onZoomOut={() => {
        void flow.zoomOut({ duration: 200 })
      }}
      onFitView={menu.onFitView}
      viewerItem={board.items.find((item) => item.id === state.viewerItemId) ?? null}
      onCloseViewer={() => {
        dispatch({ type: 'viewerClosed' })
      }}
      detailsItem={board.items.find((item) => item.id === state.detailsItemId) ?? null}
      onCloseDetails={() => {
        dispatch({ type: 'detailsClosed' })
      }}
      urlDialogOpen={urlDialog.open}
      onUrlDialogOpenChange={(open) => {
        setUrlDialog((current) => ({ ...current, open }))
      }}
      onImportUrl={(url) => {
        setUrlDialog((current) => ({ ...current, open: false }))
        void importPayload({ payload: { kind: 'urls', urls: [url] }, position: urlDialog.position })
      }}
    />
  )
}
