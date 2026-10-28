import {
  MAX_REFERENCES,
  mediaUrlOf,
  resolveOptions,
  type GenerationKind,
  type GenerationStatus,
  type Item,
  type ModelSetting,
  type ModelSpec,
} from '@inspiratio/shared'
import { NodeResizer } from '@xyflow/react'
import { LineageHandles } from './LineageHandles.tsx'
import {
  ClipboardCopy,
  Clock,
  Copy,
  Film,
  Gauge,
  Gem,
  Layers,
  Scan,
  Sparkles,
  SquareDashed,
  Volume2,
  VolumeX,
  WandSparkles,
  type LucideIcon,
  GripHorizontal,
  Image,
  CircleStop,
  LoaderCircle,
  RotateCw,
  Timer,
  TriangleAlert,
  Bot,
  X,
} from 'lucide-react'
import { cx } from '../../../shared/lib/cx.ts'
import {
  Box,
  Button,
  ChipSelect,
  IconButton,
  MediaImage,
  Panel,
  ToggleChip,
  Stack,
  Text,
  TextArea,
} from '../../../shared/ui/index.ts'
import {
  aspectChoicesOf,
  AUTO_ASPECT,
  encodeSetting,
  labelOf,
  modelChoicesOf,
  settingChoicesOf,
  settingsSummaryOf,
} from '../../generation/domain/prompt.ts'
import type { PromptNodeData } from '../domain/flow-mapping.ts'
import type { PromptSettings } from './PromptNode.controller.tsx'

export type PromptNodeViewProps = {
  readonly data: PromptNodeData
  readonly selected: boolean
  readonly brief: string
  readonly onBriefChange: (brief: string) => void
  readonly onBriefCommit: () => void
  readonly model: ModelSpec
  readonly dangling: readonly string[]
  readonly elapsed: string | null
  readonly step: string | null
  readonly duration: string | null
  readonly stalled: boolean
  readonly onCancel: () => void
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

/** Image and video prompts are separate cards: their own title, icon, colour and drop hint. */
const KIND: Readonly<
  Record<
    GenerationKind,
    {
      readonly title: string
      readonly icon: typeof Image
      readonly tone: string
      readonly accent: string
      readonly dropHint: string
    }
  >
> = {
  image: {
    title: 'Image prompt',
    icon: Image,
    tone: 'text-accent',
    accent: 'border-t-4 border-t-accent',
    dropHint: 'Drop reference images here',
  },
  video: {
    title: 'Video prompt',
    icon: Film,
    tone: 'text-primary',
    accent: 'border-t-4 border-t-primary',
    dropHint: 'Drop images or videos here',
  },
}

const COUNT_OPTIONS = [1, 2, 3, 4].map((count) => ({
  value: String(count),
  label: count === 1 ? '1 variant' : `${String(count)} variants`,
}))

/** Chip icon per Higgsfield param; unknown settings fall back to a generic one. */
const SETTING_ICONS: Readonly<Record<string, LucideIcon>> = {
  resolution: Scan,
  quality: Gem,
  variant: Sparkles,
  background: Layers,
  duration: Clock,
  bitrate_mode: Gauge,
}

const ICON = { size: 14, strokeWidth: 1.75 } as const

/** A small frame drawn in the chosen ratio, so the aspect chip shows the shape itself. */
const AspectIcon = ({ ratio }: { readonly ratio: string }) => {
  const [width, height] = ratio.split(':').map(Number)
  if (width === undefined || height === undefined || !(width > 0 && height > 0))
    return <SquareDashed {...ICON} />
  const scale = 12 / Math.max(width, height)
  return (
    <Box className="flex size-3.5 items-center justify-center">
      <Box
        className="rounded-[2px] border-[1.5px] border-current"
        style={{ width: width * scale, height: height * scale }}
      />
    </Box>
  )
}

const SettingChip = (props: {
  readonly setting: ModelSetting
  readonly value: string
  readonly onChange: (value: string) => void
}) => {
  const { setting } = props
  if (setting.type === 'toggle')
    return (
      <ToggleChip
        pressed={props.value === 'on'}
        onPressedChange={(pressed) => props.onChange(pressed ? 'on' : 'off')}
        label={setting.label}
        onIcon={Volume2}
        offIcon={VolumeX}
        testId={`prompt-setting-${setting.key}`}
      />
    )
  const Icon = SETTING_ICONS[setting.key] ?? Sparkles
  return (
    <ChipSelect
      label={setting.label}
      icon={<Icon {...ICON} />}
      value={props.value}
      options={settingChoicesOf(setting)}
      onValueChange={props.onChange}
      testId={`prompt-setting-${setting.key}`}
    />
  )
}

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
  const kind = KIND[request.kind]
  const options = resolveOptions({ model: props.model.id, options: request.options })
  return (
    <Panel
      testId={`prompt-node-${request.id}`}
      data-status={request.status}
      data-stalled={props.stalled}
      className={cx(
        'flex size-full flex-col gap-3 p-3 transition-shadow',
        kind.accent,
        props.selected && 'outline-3 outline-offset-3 outline-mint-700',
        dropActive && 'outline-3 outline-offset-3 outline-accent',
      )}
    >
      <LineageHandles />
      <NodeResizer isVisible={props.selected} minWidth={300} minHeight={260} />
      <Stack
        direction="row"
        align="center"
        justify="between"
        className="prompt-drag-handle cursor-grab"
      >
        <Stack direction="row" align="center" gap={2}>
          <GripHorizontal size={14} className="text-muted-foreground" />
          <kind.icon size={14} className={kind.tone} />
          <Text variant="title" testId="prompt-title">
            {kind.title}
          </Text>
        </Stack>
        <Text
          className={cx('rounded-full px-2 py-0.5 text-[11px] font-medium', status.tone)}
          testId="prompt-status"
        >
          {status.label}
        </Text>
      </Stack>

      <Box
        testId="prompt-dropzone"
        className={cx(
          'flex min-h-16 flex-wrap gap-2 rounded-xl border border-dashed p-2 transition',
          dropActive ? 'border-accent bg-coral-50' : 'border-border-strong',
        )}
      >
        {references.length === 0 ? (
          <Text variant="caption" className="m-auto">
            {kind.dropHint}
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
          <Stack gap={1} className="min-h-0 flex-1">
            <TextArea
              fill
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
          <Stack gap={2} className="nodrag">
            <ChipSelect
              wide
              label="Model"
              icon={<WandSparkles {...ICON} />}
              value={props.model.id}
              options={modelChoicesOf(request.kind)}
              onValueChange={(model) => props.onSettingsChange({ model })}
              testId="prompt-model"
            />
            <Box className="flex flex-wrap gap-1.5" testId="prompt-settings">
              <ChipSelect
                label="Aspect ratio"
                icon={<AspectIcon ratio={request.aspectRatio ?? AUTO_ASPECT} />}
                value={request.aspectRatio ?? AUTO_ASPECT}
                options={aspectChoicesOf(props.model)}
                onValueChange={(aspectRatio) => props.onSettingsChange({ aspectRatio })}
                testId="prompt-aspect"
              />
              <ChipSelect
                label="Variants"
                icon={<Copy {...ICON} />}
                value={String(request.count)}
                options={COUNT_OPTIONS}
                onValueChange={(count) => props.onSettingsChange({ count: Number(count) })}
                testId="prompt-count"
              />
              {props.model.settings.map((setting) => (
                <SettingChip
                  key={setting.key}
                  setting={setting}
                  value={encodeSetting(options[setting.key] ?? setting.default)}
                  onChange={(value) =>
                    props.onSettingsChange({ option: { key: setting.key, value } })
                  }
                />
              ))}
            </Box>
          </Stack>
          <Button
            variant="primary"
            icon={Bot}
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
          <Stack direction="row" align="center" justify="between" gap={2}>
            <Text variant="caption" testId="prompt-summary">
              {props.model.label}
              {request.aspectRatio === null ? '' : ` · ${request.aspectRatio}`}
              {` · ${settingsSummaryOf({ model: props.model, options: request.options })}`}
            </Text>
            {props.duration !== null && (
              <Stack direction="row" align="center" gap={1} className="shrink-0">
                <Timer size={12} className="text-muted-foreground" />
                <Text variant="mono" testId="prompt-duration">
                  {props.duration}
                </Text>
              </Stack>
            )}
          </Stack>
          {props.elapsed !== null && (
            <Stack direction="row" align="center" gap={2} testId="prompt-activity">
              {props.stalled ? (
                <TriangleAlert size={14} className="shrink-0 text-danger" />
              ) : (
                <LoaderCircle size={14} className="shrink-0 animate-spin text-primary" />
              )}
              <Text variant="caption" className="min-w-0 flex-1 truncate" testId="prompt-progress">
                {props.step ?? request.progress ?? status.label}
              </Text>
              <Text variant="mono" className="shrink-0" testId="prompt-elapsed">
                {props.elapsed}
              </Text>
            </Stack>
          )}
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
              <>
                <Button
                  size="sm"
                  icon={ClipboardCopy}
                  onClick={props.onCopyInstruction}
                  testId="prompt-copy"
                >
                  Copy instruction
                </Button>
                <Button size="sm" icon={CircleStop} onClick={props.onCancel} testId="prompt-cancel">
                  Cancel
                </Button>
              </>
            )}
            {props.stalled && (
              <Button size="sm" icon={RotateCw} onClick={props.onRetry} testId="prompt-requeue">
                Requeue
              </Button>
            )}
            {request.status === 'failed' && (
              <Button size="sm" icon={RotateCw} onClick={props.onRetry} testId="prompt-retry">
                Retry
              </Button>
            )}
            {request.status === 'completed' && (
              <Button size="sm" icon={RotateCw} onClick={props.onRetry} testId="prompt-again">
                Generate again
              </Button>
            )}
          </Stack>
        </>
      )}
    </Panel>
  )
}
