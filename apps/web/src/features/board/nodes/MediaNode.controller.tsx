import { useReactFlow, type NodeProps } from '@xyflow/react'
import { useCallback, useState, type DragEvent } from 'react'
import { useWorkspace } from '../../workspace/workspace.context.ts'
import { useBoardCommands } from '../board.hooks.ts'
import { dragPayload, ITEM_DRAG_TYPE } from '../domain/drop-data.ts'
import type { MediaFlowNode } from '../domain/flow-mapping.ts'
import { MediaNodeView } from './MediaNode.view.tsx'

export const MediaNode = ({ id, data, selected, dragging }: NodeProps<MediaFlowNode>) => {
  const { state, dispatch } = useWorkspace()
  const commands = useBoardCommands()
  const flow = useReactFlow()
  const [editingTitle, setEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState(data.item.title)

  const startEditing = useCallback(() => {
    setDraftTitle(data.item.title)
    setEditingTitle(true)
  }, [data.item.title])

  const commitTitle = useCallback(() => {
    setEditingTitle(false)
    const title = draftTitle.trim()
    if (title !== '' && title !== data.item.title)
      void commands.updateItem({ id, patch: { title } })
  }, [commands, data.item.title, draftTitle, id])

  const onDragStart = useCallback(
    (event: DragEvent) => {
      event.dataTransfer.setData(
        ITEM_DRAG_TYPE,
        JSON.stringify(dragPayload({ id, selection: state.selection })),
      )
      event.dataTransfer.effectAllowed = 'copy'
    },
    [id, state.selection],
  )

  return (
    <MediaNodeView
      data={data}
      selected={selected}
      dragging={dragging}
      editingTitle={editingTitle}
      draftTitle={draftTitle}
      onDraftTitleChange={setDraftTitle}
      onStartEditing={startEditing}
      onCommitTitle={commitTitle}
      onCancelEditing={() => {
        setEditingTitle(false)
      }}
      onDragToPrompt={onDragStart}
      onAddToPrompt={() => {
        dispatch({
          type: 'referencesAdded',
          itemIds: dragPayload({ id, selection: state.selection }),
          caret: null,
        })
      }}
      onView={() => {
        dispatch({ type: 'viewerOpened', itemId: id })
      }}
      onFocus={() => {
        void flow.fitView({ nodes: [{ id }], duration: 400, padding: 0.2 })
      }}
      onDelete={() => {
        void flow.deleteElements({ nodes: [{ id }] })
      }}
      onDimensions={(size) => {
        void commands.reportDimensions({ id, ...size })
      }}
    />
  )
}
