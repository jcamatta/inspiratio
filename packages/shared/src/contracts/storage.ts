import { z } from 'zod'

export const STORAGE_FOLDERS = ['media', 'trash'] as const
export const StorageFolderSchema = z.enum(STORAGE_FOLDERS)
export type StorageFolder = z.infer<typeof StorageFolderSchema>

export const StorageInfoSchema = z.object({
  media: z.string(),
  trash: z.string(),
})
export type StorageInfo = z.infer<typeof StorageInfoSchema>

export const OpenFolderSchema = z.object({ folder: StorageFolderSchema })
export type OpenFolder = z.infer<typeof OpenFolderSchema>
