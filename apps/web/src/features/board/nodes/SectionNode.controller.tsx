import type { NodeProps } from '@xyflow/react'
import { useState } from 'react'
import { useWorkspace } from '../../workspace/workspace.context.ts'
import { useBoardActions } from '../board.actions.ts'
import type { SectionFlowNode } from '../domain/flow-mapping.ts'
import { SectionNodeView } from './SectionNode.view.tsx'

export const SectionNode = ({ id, data, selected }: NodeProps<SectionFlowNode>) => {
  const { state, dispatch } = useWorkspace()
  const actions = useBoardActions()
  const [draft, setDraft] = useState(data.section.title)
  const editing = state.editing?.kind === 'section-title' && state.editing.id === id

  return (
    <SectionNodeView
      data={data}
      selected={selected}
      editing={editing}
      draft={draft}
      onDraftChange={setDraft}
      onStartEditing={() => {
        setDraft(data.section.title)
        dispatch({ type: 'editingStarted', editing: { kind: 'section-title', id } })
      }}
      onCommit={() => {
        dispatch({ type: 'editingStopped' })
        actions.renameSection({ id, title: draft.trim() })
      }}
      onCancel={() => {
        dispatch({ type: 'editingStopped' })
      }}
    />
  )
}
