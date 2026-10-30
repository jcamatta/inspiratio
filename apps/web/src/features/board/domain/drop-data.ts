/** Ids carried when a node is dragged into the prompt: the whole selection if it is part of it. */
export const dragPayload = (params: {
  readonly id: string
  readonly selection: readonly string[]
}): string[] => (params.selection.includes(params.id) ? [...params.selection] : [params.id])

export const isImportableUrl = (value: string): boolean => {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** MIME type used when dragging canvas items into the prompt composer. */
export const ITEM_DRAG_TYPE = 'application/x-inspiratio-items'

/** Plain snapshot of a DataTransfer / ClipboardData so parsing stays pure and testable. */
export type TransferSnapshot = {
  readonly files: readonly File[]
  readonly uriList: string
  readonly html: string
  readonly text: string
  readonly items: string
}

export type DropPayload =
  | { readonly kind: 'files'; readonly files: File[] }
  | { readonly kind: 'urls'; readonly urls: string[] }
  | { readonly kind: 'items'; readonly itemIds: string[] }
  | { readonly kind: 'none' }

const MEDIA_FILE = /^(image|video|audio)\//

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** Google Images and similar wrap the real URL in a redirect (`/imgres?imgurl=…`). */
export const unwrapRedirect = (value: string): string => {
  try {
    const url = new URL(value)
    const wrapped =
      url.searchParams.get('imgurl') ??
      url.searchParams.get('mediaurl') ??
      url.searchParams.get('url')
    return wrapped !== null && isHttpUrl(wrapped) ? wrapped : value
  } catch {
    return value
  }
}

const SRC_PATTERN = /<(?:img|video|audio|source)\b[^>]*?\ssrc\s*=\s*["']([^"']+)["']/gi

/** Dragging an image out of a web page carries an HTML fragment whose <img src> is the media. */
export const extractMediaSources = (html: string): string[] =>
  [...html.matchAll(SRC_PATTERN)]
    .map((match) => (match[1] ?? '').replaceAll('&amp;', '&'))
    .filter(isHttpUrl)

export const parseUriList = (uriList: string): string[] =>
  uriList
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .filter(isHttpUrl)

export const parseItemIds = (raw: string): string[] => {
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : []
  } catch {
    return []
  }
}

const unique = (values: readonly string[]): string[] => [...new Set(values)]

/** Priority: internal items › media files › page media (<img src>) › links › plain-text URL. */
export const parseTransfer = (snapshot: TransferSnapshot): DropPayload => {
  const itemIds = parseItemIds(snapshot.items)
  if (itemIds.length > 0) return { kind: 'items', itemIds }
  const files = snapshot.files.filter((file) => MEDIA_FILE.test(file.type))
  if (files.length > 0) return { kind: 'files', files }
  const fromHtml = extractMediaSources(snapshot.html)
  const fromList = parseUriList(snapshot.uriList)
  const fromText = isHttpUrl(snapshot.text.trim()) ? [snapshot.text.trim()] : []
  const urls = unique(
    (fromHtml.length > 0 ? fromHtml : [...fromList, ...fromText]).map(unwrapRedirect),
  )
  return urls.length > 0 ? { kind: 'urls', urls } : { kind: 'none' }
}

export const snapshotTransfer = (transfer: DataTransfer | null): TransferSnapshot => ({
  files: Array.from(transfer?.files ?? []),
  uriList: transfer?.getData('text/uri-list') ?? '',
  html: transfer?.getData('text/html') ?? '',
  text: transfer?.getData('text/plain') ?? '',
  items: transfer?.getData(ITEM_DRAG_TYPE) ?? '',
})
