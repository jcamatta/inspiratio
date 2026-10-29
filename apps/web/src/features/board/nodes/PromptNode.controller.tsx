import type { IdeaSuggestion, IdeaTurn } from '@inspiratio/shared'
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

/** A conversation with Claude about the idea: the brief it started from, the rounds, the latest take. */
export type IdeaSession = {
  readonly brief: string
  readonly history: readonly IdeaTurn[]
  readonly suggestion: IdeaSuggestion
}

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
  const [idea, setIdea] = useState<IdeaSession | null>(null)
  const [feedback, setFeedback] = useState('')
  const [developing, setDeveloping] = useState(false)
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

  /** Step one of three: Claude helps with the idea; the model-specific prompt comes later. */
  const askClaude = async (session: Omit<IdeaSession, 'suggestion'>) => {
    setDeveloping(true)
    const developed = await generations.developIdea({
      id: request.id,
      brief: session.brief,
      history: [...session.history],
    })
    setDeveloping(false)
    if (developed === undefined) return
    setIdea({ ...session, suggestion: developed })
    setFeedback('')
  }

  /** Another round: Claude revises its last take following what the user wants changed. */
  const refineIdea = async (session: IdeaSession) => {
    if (feedback.trim() === '') return
    await askClaude({
      brief: session.brief,
      history: [
        ...session.history,
        { suggestion: session.suggestion.brief, feedback: feedback.trim() },
      ],
    })
  }

  const applySuggestion = async (accepted: IdeaSuggestion) => {
    setIdea(null)
    setFeedback('')
    setBrief(accepted.brief)
    await generations.update({ id: request.id, patch: { prompt: accepted.brief } })
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
      idea={idea}
      feedback={feedback}
      onFeedbackChange={setFeedback}
      developing={developing}
      onDevelopIdea={() => {
        void askClaude({ brief: brief.trim(), history: [] })
      }}
      onRefineIdea={() => {
        if (idea !== null) void refineIdea(idea)
      }}
      onUseSuggestion={() => {
        if (idea !== null) void applySuggestion(idea.suggestion)
      }}
      onDismissSuggestion={() => {
        setIdea(null)
        setFeedback('')
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
