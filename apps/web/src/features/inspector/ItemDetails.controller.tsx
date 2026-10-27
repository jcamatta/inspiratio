import type { Item } from '@inspiratio/shared'
import { useReactFlow } from '@xyflow/react'
import { useState } from 'react'
import { notify } from '../../shared/ui/index.ts'
import { useBoardCommands, useBoardQuery } from '../board/board.hooks.ts'
import { useWorkspace } from '../workspace/workspace.context.ts'
import { ItemDetailsView } from './ItemDetails.view.tsx'

/** Editing panel for a single reference: drafts live here and are committed on blur / Enter. */
export const ItemDetails = ({ item }: { readonly item: Item }) => {
  const { board } = useBoardQuery()
  const { dispatch } = useWorkspace()
  const commands = useBoardCommands()
  const flow = useReactFlow()
  const [title, setTitle] = useState(item.title)
  const [notes, setNotes] = useState(item.metadata.notes)

  const generation = item.metadata.generation
  const references =
    generation === null
      ? []
      : board.items.filter((candidate) => generation.referenceItemIds.includes(candidate.id))

  return (
    <ItemDetailsView
      item={item}
      tags={board.tags}
      references={references}
      title={title}
      onTitleChange={setTitle}
      onTitleCommit={() => {
        const trimmed = title.trim()
        if (trimmed !== '' && trimmed !== item.title)
          void commands.updateItem({ id: item.id, patch: { title: trimmed } })
      }}
      notes={notes}
      onNotesChange={setNotes}
      onNotesCommit={() => {
        if (notes !== item.metadata.notes)
          void commands.updateItem({ id: item.id, patch: { notes } })
      }}
      onTagsChange={(tagIds) => {
        void commands.setItemTags({ id: item.id, tagIds })
      }}
      onCopyPrompt={(prompt) => {
        void navigator.clipboard.writeText(prompt).then(() => {
          notify({ title: 'Prompt copied', tone: 'success' })
        })
      }}
      onFocusItem={(id) => {
        void flow.fitView({ nodes: [{ id }], duration: 400, padding: 0.3 })
      }}
      onView={() => {
        dispatch({ type: 'viewerOpened', itemId: item.id })
      }}
    />
  )
}
