import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useCommand } from '../../shared/api/use-command.ts'
import { notify } from '../../shared/ui/index.ts'
import { settingsApi, STORAGE_QUERY_KEY } from './api/settings.api.ts'
import { SettingsView } from './Settings.view.tsx'

export const Settings = () => {
  const [open, setOpen] = useState(false)
  const storage = useQuery({
    queryKey: [STORAGE_QUERY_KEY],
    queryFn: settingsApi.fetchStorage,
    enabled: open,
  })
  const openFolder = useCommand({
    name: 'storage.open',
    call: settingsApi.openFolder,
    invalidate: [],
    errorTitle: 'Could not open the folder',
  })
  return (
    <SettingsView
      open={open}
      onOpenChange={setOpen}
      storage={storage.data ?? null}
      onOpenFolder={(folder) => void openFolder({ folder })}
      onCopyPath={(path) => {
        void navigator.clipboard.writeText(path).then(() => {
          notify({ title: 'Path copied', tone: 'success' })
        })
      }}
    />
  )
}
