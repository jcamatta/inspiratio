import { mediaUrlOf, SYSTEM_TAGS } from '@inspiratio/shared'
import { NodeResizer, NodeToolbar, Position } from '@xyflow/react'
import { Expand, Focus, GripVertical, MessageSquarePlus, Sparkles, Trash2 } from 'lucide-react'
import type { DragEvent, KeyboardEvent } from 'react'
import { cx } from '../../../shared/lib/cx.ts'
import {
  Box,
  Button,
  IconButton,
  MediaImage,
  Panel,
  Stack,
  TagChip,
  Text,
  TextField,
  Tooltip,
} from '../../../shared/ui/index.ts'
import type { MediaNodeData } from '../domain/flow-mapping.ts'
import { VideoPlayer } from './VideoPlayer.controller.tsx'

export type MediaNodeViewProps = {
  readonly data: MediaNodeData
  readonly selected: boolean
  readonly dragging: boolean
  readonly editingTitle: boolean
  readonly draftTitle: string
  readonly onDraftTitleChange: (title: string) => void
  readonly onStartEditing: () => void
  readonly onCommitTitle: () => void
  readonly onCancelEditing: () => void
  readonly onDragToPrompt: (event: DragEvent) => void
  readonly onAddToPrompt: () => void
  readonly onView: () => void
  readonly onFocus: () => void
  readonly onDelete: () => void
  readonly onDimensions: (size: { readonly width: number; readonly height: number }) => void
}

const MAX_CHIPS = 4

export const MediaNodeView = (props: MediaNodeViewProps) => {
  const { item, tags, dimmed, referenceLabel } = props.data
  const isGenerated = tags.some((tag) => tag.name === SYSTEM_TAGS.aiGenerated)
  const onTitleKey = (event: KeyboardEvent) => {
    if (event.key === 'Enter') props.onCommitTitle()
    if (event.key === 'Escape') props.onCancelEditing()
  }
  return (
    <Box
      testId={`media-node-${item.id}`}
      data-kind={item.kind}
      className={cx('relative size-full transition-opacity', dimmed && 'opacity-20')}
    >
      <NodeResizer isVisible={props.selected} keepAspectRatio minWidth={48} minHeight={48} />
      <NodeToolbar
        isVisible={props.selected && !props.dragging}
        position={Position.Top}
        offset={10}
      >
        <Panel className="flex items-center gap-0.5 p-1">
          <Tooltip label="Drag into the prompt">
            <Button
              variant="ghost"
              size="sm"
              icon={GripVertical}
              draggable
              onDragStart={props.onDragToPrompt}
              className="nodrag cursor-grab"
              testId="node-drag-to-prompt"
              aria-label="Drag into the prompt"
            />
          </Tooltip>
          <IconButton
            icon={MessageSquarePlus}
            label="Add to prompt"
            size="sm"
            onClick={props.onAddToPrompt}
            testId="node-add-to-prompt"
          />
          <IconButton
            icon={Expand}
            label="View full size"
            size="sm"
            onClick={props.onView}
            testId="node-view"
          />
          <IconButton
            icon={Focus}
            label="Zoom to fit"
            size="sm"
            onClick={props.onFocus}
            testId="node-focus"
          />
          <IconButton
            icon={Trash2}
            label="Delete"
            size="sm"
            onClick={props.onDelete}
            testId="node-delete"
            className="text-danger"
          />
        </Panel>
      </NodeToolbar>

      <Box
        className={cx(
          'size-full overflow-hidden rounded-md bg-surface shadow-sm ring-1 ring-mint-950/5',
          props.selected && 'ring-2 ring-mint-700',
        )}
      >
        {item.kind === 'video' ? (
          <VideoPlayer
            item={item}
            showControls={props.selected}
            onDimensions={props.onDimensions}
          />
        ) : (
          <MediaImage src={mediaUrlOf(item.media)} alt={item.title} testId="media-image" />
        )}
      </Box>

      {referenceLabel !== null && (
        <Text
          testId="reference-label"
          className="absolute top-1.5 left-1.5 rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground shadow"
        >
          {referenceLabel}
        </Text>
      )}
      {isGenerated && (
        <Box
          className="absolute top-1.5 right-1.5 rounded-md bg-accent p-1 text-accent-foreground shadow"
          title="AI generated"
        >
          <Sparkles size={12} />
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
          <Text
            variant="label"
            truncate
            testId="node-title"
            className="cursor-text text-foreground/80"
            onDoubleClick={props.onStartEditing}
            title="Double-click to rename"
          >
            {item.title}
          </Text>
        )}
        {tags.length > 0 && (
          <Stack direction="row" gap={1} wrap>
            {tags.slice(0, MAX_CHIPS).map((tag) => (
              <TagChip
                key={tag.id}
                name={tag.name}
                color={tag.color}
                system={tag.system}
                size="xs"
              />
            ))}
            {tags.length > MAX_CHIPS && <Text variant="caption">+{tags.length - MAX_CHIPS}</Text>}
          </Stack>
        )}
      </Stack>
    </Box>
  )
}
