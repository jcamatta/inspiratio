import { useReactFlow } from '@xyflow/react'
import { useCallback } from 'react'
import { notify } from '../../shared/ui/index.ts'
import { useBoardQuery } from '../board/board.hooks.ts'
import { claudeInstruction } from './domain/prompt.ts'
import { useGenerationCommands, useGenerationsQuery } from './generation.hooks.ts'
import { QueueView } from './Queue.view.tsx'

export const Queue = () => {
  const { requests } = useGenerationsQuery()
  const { board } = useBoardQuery()
  const commands = useGenerationCommands()
  const flow = useReactFlow()

  const copyInstruction = useCallback(async (id: string) => {
    await navigator.clipboard.writeText(claudeInstruction(id))
    notify({
      title: 'Instruction copied',
      description: 'Paste it in Claude Code.',
      tone: 'success',
    })
  }, [])

  return (
    <QueueView
      requests={requests}
      items={board.items}
      onCopyInstruction={(id) => {
        void copyInstruction(id)
      }}
      onRetry={(id) => {
        void commands.retry({ id })
      }}
      onRemove={(id) => {
        void commands.remove({ id })
      }}
      onFocusItems={(ids) => {
        void flow.fitView({ nodes: ids.map((id) => ({ id })), duration: 500, padding: 0.3 })
      }}
    />
  )
}
