import type { Item, ItemOrigin } from '@inspiratio/shared'

export type MetadataRow = {
  readonly label: string
  readonly value: string
  readonly href?: string
}

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const formatDate = (iso: string): string => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

const ORIGIN_LABEL: Readonly<Record<ItemOrigin, string>> = {
  upload: 'Uploaded',
  url: 'Imported from the web',
  generated: 'AI generated',
  file: 'Imported from disk',
}

export const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Read-only facts shown in the inspector, in display order. */
export const metadataRows = (item: Item): MetadataRow[] => {
  const { media, metadata } = item
  const rows: MetadataRow[] = [
    { label: 'Type', value: `${item.kind} · ${media.mimeType.split('/')[1] ?? media.mimeType}` },
    {
      label: 'Dimensions',
      value:
        media.width !== null && media.height !== null
          ? `${media.width} × ${media.height}`
          : 'Unknown',
    },
    { label: 'File size', value: formatBytes(media.bytes) },
    { label: 'Origin', value: ORIGIN_LABEL[metadata.origin] },
  ]
  if (metadata.sourceUrl !== null)
    rows.push({ label: 'Source', value: hostOf(metadata.sourceUrl), href: metadata.sourceUrl })
  if (metadata.originalFileName !== null)
    rows.push({ label: 'Original file', value: metadata.originalFileName })
  rows.push(
    { label: 'Added', value: formatDate(metadata.createdAt) },
    { label: 'Updated', value: formatDate(metadata.updatedAt) },
  )
  return rows
}
