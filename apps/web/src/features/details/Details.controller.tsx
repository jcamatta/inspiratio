import type { Item } from '@inspiratio/shared'
import { useState } from 'react'
import { notify } from '../../shared/ui/index.ts'
import { useBoardCommands } from '../board/board.hooks.ts'
import { runDuration, stepRows } from '../generation/domain/steps.ts'
import { useGenerationsQuery } from '../generation/generation.hooks.ts'
import { DetailsView } from './Details.view.tsx'

const DetailsContent = ({
  item,
  onClose,
}: {
  readonly item: Item
  readonly onClose: () => void
}) => {
  const commands = useBoardCommands()
  const { requests } = useGenerationsQuery()
  const [notes, setNotes] = useState(item.metadata.notes)
  const [now] = useState(() => Date.now())
  const requestId = item.metadata.generation?.requestId
  const request = requests.find((candidate) => candidate.id === requestId)
  return (
    <DetailsView
      item={item}
      steps={
        request === undefined || request.steps.length === 0
          ? null
          : { rows: stepRows({ steps: request.steps, now }), total: runDuration(request) }
      }
      notes={notes}
      onNotesChange={setNotes}
      onNotesCommit={() => {
        if (notes !== item.metadata.notes)
          void commands.updateItem({ id: item.id, patch: { notes } })
      }}
      onCopyPrompt={(prompt) => {
        void navigator.clipboard.writeText(prompt).then(() => {
          notify({ title: 'Prompt copied', tone: 'success' })
        })
      }}
      onClose={onClose}
    />
  )
}

export const Details = ({
  item,
  onClose,
}: {
  readonly item: Item | null
  readonly onClose: () => void
}) => (item === null ? null : <DetailsContent key={item.id} item={item} onClose={onClose} />)
