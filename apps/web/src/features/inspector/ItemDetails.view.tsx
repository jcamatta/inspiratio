import { mediaUrlOf, type Item, type Tag } from '@inspiratio/shared'
import { Copy, Expand, Film, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  Box,
  Button,
  ExternalLink,
  IconButton,
  MediaImage,
  ScrollArea,
  Separator,
  Stack,
  Text,
  TextArea,
  TextField,
} from '../../shared/ui/index.ts'
import { TagPicker } from '../tags/TagPicker.controller.tsx'
import { metadataRows } from './domain/metadata.ts'

export type ItemDetailsViewProps = {
  readonly item: Item
  readonly tags: readonly Tag[]
  readonly references: readonly Item[]
  readonly title: string
  readonly onTitleChange: (title: string) => void
  readonly onTitleCommit: () => void
  readonly notes: string
  readonly onNotesChange: (notes: string) => void
  readonly onNotesCommit: () => void
  readonly onTagsChange: (tagIds: string[]) => void
  readonly onCopyPrompt: (prompt: string) => void
  readonly onFocusItem: (id: string) => void
  readonly onView: () => void
}

const Section = ({ title, children }: { readonly title: string; readonly children: ReactNode }) => (
  <Stack gap={2}>
    <Text variant="heading">{title}</Text>
    {children}
  </Stack>
)

const Preview = ({ item }: { readonly item: Item }) =>
  item.kind === 'image' ? (
    <MediaImage src={mediaUrlOf(item.media)} alt={item.title} fit="contain" />
  ) : (
    <Stack align="center" justify="center" className="size-full">
      <Film size={20} className="text-muted-foreground" />
    </Stack>
  )

export const ItemDetailsView = (props: ItemDetailsViewProps) => {
  const { item } = props
  const generation = item.metadata.generation
  return (
    <ScrollArea className="flex-1">
      <Stack gap={4} className="p-4" testId="inspector">
        <Box className="relative aspect-video overflow-hidden rounded-lg bg-surface">
          <Preview item={item} />
          <Box className="absolute top-1.5 right-1.5">
            <IconButton
              icon={Expand}
              label="View full size"
              size="sm"
              variant="secondary"
              onClick={props.onView}
            />
          </Box>
        </Box>

        <TextField
          label="Title"
          value={props.title}
          onValueChange={props.onTitleChange}
          onBlur={props.onTitleCommit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') props.onTitleCommit()
          }}
          testId="inspector-title"
        />

        <Section title="Tags">
          <TagPicker tags={props.tags} value={item.tagIds} onChange={props.onTagsChange} />
        </Section>

        <TextArea
          label="Notes"
          value={props.notes}
          onValueChange={props.onNotesChange}
          onBlur={props.onNotesCommit}
          placeholder="Why this reference? Lighting, lens, palette, mood…"
          rows={3}
          testId="inspector-notes"
        />

        {generation !== null && (
          <>
            <Separator />
            <Section title="Generation">
              <Stack direction="row" align="center" gap={2}>
                <Sparkles size={14} className="text-accent" />
                <Text variant="label" testId="inspector-model">
                  {generation.provider} · {generation.model}
                </Text>
              </Stack>
              <Box className="rounded-lg bg-background p-2.5">
                <Text variant="body" className="whitespace-pre-wrap" testId="inspector-prompt">
                  {generation.prompt}
                </Text>
              </Box>
              <Button size="sm" icon={Copy} onClick={() => props.onCopyPrompt(generation.prompt)}>
                Copy prompt
              </Button>
              {props.references.length > 0 && (
                <Stack direction="row" gap={1} wrap>
                  {props.references.map((reference) => (
                    <Button
                      key={reference.id}
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0"
                      onClick={() => props.onFocusItem(reference.id)}
                      aria-label={`Show ${reference.title}`}
                    >
                      <Box className="size-12 overflow-hidden rounded-md bg-surface">
                        <Preview item={reference} />
                      </Box>
                    </Button>
                  ))}
                </Stack>
              )}
            </Section>
          </>
        )}

        <Separator />
        <Section title="Metadata">
          <Stack gap={1} testId="inspector-metadata">
            {metadataRows(item).map((row) => (
              <Stack key={row.label} direction="row" justify="between" gap={3}>
                <Text variant="caption" className="shrink-0">
                  {row.label}
                </Text>
                {row.href === undefined ? (
                  <Text variant="label" truncate className="text-right">
                    {row.value}
                  </Text>
                ) : (
                  <ExternalLink href={row.href}>{row.value}</ExternalLink>
                )}
              </Stack>
            ))}
          </Stack>
        </Section>
      </Stack>
    </ScrollArea>
  )
}
