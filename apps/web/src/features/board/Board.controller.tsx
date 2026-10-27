import { gridSlot, type Vec2 } from '@inspiratio/shared'
import {
  applyNodeChanges,
  useReactFlow,
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
import { useWorkspace } from '../workspace/workspace.context.ts'
import { useBoardCommands, useBoardQuery } from './board.hooks.ts'
import { BoardView } from './Board.view.tsx'
import {
  actionTargets,
  backZIndex,
  detachChanges,
  frontZIndex,
  resolveContextTarget,
  type ContextTarget,
} from './domain/context-target.ts'
import { parseTransfer, snapshotTransfer, type DropPayload } from './domain/drop-data.ts'
import {
  applyReparenting,
  isMediaNode,
  isSectionNode,
  planPersistence,
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

export const Board = () => {
  const { board, isLoading } = useBoardQuery()
  const { state, dispatch } = useWorkspace()
  const commands = useBoardCommands()
  const flow = useReactFlow<BoardNode>()
  const [nodes, setNodes] = useState<BoardNode[]>([])
  const nodesRef = useRef<BoardNode[]>([])
  const [wrapper, setWrapper] = useState<HTMLDivElement | null>(null)
  const [menuTarget, setMenuTarget] = useState<ContextTarget>({
    kind: 'pane',
    position: { x: 0, y: 0 },
  })
  const [dropActive, setDropActive] = useState(false)
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
        filter: state.filter,
        references: state.composer.references,
        selection: state.selection,
        previous: nodesRef.current,
      }),
    )
  }, [board, state.filter, state.composer.references, state.selection, commitNodes])

  const persist = useCallback(
    (plan: PersistencePlan) => {
      if (plan.items.length > 0) void commands.applyLayout({ changes: plan.items })
      for (const section of plan.sections) {
        const { id, ...patch } = section
        void commands.updateSection({ id, patch })
      }
    },
    [commands],
  )

  const onNodesChange = useCallback(
    (changes: NodeChange<BoardNode>[]) => {
      const applied = applyNodeChanges(changes, nodesRef.current)
      const plan = planPersistence({ changes, nodes: applied })
      commitNodes(applyReparenting({ nodes: applied, changes: plan.items }))
      persist(plan)
    },
    [commitNodes, persist],
  )

  const onSelectionChange = useCallback(
    (selection: OnSelectionChangeParams<BoardNode>) => {
      // React Flow reports an empty selection before the board has loaded; keep the workspace one.
      if (nodesRef.current.length === 0) return
      const ids = selectedItemIds(selection.nodes)
      if (!sameIds({ left: ids, right: state.selection }))
        dispatch({ type: 'selectionChanged', itemIds: ids })
    },
    [dispatch, state.selection],
  )

  const onDelete = useCallback(
    (deleted: { readonly nodes: readonly BoardNode[] }) => {
      const itemIds = deleted.nodes.filter(isMediaNode).map((node) => node.id)
      for (const id of itemIds) void commands.deleteItem({ id })
      for (const node of deleted.nodes.filter(isSectionNode))
        void commands.deleteSection({ id: node.id })
      if (itemIds.length > 0) dispatch({ type: 'itemsDeleted', itemIds })
    },
    [commands, dispatch],
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
      if (payload.kind === 'files') {
        const created = await commands.uploadFiles({ files: payload.files, position })
        if (created !== undefined)
          notify({ title: `Added ${created.ids.length} reference(s)`, tone: 'success' })
      }
      if (payload.kind === 'urls') {
        for (const [index, url] of payload.urls.entries())
          await commands.importUrl({
            url,
            position: gridSlot({ origin: position, index }),
          })
      }
    },
    [commands],
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

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault()
      setDropActive(false)
      const payload = parseTransfer(snapshotTransfer(event.dataTransfer))
      void importPayload({
        payload,
        position: flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      })
    },
    [flow, importPayload],
  )

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setDropActive(true)
  }, [])

  const itemIds = useMemo(() => new Set(board.items.map((item) => item.id)), [board.items])
  const sectionIds = useMemo(
    () => new Set(board.sections.map((section) => section.id)),
    [board.sections],
  )

  const onContextMenu = useCallback(
    (event: MouseEvent) => {
      const target = resolveContextTarget({
        element: event.target instanceof Element ? event.target : null,
        position: flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
        itemIds,
        sectionIds,
      })
      setMenuTarget(target)
      if (target.kind !== 'pane' && !state.selection.includes(target.id))
        commitNodes(nodesRef.current.map((node) => ({ ...node, selected: node.id === target.id })))
    },
    [flow, itemIds, sectionIds, state.selection, commitNodes],
  )

  const targetIds =
    menuTarget.kind === 'item'
      ? actionTargets({ id: menuTarget.id, selection: state.selection })
      : []

  const menu = {
    target: menuTarget,
    targetCount: targetIds.length,
    targetInSection: targetIds.some(
      (id) => board.items.find((item) => item.id === id)?.sectionId !== null,
    ),
    onGenerate: (kind: 'image' | 'video') => {
      dispatch({ type: 'generateFromSelection', itemIds: targetIds, kind })
    },
    onAddToPrompt: () => {
      dispatch({ type: 'referencesAdded', itemIds: targetIds, caret: null })
    },
    onView: () => {
      if (menuTarget.kind === 'item') dispatch({ type: 'viewerOpened', itemId: menuTarget.id })
    },
    onFocus: () => {
      void flow.fitView({ nodes: targetIds.map((id) => ({ id })), duration: 400, padding: 0.2 })
    },
    onBringToFront: () => {
      for (const id of targetIds)
        void commands.updateItem({ id, patch: { zIndex: frontZIndex(board.items) } })
    },
    onSendToBack: () => {
      for (const id of targetIds)
        void commands.updateItem({ id, patch: { zIndex: backZIndex(board.items) } })
    },
    onDetach: () => {
      const changes = detachChanges({
        ids: targetIds,
        items: board.items,
        sections: board.sections,
      })
      if (changes.length > 0) void commands.applyLayout({ changes })
    },
    onDelete: () => {
      const ids = menuTarget.kind === 'section' ? [menuTarget.id] : targetIds
      void flow.deleteElements({ nodes: ids.map((id) => ({ id })) })
    },
    onAddSection: () => {
      void commands.createSection({ input: { position: menuTarget.position } })
    },
    onImportUrl: () => {
      setUrlDialog({ open: true, position: menuTarget.position })
    },
    onFitView: () => {
      void flow.fitView({ duration: 400, padding: 0.1 })
    },
    onSelectAll: () => {
      commitNodes(nodesRef.current.map((node) => ({ ...node, selected: isMediaNode(node) })))
    },
  }

  const viewerItem = board.items.find((item) => item.id === state.viewerItemId) ?? null

  return (
    <BoardView
      onWrapperElement={setWrapper}
      nodes={nodes}
      isEmpty={!isLoading && board.items.length === 0 && board.sections.length === 0}
      dropActive={dropActive}
      onNodesChange={onNodesChange}
      onSelectionChange={onSelectionChange}
      onDelete={onDelete}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={() => {
        setDropActive(false)
      }}
      onContextMenu={onContextMenu}
      menu={menu}
      viewerItem={viewerItem}
      onCloseViewer={() => {
        dispatch({ type: 'viewerClosed' })
      }}
      urlDialogOpen={urlDialog.open}
      onUrlDialogOpenChange={(open) => {
        setUrlDialog((current) => ({ ...current, open }))
      }}
      onImportUrl={(url) => {
        setUrlDialog((current) => ({ ...current, open: false }))
        void commands.importUrl({ url, position: urlDialog.position })
      }}
    />
  )
}

export type BoardMenu = {
  readonly target: ContextTarget
  readonly targetCount: number
  readonly targetInSection: boolean
  readonly onGenerate: (kind: 'image' | 'video') => void
  readonly onAddToPrompt: () => void
  readonly onView: () => void
  readonly onFocus: () => void
  readonly onBringToFront: () => void
  readonly onSendToBack: () => void
  readonly onDetach: () => void
  readonly onDelete: () => void
  readonly onAddSection: () => void
  readonly onImportUrl: () => void
  readonly onFitView: () => void
  readonly onSelectAll: () => void
}
