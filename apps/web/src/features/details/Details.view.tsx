import type { Item } from '@inspiratio/shared'
import { Copy, Bot, Image as ImageIcon } from 'lucide-react'
import {
  Box,
  Button,
  Dialog,
  Disclosure,
  ExternalLink,
  ScrollArea,
  Separator,
  Stack,
  Text,
  TextArea,
} from '../../shared/ui/index.ts'
import type { StepRow } from '../generation/domain/steps.ts'
import { metadataRows } from '../inspector/domain/metadata.ts'

export type DetailsSteps = { readonly rows: readonly StepRow[]; readonly total: string | null }

export type DetailsViewProps = {
  readonly item: Item
  readonly steps: DetailsSteps | null
  readonly notes: string
  readonly onNotesChange: (notes: string) => void
  readonly onNotesCommit: () => void
  /** Absolute path of the media file on disk, once the storage directory is known. */
  readonly filePath: string | null
  readonly onCopyPrompt: (prompt: string) => void
  readonly onCopyPath: (path: string) => void
  /** Null for videos: the clipboard only takes still images. */
  readonly onCopyImage: (() => void) | null
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
          {props.onCopyImage !== null && (
            <Button size="sm" icon={ImageIcon} onClick={props.onCopyImage}>
              Copy image
            </Button>
          )}
          {generation !== null && (
            <Stack gap={2}>
              <Stack direction="row" align="center" gap={2}>
                <Bot size={14} className="text-accent" />
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
              {generation.providerPrompt !== null && (
                <Disclosure
                  label={`Sent to ${generation.provider}`}
                  testId="details-provider-prompt"
                >
                  <Stack gap={2}>
                    <Box className="rounded-lg bg-background p-2.5">
                      <Text variant="body" className="whitespace-pre-wrap">
                        {generation.providerPrompt}
                      </Text>
                    </Box>
                    <Button
                      size="sm"
                      icon={Copy}
                      onClick={() => props.onCopyPrompt(generation.providerPrompt ?? '')}
                    >
                      Copy sent prompt
                    </Button>
                  </Stack>
                </Disclosure>
              )}
              {generation.promptGuide !== null && (
                <Disclosure label="Guide" testId="details-prompt-guide">
                  <Box className="rounded-lg bg-background p-2.5">
                    <Text variant="body" className="whitespace-pre-wrap">
                      {generation.promptGuide}
                    </Text>
                  </Box>
                </Disclosure>
              )}
              {props.steps !== null && (
                <Disclosure
                  label={props.steps.total === null ? 'Steps' : `Steps · ${props.steps.total}`}
                  testId="details-steps"
                >
                  <Stack gap={1}>
                    {[...props.steps.rows.entries()].map(([index, row]) => (
                      <Stack
                        key={`${String(index)}-${row.label}`}
                        direction="row"
                        justify="between"
                        gap={3}
                        testId="details-step"
                      >
                        <Text variant="caption">{row.label}</Text>
                        <Text variant="mono">{row.duration}</Text>
                      </Stack>
                    ))}
                    {props.steps.total !== null && (
                      <Stack direction="row" justify="between" gap={3}>
                        <Text variant="label">Total</Text>
                        <Text variant="mono" testId="details-steps-total">
                          {props.steps.total}
                        </Text>
                      </Stack>
                    )}
                  </Stack>
                </Disclosure>
              )}
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
          {props.filePath !== null && (
            <Stack gap={2}>
              <Text variant="caption">Path</Text>
              <Box className="rounded-lg bg-background p-2.5">
                <Text variant="mono" className="break-all select-text" testId="details-path">
                  {props.filePath}
                </Text>
              </Box>
              <Button
                size="sm"
                icon={Copy}
                onClick={() => {
                  if (props.filePath !== null) props.onCopyPath(props.filePath)
                }}
              >
                Copy path
              </Button>
            </Stack>
          )}
        </Stack>
      </ScrollArea>
    </Dialog>
  )
}
