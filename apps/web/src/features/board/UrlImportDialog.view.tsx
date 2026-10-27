import { Download } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { Button, Dialog, Stack, TextField } from '../../shared/ui/index.ts'

export type UrlImportDialogViewProps = {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly url: string
  readonly onUrlChange: (url: string) => void
  readonly canSubmit: boolean
  readonly onSubmit: () => void
}

export const UrlImportDialogView = (props: UrlImportDialogViewProps) => {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && props.canSubmit) props.onSubmit()
  }
  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title="Import from URL"
      testId="url-dialog"
    >
      <TextField
        autoFocus
        placeholder="https://…"
        value={props.url}
        onValueChange={props.onUrlChange}
        onKeyDown={onKeyDown}
        testId="url-input"
        aria-label="URL"
      />
      <Stack direction="row" justify="end" gap={2}>
        <Button variant="ghost" onClick={() => props.onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          variant="primary"
          icon={Download}
          disabled={!props.canSubmit}
          onClick={props.onSubmit}
          testId="url-submit"
        >
          Import
        </Button>
      </Stack>
    </Dialog>
  )
}
