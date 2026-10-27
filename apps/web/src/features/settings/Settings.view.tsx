import type { StorageFolder, StorageInfo } from '@inspiratio/shared'
import { Copy, FolderOpen, Settings } from 'lucide-react'
import { Box, Dialog, IconButton, Stack, Text } from '../../shared/ui/index.ts'

export type SettingsViewProps = {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly storage: StorageInfo | null
  readonly onOpenFolder: (folder: StorageFolder) => void
  readonly onCopyPath: (path: string) => void
}

const FOLDERS: readonly { readonly folder: StorageFolder; readonly label: string }[] = [
  { folder: 'media', label: 'Media' },
  { folder: 'trash', label: 'Trash' },
]

export const SettingsView = (props: SettingsViewProps) => (
  <>
    <IconButton
      icon={Settings}
      label="Settings"
      onClick={() => {
        props.onOpenChange(true)
      }}
      testId="settings"
    />
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title="Settings"
      testId="settings-dialog"
    >
      <Stack gap={3}>
        <Text variant="heading">Storage</Text>
        {FOLDERS.map(({ folder, label }) => {
          const path = props.storage?.[folder] ?? ''
          return (
            <Box key={folder} className="flex items-center gap-2" testId={`storage-${folder}`}>
              <Stack gap={1} className="min-w-0 flex-1">
                <Text variant="caption">{label}</Text>
                <Text variant="mono" truncate title={path} testId={`storage-${folder}-path`}>
                  {path}
                </Text>
              </Stack>
              <IconButton
                icon={Copy}
                label={`Copy ${label.toLowerCase()} path`}
                disabled={path === ''}
                onClick={() => {
                  props.onCopyPath(path)
                }}
                testId={`copy-${folder}`}
              />
              <IconButton
                icon={FolderOpen}
                label={`Open ${label.toLowerCase()} folder`}
                disabled={path === ''}
                onClick={() => {
                  props.onOpenFolder(folder)
                }}
                testId={`open-${folder}`}
              />
            </Box>
          )
        })}
      </Stack>
    </Dialog>
  </>
)
