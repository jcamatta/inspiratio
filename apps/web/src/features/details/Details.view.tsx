import type { Item } from '@inspiratio/shared'
import { Copy, Sparkles } from 'lucide-react'
import {
  Box,
  Button,
  Dialog,
  ExternalLink,
  ScrollArea,
  Separator,
  Stack,
  Text,
  TextArea,
} from '../../shared/ui/index.ts'
import { metadataRows } from '../inspector/domain/metadata.ts'

export type DetailsViewProps = {
  readonly item: Item
  readonly notes: string
  readonly onNotesChange: (notes: string) => void
  readonly onNotesCommit: () => void
  readonly onCopyPrompt: (prompt: string) => void
  readonly onClose: () => void
}

export const DetailsView = (props: DetailsViewProps) => {
  const generation = props.item.metadata.generation
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          props.onNotesCommit()
          props.onClose()
        }
      }}
      title={props.item.title}
      testId="details"
    >
      <ScrollArea className="max-h-[70vh]">
        <Stack gap={4}>
          <TextArea
            label="Notes"
            value={props.notes}
            onValueChange={props.onNotesChange}
            onBlur={props.onNotesCommit}
            placeholder="Lighting, lens, palette, mood…"
            testId="details-notes"
          />
          {generation !== null && (
            <Stack gap={2}>
              <Stack direction="row" align="center" gap={2}>
                <Sparkles size={14} className="text-accent" />
                <Text variant="label" testId="details-model">
                  {generation.provider} · {generation.model}
                </Text>
              </Stack>
              <Box className="rounded-lg bg-background p-2.5">
                <Text variant="body" className="whitespace-pre-wrap" testId="details-prompt">
                  {generation.prompt}
                </Text>
              </Box>
              <Button size="sm" icon={Copy} onClick={() => props.onCopyPrompt(generation.prompt)}>
                Copy prompt
              </Button>
            </Stack>
          )}
          <Separator />
          <Stack gap={1} testId="details-metadata">
            {metadataRows(props.item).map((row) => (
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
        </Stack>
      </ScrollArea>
    </Dialog>
  )
}
