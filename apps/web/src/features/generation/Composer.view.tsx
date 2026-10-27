import { MAX_REFERENCES, mediaUrlOf, type GenerationKind, type Item } from '@inspiratio/shared'
import { Film, Image, MousePointerSquareDashed, Send, X } from 'lucide-react'
import type { DragEvent, KeyboardEvent } from 'react'
import { cx } from '../../shared/lib/cx.ts'
import {
  Box,
  Button,
  IconButton,
  MediaImage,
  ScrollArea,
  Segmented,
  Select,
  Stack,
  Text,
  TextArea,
} from '../../shared/ui/index.ts'
import type { Composer } from '../workspace/domain/workspace.ts'
import { ASPECT_RATIOS, labelOf, type ModelOption } from './domain/prompt.ts'

export type ComposerViewProps = {
  readonly composer: Composer
  readonly references: readonly Item[]
  readonly models: readonly ModelOption[]
  readonly dangling: readonly string[]
  readonly canSubmit: boolean
  readonly dropActive: boolean
  readonly selectionCount: number
  readonly onPromptChange: (prompt: string) => void
  readonly onSettingsChange: (settings: {
    readonly model?: string
    readonly aspectRatio?: string
    readonly count?: number
  }) => void
  readonly onKindChange: (kind: GenerationKind) => void
  readonly onRemoveReference: (itemId: string) => void
  readonly onUseSelection: () => void
  readonly onDrop: (event: DragEvent) => void
  readonly onDragOver: (event: DragEvent) => void
  readonly onDragLeave: () => void
  readonly onSubmit: () => void
}

const KIND_OPTIONS = [
  { value: 'image' as const, label: 'Image', icon: Image },
  { value: 'video' as const, label: 'Video', icon: Film },
]

const COUNT_OPTIONS = [1, 2, 3, 4].map((count) => ({ value: String(count), label: `${count}×` }))

const ASPECT_OPTIONS = ASPECT_RATIOS.map((ratio) => ({
  value: ratio,
  label: ratio === 'auto' ? 'Auto' : ratio,
}))

const ReferenceThumb = ({
  item,
  index,
  onRemove,
}: {
  readonly item: Item
  readonly index: number
  readonly onRemove: () => void
}) => (
  <Box
    className="group relative size-16 shrink-0 overflow-hidden rounded-lg bg-surface ring-1 ring-mint-950/5"
    testId="composer-reference"
  >
    {item.kind === 'image' ? (
      <MediaImage src={mediaUrlOf(item.media)} alt={item.title} />
    ) : (
      <Stack align="center" justify="center" className="size-full">
        <Film size={16} className="text-muted-foreground" />
      </Stack>
    )}
    <Text className="absolute bottom-1 left-1 rounded bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
      {labelOf(index)}
    </Text>
    <Box className="absolute top-0.5 right-0.5 opacity-0 transition group-hover:opacity-100">
      <IconButton
        icon={X}
        label={`Remove ${labelOf(index)}`}
        size="sm"
        variant="secondary"
        className="size-5"
        onClick={onRemove}
      />
    </Box>
  </Box>
)

export const ComposerView = (props: ComposerViewProps) => {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && props.canSubmit)
      props.onSubmit()
  }
  return (
    <ScrollArea className="flex-1">
      <Stack gap={4} className="p-4" testId="composer">
        <Segmented
          value={props.composer.kind}
          onValueChange={props.onKindChange}
          options={KIND_OPTIONS}
          testId="composer-kind"
        />

        <Stack gap={2}>
          <Stack direction="row" justify="between" align="center">
            <Text variant="heading">
              References {props.references.length}/{MAX_REFERENCES}
            </Text>
            <Button
              size="sm"
              variant="ghost"
              icon={MousePointerSquareDashed}
              disabled={props.selectionCount === 0}
              onClick={props.onUseSelection}
              testId="composer-use-selection"
            >
              Use selection
            </Button>
          </Stack>
          <Box
            testId="composer-dropzone"
            onDrop={props.onDrop}
            onDragOver={props.onDragOver}
            onDragLeave={props.onDragLeave}
            className={cx(
              'flex min-h-20 flex-wrap gap-2 rounded-xl border border-dashed p-2 transition',
              props.dropActive ? 'border-mint-700 bg-surface' : 'border-border-strong',
            )}
          >
            {props.references.length === 0 ? (
              <Text variant="caption" className="m-auto px-2 text-center">
                Drag references here (grip icon on a selected item) or right-click › Add to prompt
              </Text>
            ) : (
              [...props.references.entries()].map(([index, item]) => (
                <ReferenceThumb
                  key={item.id}
                  item={item}
                  index={index}
                  onRemove={() => props.onRemoveReference(item.id)}
                />
              ))
            )}
          </Box>
        </Stack>

        <Stack gap={1}>
          <TextArea
            label="Prompt"
            value={props.composer.prompt}
            onValueChange={props.onPromptChange}
            onDrop={props.onDrop}
            onDragOver={props.onDragOver}
            onKeyDown={onKeyDown}
            highlighted={props.dropActive}
            rows={7}
            placeholder={
              'Describe the shot. Refer to references with @1, @2…\ne.g. "Night exterior in the style of @1, lit like @2, 35mm, shallow DOF"'
            }
            testId="composer-prompt"
          />
          {props.dangling.length > 0 && (
            <Text variant="caption" className="text-danger" testId="composer-dangling">
              {props.dangling.join(', ')} {props.dangling.length === 1 ? 'does' : 'do'} not match
              any reference
            </Text>
          )}
        </Stack>

        <Box className="grid grid-cols-2 gap-3">
          <Select
            label="Model"
            value={props.composer.model}
            options={props.models}
            onValueChange={(model) => props.onSettingsChange({ model })}
            testId="composer-model"
          />
          <Select
            label="Aspect ratio"
            value={props.composer.aspectRatio}
            options={ASPECT_OPTIONS}
            onValueChange={(aspectRatio) => props.onSettingsChange({ aspectRatio })}
            testId="composer-aspect"
          />
          <Select
            label="Variants"
            value={String(props.composer.count)}
            options={COUNT_OPTIONS}
            onValueChange={(count) => props.onSettingsChange({ count: Number(count) })}
            testId="composer-count"
          />
        </Box>

        <Button
          variant="primary"
          icon={Send}
          disabled={!props.canSubmit}
          onClick={props.onSubmit}
          testId="composer-submit"
        >
          Queue for Claude Code
        </Button>
        <Text variant="caption">
          Queued prompts are picked up by Claude Code through the Inspiratio MCP, generated with
          Higgsfield and dropped back on the canvas tagged with the model.
        </Text>
      </Stack>
    </ScrollArea>
  )
}
