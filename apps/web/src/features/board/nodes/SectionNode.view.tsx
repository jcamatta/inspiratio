import type { TagColor } from '@inspiratio/shared'
import { NodeResizer } from '@xyflow/react'
import { GripHorizontal } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { cx } from '../../../shared/lib/cx.ts'
import { Box, Stack, Text, TextField } from '../../../shared/ui/index.ts'
import type { SectionNodeData } from '../domain/flow-mapping.ts'

const FRAME: Readonly<Record<TagColor, string>> = {
  mint: 'border-mint-700/30 bg-mint-100/30',
  coral: 'border-coral-500/40 bg-coral-50/40',
  sky: 'border-tag-sky-fg/25 bg-tag-sky/40',
  amber: 'border-tag-amber-fg/25 bg-tag-amber/40',
  violet: 'border-tag-violet-fg/25 bg-tag-violet/40',
  slate: 'border-tag-slate-fg/25 bg-tag-slate/40',
}

export type SectionNodeViewProps = {
  readonly data: SectionNodeData
  readonly selected: boolean
  readonly editing: boolean
  readonly draft: string
  readonly onDraftChange: (value: string) => void
  readonly onStartEditing: () => void
  readonly onCommit: () => void
  readonly onCancel: () => void
}

export const SectionNodeView = (props: SectionNodeViewProps) => {
  const { section, childCount } = props.data
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Enter') props.onCommit()
    if (event.key === 'Escape') props.onCancel()
  }
  return (
    <Box
      testId={`section-node-${section.id}`}
      className={cx(
        'size-full rounded-xl border-2 border-dashed transition-colors',
        FRAME[section.color],
        props.selected &&
          'border-solid border-mint-700 outline-3 outline-offset-3 outline-mint-700',
      )}
    >
      <NodeResizer isVisible={props.selected} minWidth={200} minHeight={140} />
      <Stack
        direction="row"
        align="center"
        gap={2}
        className="section-drag-handle absolute -top-9 left-0 h-8 max-w-full cursor-grab rounded-lg px-1"
      >
        <GripHorizontal size={14} className="shrink-0 text-muted-foreground" />
        {props.editing ? (
          <TextField
            dense
            autoFocus
            value={props.draft}
            onValueChange={props.onDraftChange}
            onBlur={props.onCommit}
            onKeyDown={onKey}
            className="nodrag w-56"
            testId="section-title-input"
            aria-label="Section title"
          />
        ) : (
          <Text
            variant="title"
            truncate
            testId="section-title"
            className="cursor-text"
            onDoubleClick={props.onStartEditing}
            title="Double-click to rename"
          >
            {section.title}
          </Text>
        )}
        <Text variant="caption" className="shrink-0">
          {childCount}
        </Text>
      </Stack>
    </Box>
  )
}
