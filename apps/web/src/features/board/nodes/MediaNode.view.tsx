import { mediaUrlOf, SYSTEM_TAGS } from '@inspiratio/shared'
import { NodeResizer } from '@xyflow/react'
import { LineageHandles } from './LineageHandles.tsx'
import { Plus, Bot } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { cx } from '../../../shared/lib/cx.ts'
import {
  Box,
  IconButton,
  MediaImage,
  Stack,
  TagChip,
  Text,
  TextField,
} from '../../../shared/ui/index.ts'
import { TagPicker } from '../../tags/TagPicker.controller.tsx'
import type { MediaNodeData } from '../domain/flow-mapping.ts'
import { AudioPlayer } from './AudioPlayer.controller.tsx'
import { VideoPlayer } from './VideoPlayer.controller.tsx'

export type MediaNodeViewProps = {
  readonly data: MediaNodeData
  readonly selected: boolean
  readonly editingTitle: boolean
  readonly editingTags: boolean
  readonly draftTitle: string
  readonly onDraftTitleChange: (title: string) => void
  readonly onStartEditingTitle: () => void
  readonly onCommitTitle: () => void
  readonly onCancelEditing: () => void
  readonly onStartEditingTags: () => void
  readonly onTagsChange: (tagIds: string[]) => void
  readonly onRemoveTag: (tagId: string) => void
  readonly onDimensions: (size: { readonly width: number; readonly height: number }) => void
}

export const MediaNodeView = (props: MediaNodeViewProps) => {
  const { item, tags, allTags, referenceLabels } = props.data
  const isGenerated = tags.some((tag) => tag.name === SYSTEM_TAGS.aiGenerated)
  const onTitleKey = (event: KeyboardEvent) => {
    if (event.key === 'Enter') props.onCommitTitle()
    if (event.key === 'Escape') props.onCancelEditing()
  }
  return (
    <Box
      testId={`media-node-${item.id}`}
      data-selected={props.selected}
      className="relative size-full"
      onDoubleClick={props.onStartEditingTitle}
    >
      <LineageHandles />
      <NodeResizer isVisible={props.selected} keepAspectRatio minWidth={48} minHeight={48} />
      <Box
        className={cx(
          'size-full overflow-hidden rounded-md bg-surface shadow-sm transition-shadow',
          props.selected ? 'outline-3 outline-offset-3 outline-mint-700' : 'ring-1 ring-mint-950/5',
        )}
      >
        {item.kind === 'audio' ? (
          <AudioPlayer item={item} />
        ) : item.kind === 'video' ? (
          <VideoPlayer
            item={item}
            showControls={props.selected}
            onDimensions={props.onDimensions}
          />
        ) : (
          <MediaImage src={mediaUrlOf(item.media)} alt={item.title} testId="media-image" />
        )}
      </Box>

      {referenceLabels.length > 0 && (
        <Text
          testId="reference-label"
          className="absolute top-1.5 left-1.5 rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground shadow"
        >
          {referenceLabels.join(' ')}
        </Text>
      )}
      {isGenerated && (
        <Box className="absolute top-1.5 right-1.5 rounded-md bg-accent p-1 text-accent-foreground shadow">
          <Bot size={12} aria-label="AI generated" />
        </Box>
      )}

      <Stack gap={1} className="absolute top-full left-0 mt-1.5 w-full">
        {props.editingTitle ? (
          <TextField
            dense
            autoFocus
            value={props.draftTitle}
            onValueChange={props.onDraftTitleChange}
            onBlur={props.onCommitTitle}
            onKeyDown={onTitleKey}
            className="nodrag"
            testId="node-title-input"
            aria-label="Title"
          />
        ) : (
          <Text variant="label" truncate testId="node-title" className="text-foreground/80">
            {item.title}
          </Text>
        )}
        {props.editingTags ? (
          <Box className="nodrag nowheel">
            <TagPicker
              tags={allTags}
              value={item.tagIds}
              onChange={props.onTagsChange}
              autoFocus
              onEscape={props.onCancelEditing}
              testId="node-tag-picker"
            />
          </Box>
        ) : (
          <Stack direction="row" gap={1} wrap align="center">
            {tags.map((tag) => (
              <TagChip
                key={tag.id}
                name={tag.name}
                color={tag.color}
                system={tag.system}
                size="xs"
                testId={`node-tag-${tag.name}`}
                {...(props.selected ? { onRemove: () => props.onRemoveTag(tag.id) } : {})}
              />
            ))}
            {props.selected && (
              <IconButton
                icon={Plus}
                label="Add tag"
                size="sm"
                className="nodrag size-5"
                onClick={props.onStartEditingTags}
                testId="node-add-tag"
              />
            )}
          </Stack>
        )}
      </Stack>
    </Box>
  )
}
