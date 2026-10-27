import {
  MAX_REFERENCES,
  mediaUrlOf,
  type GenerationKind,
  type GenerationStatus,
  type Item,
} from '@inspiratio/shared'
import { ClipboardCopy, Film, GripHorizontal, Image, RotateCw, Sparkles, X } from 'lucide-react'
import { cx } from '../../../shared/lib/cx.ts'
import {
  Box,
  Button,
  IconButton,
  MediaImage,
  Panel,
  Segmented,
  Select,
  Stack,
  Text,
  TextArea,
} from '../../../shared/ui/index.ts'
import { ASPECT_RATIOS, labelOf, type ModelOption } from '../../generation/domain/prompt.ts'
import type { PromptNodeData } from '../domain/flow-mapping.ts'
import type { PromptSettings } from './PromptNode.controller.tsx'

export type PromptNodeViewProps = {
  readonly data: PromptNodeData
  readonly selected: boolean
  readonly brief: string
  readonly onBriefChange: (brief: string) => void
  readonly onBriefCommit: () => void
  readonly models: readonly ModelOption[]
  readonly model: string
  readonly dangling: readonly string[]
  readonly canGenerate: boolean
  readonly onSettingsChange: (settings: PromptSettings) => void
  readonly onRemoveReference: (itemId: string) => void
  readonly onGenerate: () => void
  readonly onCopyInstruction: () => void
  readonly onRetry: () => void
  readonly onFocusItems: (ids: string[]) => void
}

const STATUS: Readonly<
  Record<GenerationStatus, { readonly label: string; readonly tone: string }>
> = {
  draft: { label: 'Draft', tone: 'bg-tag-slate text-tag-slate-fg' },
  pending: { label: 'Waiting for Claude', tone: 'bg-tag-amber text-tag-amber-fg' },
  in_progress: { label: 'Generating…', tone: 'bg-tag-sky text-tag-sky-fg animate-pulse' },
  completed: { label: 'Done', tone: 'bg-tag-mint text-tag-mint-fg' },
  failed: { label: 'Failed', tone: 'bg-danger-surface text-danger' },
}

const KIND_OPTIONS = [
  { value: 'image' as const, label: 'Image', icon: Image },
  { value: 'video' as const, label: 'Video', icon: Film },
]

const COUNT_OPTIONS = [1, 2, 3, 4].map((count) => ({
  value: String(count),
  label: `${String(count)}×`,
}))

const ASPECT_OPTIONS = ASPECT_RATIOS.map((ratio) => ({
  value: ratio,
  label: ratio === 'auto' ? 'Auto' : ratio,
}))

const Thumb = ({
  item,
  label,
  onRemove,
}: {
  readonly item: Item
  readonly label?: string
  readonly onRemove?: () => void
}) => (
  <Box
    className="group relative size-14 shrink-0 overflow-hidden rounded-lg bg-surface ring-1 ring-mint-950/5"
    testId="prompt-reference"
  >
    {item.kind === 'image' ? (
      <MediaImage src={mediaUrlOf(item.media)} alt={item.title} />
    ) : (
      <Stack align="center" justify="center" className="size-full">
        <Film size={16} className="text-muted-foreground" />
      </Stack>
    )}
    {label !== undefined && (
      <Text className="absolute bottom-0.5 left-0.5 rounded bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
        {label}
      </Text>
    )}
    {onRemove !== undefined && (
      <Box className="absolute top-0.5 right-0.5 opacity-0 transition group-hover:opacity-100">
        <IconButton
          icon={X}
          label={`Remove ${label ?? item.title}`}
          size="sm"
          variant="secondary"
          className="size-5"
          onClick={onRemove}
        />
      </Box>
    )}
  </Box>
)

export const PromptNodeView = (props: PromptNodeViewProps) => {
  const { request, references, results, dropActive } = props.data
  const isDraft = request.status === 'draft'
  const status = STATUS[request.status]
  return (
    <Panel
      testId={`prompt-node-${request.id}`}
      data-status={request.status}
      className={cx(
        'flex w-full flex-col gap-3 p-3 transition-shadow',
        props.selected && 'outline-3 outline-offset-3 outline-mint-700',
        dropActive && 'outline-3 outline-offset-3 outline-accent',
      )}
    >
      <Stack
        direction="row"
        align="center"
        justify="between"
        className="prompt-drag-handle cursor-grab"
      >
        <Stack direction="row" align="center" gap={2}>
          <GripHorizontal size={14} className="text-muted-foreground" />
          <Sparkles size={14} className="text-accent" />
          <Text variant="title">Prompt</Text>
        </Stack>
        <Text
          className={cx('rounded-full px-2 py-0.5 text-[11px] font-medium', status.tone)}
          testId="prompt-status"
        >
          {status.label}
        </Text>
      </Stack>

      {isDraft && (
        <Segmented<GenerationKind>
          value={request.kind}
          onValueChange={(kind) => props.onSettingsChange({ kind })}
          options={KIND_OPTIONS}
          testId="prompt-kind"
        />
      )}

      <Box
        testId="prompt-dropzone"
        className={cx(
          'flex min-h-16 flex-wrap gap-2 rounded-xl border border-dashed p-2 transition',
          dropActive ? 'border-accent bg-coral-50' : 'border-border-strong',
        )}
      >
        {references.length === 0 ? (
          <Text variant="caption" className="m-auto">
            Drop images here
          </Text>
        ) : (
          [...references.entries()].map(([index, item]) => (
            <Thumb
              key={item.id}
              item={item}
              label={labelOf(index)}
              {...(isDraft ? { onRemove: () => props.onRemoveReference(item.id) } : {})}
            />
          ))
        )}
        {isDraft && references.length > 0 && (
          <Text variant="caption" className="self-end">
            {references.length}/{MAX_REFERENCES}
          </Text>
        )}
      </Box>

      {isDraft ? (
        <>
          <Stack gap={1}>
            <TextArea
              label="Brief"
              value={props.brief}
              onValueChange={props.onBriefChange}
              onBlur={props.onBriefCommit}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && props.canGenerate)
                  props.onGenerate()
              }}
              placeholder="Describe the shot, use @1, @2…"
              className="nodrag"
              testId="prompt-brief"
            />
            {props.dangling.length > 0 && (
              <Text variant="caption" className="text-danger" testId="prompt-dangling">
                {props.dangling.join(', ')} {props.dangling.length === 1 ? 'has' : 'have'} no
                reference
              </Text>
            )}
          </Stack>
          <Box className="nodrag grid grid-cols-3 gap-2">
            <Select
              label="Model"
              value={props.model}
              options={props.models}
              onValueChange={(model) => props.onSettingsChange({ model })}
              testId="prompt-model"
            />
            <Select
              label="Aspect"
              value={request.aspectRatio ?? 'auto'}
              options={ASPECT_OPTIONS}
              onValueChange={(aspectRatio) => props.onSettingsChange({ aspectRatio })}
              testId="prompt-aspect"
            />
            <Select
              label="Variants"
              value={String(request.count)}
              options={COUNT_OPTIONS}
              onValueChange={(count) => props.onSettingsChange({ count: Number(count) })}
              testId="prompt-count"
            />
          </Box>
          <Button
            variant="primary"
            icon={Sparkles}
            disabled={!props.canGenerate}
            onClick={props.onGenerate}
            className="nodrag"
            testId="prompt-generate"
          >
            Generate
          </Button>
        </>
      ) : (
        <>
          <Text variant="body" className="line-clamp-4 whitespace-pre-wrap" testId="prompt-text">
            {request.prompt}
          </Text>
          <Text variant="caption">
            {request.kind} · {request.model ?? 'auto'}
            {request.aspectRatio === null ? '' : ` · ${request.aspectRatio}`}
          </Text>
          {request.error !== null && (
            <Text variant="caption" className="text-danger" testId="prompt-error">
              {request.error}
            </Text>
          )}
          {results.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="nodrag h-auto justify-start p-0"
              onClick={() => props.onFocusItems(results.map((item) => item.id))}
              aria-label="Show results"
            >
              <Stack direction="row" gap={1} wrap>
                {results.map((item) => (
                  <Thumb key={item.id} item={item} />
                ))}
              </Stack>
            </Button>
          )}
          <Stack direction="row" gap={2} className="nodrag">
            {(request.status === 'pending' || request.status === 'in_progress') && (
              <Button
                size="sm"
                icon={ClipboardCopy}
                onClick={props.onCopyInstruction}
                testId="prompt-copy"
              >
                Copy instruction
              </Button>
            )}
            {request.status === 'failed' && (
              <Button size="sm" icon={RotateCw} onClick={props.onRetry} testId="prompt-retry">
                Retry
              </Button>
            )}
          </Stack>
        </>
      )}
    </Panel>
  )
}
