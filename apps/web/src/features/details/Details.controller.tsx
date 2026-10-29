import type { Item } from '@inspiratio/shared'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useCommand } from '../../shared/api/use-command.ts'
import { notify } from '../../shared/ui/index.ts'
import { useBoardCommands } from '../board/board.hooks.ts'
import { runDuration, stepRows } from '../generation/domain/steps.ts'
import { useGenerationsQuery } from '../generation/generation.hooks.ts'
import { mediaPathOf } from '../inspector/domain/metadata.ts'
import { settingsApi, STORAGE_QUERY_KEY } from '../settings/api/settings.api.ts'
import { copyItemImage } from './copy-image.ts'
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
  const storage = useQuery({ queryKey: [STORAGE_QUERY_KEY], queryFn: settingsApi.fetchStorage })
  const revealFile = useCommand({
    name: 'storage.reveal',
    call: settingsApi.revealFile,
    invalidate: [],
    errorTitle: 'Could not show the file',
  })
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
      filePath={
        storage.data === undefined
          ? null
          : mediaPathOf({ directory: storage.data.media, fileName: item.media.fileName })
      }
      onCopyPrompt={(prompt) => {
        void navigator.clipboard.writeText(prompt).then(() => {
          notify({ title: 'Prompt copied', tone: 'success' })
        })
      }}
      onRevealFile={() => void revealFile({ fileName: item.media.fileName })}
      onCopyImage={
        item.kind === 'image'
          ? () => {
              copyItemImage(item)
            }
          : null
      }
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
