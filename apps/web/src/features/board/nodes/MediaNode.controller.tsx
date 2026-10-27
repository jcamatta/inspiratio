import type { NodeProps } from '@xyflow/react'
import { useState } from 'react'
import { useWorkspace } from '../../workspace/workspace.context.ts'
import { useBoardActions } from '../board.actions.ts'
import { useBoardCommands } from '../board.hooks.ts'
import type { MediaFlowNode } from '../domain/flow-mapping.ts'
import { MediaNodeView } from './MediaNode.view.tsx'

export const MediaNode = ({ id, data, selected }: NodeProps<MediaFlowNode>) => {
  const { state, dispatch } = useWorkspace()
  const actions = useBoardActions()
  const commands = useBoardCommands()
  const [draftTitle, setDraftTitle] = useState(data.item.title)
  const editingTitle = state.editing?.kind === 'title' && state.editing.id === id
  const editingTags = state.editing?.kind === 'tags' && state.editing.id === id

  const stopEditing = () => {
    dispatch({ type: 'editingStopped' })
  }

  return (
    <MediaNodeView
      data={data}
      selected={selected}
      editingTitle={editingTitle}
      editingTags={editingTags}
      draftTitle={draftTitle}
      onDraftTitleChange={setDraftTitle}
      onStartEditingTitle={() => {
        setDraftTitle(data.item.title)
        dispatch({ type: 'editingStarted', editing: { kind: 'title', id } })
      }}
      onCommitTitle={() => {
        stopEditing()
        actions.rename({ id, title: draftTitle.trim() })
      }}
      onCancelEditing={stopEditing}
      onStartEditingTags={() => {
        dispatch({ type: 'editingStarted', editing: { kind: 'tags', id } })
      }}
      onTagsChange={(tagIds) => {
        actions.setTags({ id, tagIds })
      }}
      onRemoveTag={(tagId) => {
        actions.setTags({ id, tagIds: data.item.tagIds.filter((candidate) => candidate !== tagId) })
      }}
      onDimensions={(size) => {
        void commands.reportDimensions({ id, ...size })
      }}
    />
  )
}
