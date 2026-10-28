import { useReactFlow, type NodeProps } from '@xyflow/react'
import { useEffect, useState } from 'react'
import { notify } from '../../../shared/ui/index.ts'
import {
  AUTO_ASPECT,
  cardModelOf,
  claudeInstruction,
  danglingTokens,
  decodeSetting,
  formatElapsed,
  isStalled,
  modelChangePatch,
} from '../../generation/domain/prompt.ts'
import { currentStep, runDuration } from '../../generation/domain/steps.ts'
import { isActive, useGenerationCommands } from '../../generation/generation.hooks.ts'
import { useBoardActions } from '../board.actions.ts'
import type { PromptFlowNode, PromptNodeData } from '../domain/flow-mapping.ts'
import { PromptNodeView } from './PromptNode.view.tsx'

export type PromptSettings = {
  readonly model?: string
  readonly aspectRatio?: string
  readonly count?: number
  /** A model setting changed on the card: its Higgsfield param and the chosen value as listed. */
  readonly option?: { readonly key: string; readonly value: string }
}

const copyInstruction = async (id: string): Promise<boolean> =>
  navigator.clipboard.writeText(claudeInstruction(id)).then(
    () => true,
    () => false,
  )

const PromptCard = ({
  data,
  selected,
}: {
  readonly data: PromptNodeData
  readonly selected: boolean
}) => {
  const { request } = data
  const generations = useGenerationCommands()
  const actions = useBoardActions()
  const flow = useReactFlow()
  const [brief, setBrief] = useState(request.prompt)
  const [synced, setSynced] = useState(request.prompt)
  if (synced !== request.prompt) {
    setSynced(request.prompt)
    setBrief(request.prompt)
  }
  const active = isActive(request)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => {
      clearInterval(timer)
    }
  }, [active])

  const saveBrief = async () => {
    if (brief.trim() !== request.prompt)
      await generations.update({ id: request.id, patch: { prompt: brief.trim() } })
  }

  const generate = async () => {
    await saveBrief()
    const submitted = await generations.submit({ id: request.id })
    if (submitted === undefined) return
    const copied = await copyInstruction(request.id)
    notify({
      title: 'Queued for Claude Code',
      description: copied
        ? 'Instruction copied, paste it in Claude Code'
        : claudeInstruction(request.id),
      tone: 'success',
    })
  }

  const dangling = danglingTokens({ prompt: brief, referenceCount: data.references.length })
  const model = cardModelOf(request)

  const patchOf = (settings: PromptSettings) => {
    const setting = model.settings.find((candidate) => candidate.key === settings.option?.key)
    return {
      ...(settings.model === undefined
        ? {}
        : modelChangePatch({ aspectRatio: request.aspectRatio, model: settings.model })),
      ...(settings.aspectRatio === undefined
        ? {}
        : { aspectRatio: settings.aspectRatio === AUTO_ASPECT ? null : settings.aspectRatio }),
      ...(settings.count === undefined ? {} : { count: settings.count }),
      ...(setting === undefined || settings.option === undefined
        ? {}
        : {
            options: {
              ...request.options,
              [setting.key]: decodeSetting({ setting, value: settings.option.value }),
            },
          }),
    }
  }

  return (
    <PromptNodeView
      data={data}
      selected={selected}
      brief={brief}
      onBriefChange={setBrief}
      onBriefCommit={() => {
        void saveBrief()
      }}
      model={model}
      dangling={dangling}
      stalled={isStalled({ request, now })}
      onCancel={() => {
        void generations.cancel({ id: request.id })
      }}
      elapsed={
        active ? formatElapsed(now - Date.parse(request.queuedAt ?? request.updatedAt)) : null
      }
      step={currentStep(request)?.label ?? null}
      duration={active ? null : runDuration(request)}
      canGenerate={brief.trim() !== '' && dangling.length === 0}
      onSettingsChange={(settings: PromptSettings) => {
        void generations.update({ id: request.id, patch: patchOf(settings) })
      }}
      onRemoveReference={(itemId) => {
        actions.removePromptReference({ promptId: request.id, itemId })
      }}
      onGenerate={() => {
        void generate()
      }}
      onCopyInstruction={() => {
        void copyInstruction(request.id).then(() => {
          notify({ title: 'Instruction copied', tone: 'success' })
        })
      }}
      onRetry={() => {
        void generations.retry({ id: request.id })
      }}
      onFocusItems={(ids) => {
        void flow.fitView({ nodes: ids.map((id) => ({ id })), duration: 400, padding: 0.3 })
      }}
    />
  )
}

export const PromptNode = ({ data, selected }: NodeProps<PromptFlowNode>) => (
  <PromptCard key={data.request.id} data={data} selected={selected} />
)
