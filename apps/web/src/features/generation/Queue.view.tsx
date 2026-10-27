import {
  mediaUrlOf,
  type GenerationRequest,
  type GenerationStatus,
  type Item,
} from '@inspiratio/shared'
import { ClipboardCopy, Film, Inbox, RotateCw, Trash2 } from 'lucide-react'
import { cx } from '../../shared/lib/cx.ts'
import {
  Box,
  Button,
  IconButton,
  MediaImage,
  ScrollArea,
  Stack,
  Text,
} from '../../shared/ui/index.ts'
import { formatDate } from '../inspector/domain/metadata.ts'

export type QueueViewProps = {
  readonly requests: readonly GenerationRequest[]
  readonly items: readonly Item[]
  readonly onCopyInstruction: (id: string) => void
  readonly onRetry: (id: string) => void
  readonly onRemove: (id: string) => void
  readonly onFocusItems: (ids: string[]) => void
}

const STATUS: Readonly<
  Record<GenerationStatus, { readonly label: string; readonly tone: string }>
> = {
  pending: { label: 'Waiting for Claude', tone: 'bg-tag-amber text-tag-amber-fg' },
  in_progress: { label: 'Generating…', tone: 'bg-tag-sky text-tag-sky-fg animate-pulse' },
  completed: { label: 'Done', tone: 'bg-tag-mint text-tag-mint-fg' },
  failed: { label: 'Failed', tone: 'bg-danger-surface text-danger' },
}

const Thumbs = ({
  ids,
  items,
  onClick,
}: {
  readonly ids: readonly string[]
  readonly items: readonly Item[]
  readonly onClick: () => void
}) => {
  const found = ids
    .map((id) => items.find((item) => item.id === id))
    .filter((item) => item !== undefined)
  if (found.length === 0) return null
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto justify-start p-0"
      onClick={onClick}
      aria-label="Show on canvas"
    >
      <Stack direction="row" gap={1} wrap>
        {found.map((item) => (
          <Box key={item.id} className="size-10 overflow-hidden rounded-md bg-surface">
            {item.kind === 'image' ? (
              <MediaImage src={mediaUrlOf(item.media)} alt={item.title} />
            ) : (
              <Stack align="center" justify="center" className="size-full">
                <Film size={14} />
              </Stack>
            )}
          </Box>
        ))}
      </Stack>
    </Button>
  )
}

const RequestCard = ({
  request,
  ...props
}: Omit<QueueViewProps, 'requests'> & { readonly request: GenerationRequest }) => {
  const status = STATUS[request.status]
  const referenceIds = request.references.map((reference) => reference.itemId)
  return (
    <Stack
      gap={2}
      className="rounded-xl border border-border bg-panel p-3"
      testId="queue-item"
      data-status={request.status}
    >
      <Stack direction="row" align="center" justify="between" gap={2}>
        <Text
          className={cx('rounded-full px-2 py-0.5 text-[11px] font-medium', status.tone)}
          testId="queue-status"
        >
          {status.label}
        </Text>
        <Text variant="caption">
          {request.kind} · {request.model ?? 'auto'}
        </Text>
      </Stack>
      <Text variant="body" className="line-clamp-3 whitespace-pre-wrap">
        {request.prompt}
      </Text>
      {referenceIds.length > 0 && (
        <Thumbs
          ids={referenceIds}
          items={props.items}
          onClick={() => props.onFocusItems(referenceIds)}
        />
      )}
      {request.status === 'completed' && (
        <Stack gap={1}>
          <Text variant="heading">Results</Text>
          <Thumbs
            ids={request.resultItemIds}
            items={props.items}
            onClick={() => props.onFocusItems(request.resultItemIds)}
          />
        </Stack>
      )}
      {request.error !== null && (
        <Text variant="caption" className="text-danger">
          {request.error}
        </Text>
      )}
      <Stack direction="row" align="center" justify="between">
        <Text variant="caption">{formatDate(request.createdAt)}</Text>
        <Stack direction="row" gap={0}>
          {request.status !== 'completed' && (
            <IconButton
              icon={ClipboardCopy}
              label="Copy Claude Code instruction"
              size="sm"
              onClick={() => props.onCopyInstruction(request.id)}
            />
          )}
          {request.status === 'failed' && (
            <IconButton
              icon={RotateCw}
              label="Retry"
              size="sm"
              onClick={() => props.onRetry(request.id)}
            />
          )}
          <IconButton
            icon={Trash2}
            label="Delete request"
            size="sm"
            onClick={() => props.onRemove(request.id)}
            testId="queue-delete"
          />
        </Stack>
      </Stack>
    </Stack>
  )
}

export const QueueView = (props: QueueViewProps) =>
  props.requests.length === 0 ? (
    <Stack
      align="center"
      justify="center"
      gap={2}
      className="flex-1 p-8 text-center"
      testId="queue-empty"
    >
      <Inbox size={20} className="text-muted-foreground" />
      <Text variant="caption">
        No prompts yet. Compose one in the Generate tab and Claude Code will pick it up.
      </Text>
    </Stack>
  ) : (
    <ScrollArea className="flex-1">
      <Stack gap={2} className="p-3" testId="queue">
        {props.requests.map((request) => (
          <RequestCard key={request.id} request={request} {...props} />
        ))}
      </Stack>
    </ScrollArea>
  )
