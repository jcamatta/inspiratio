import type { NodeProps } from '@xyflow/react'
import { useCallback, useState } from 'react'
import { useBoardCommands } from '../board.hooks.ts'
import type { SectionFlowNode } from '../domain/flow-mapping.ts'
import { SectionNodeView } from './SectionNode.view.tsx'

export const SectionNode = ({ id, data, selected }: NodeProps<SectionFlowNode>) => {
  const commands = useBoardCommands()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.section.title)

  const commit = useCallback(() => {
    setEditing(false)
    const title = draft.trim()
    if (title !== '' && title !== data.section.title)
      void commands.updateSection({ id, patch: { title } })
  }, [commands, data.section.title, draft, id])

  return (
    <SectionNodeView
      data={data}
      selected={selected}
      editing={editing}
      draft={draft}
      onDraftChange={setDraft}
      onStartEditing={() => {
        setDraft(data.section.title)
        setEditing(true)
      }}
      onCommit={commit}
      onCancel={() => {
        setEditing(false)
      }}
    />
  )
}
