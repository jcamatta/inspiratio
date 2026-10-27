import { useState } from 'react'
import { isImportableUrl } from './domain/drop-data.ts'
import { UrlImportDialogView } from './UrlImportDialog.view.tsx'

export const UrlImportDialog = ({
  open,
  onOpenChange,
  onSubmit,
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onSubmit: (url: string) => void
}) => {
  const [url, setUrl] = useState('')
  return (
    <UrlImportDialogView
      open={open}
      onOpenChange={onOpenChange}
      url={url}
      onUrlChange={setUrl}
      canSubmit={isImportableUrl(url)}
      onSubmit={() => {
        onSubmit(url.trim())
        setUrl('')
      }}
    />
  )
}
