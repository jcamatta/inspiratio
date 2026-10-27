import { err, ok, type Result } from '@inspiratio/shared'

export type FetchFn = typeof fetch

export type RemoteMedia = {
  readonly bytes: Uint8Array
  readonly finalUrl: string
}

const META_PATTERN = /<meta\s+[^>]*>/gi
const ATTRIBUTE_PATTERN = /([a-z:-]+)\s*=\s*("([^"]*)"|'([^']*)')/gi
const MEDIA_META_KEYS = [
  'og:video:secure_url',
  'og:video',
  'og:image:secure_url',
  'og:image',
  'twitter:image',
]

const parseAttributes = (tag: string): Map<string, string> => {
  const attributes = new Map<string, string>()
  for (const match of tag.matchAll(ATTRIBUTE_PATTERN)) {
    const name = match[1]?.toLowerCase()
    const value = match[3] ?? match[4]
    if (name !== undefined && value !== undefined) attributes.set(name, value)
  }
  return attributes
}

const decodeEntities = (value: string): string =>
  value.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'")

/**
 * When a user drops a page link (Pinterest pin, Cosmos element, film-still site), the page's
 * Open Graph tags usually point at the actual media. Video wins over image when both exist.
 */
export const extractOpenGraphMedia = (params: {
  readonly html: string
  readonly baseUrl: string
}): string | null => {
  const found = new Map<string, string>()
  for (const tag of params.html.match(META_PATTERN) ?? []) {
    const attributes = parseAttributes(tag)
    const key = (attributes.get('property') ?? attributes.get('name'))?.toLowerCase()
    const content = attributes.get('content')
    if (key !== undefined && content !== undefined && !found.has(key)) found.set(key, content)
  }
  const raw = MEDIA_META_KEYS.map((key) => found.get(key)).find((value) => value !== undefined)
  if (raw === undefined) return null
  try {
    return new URL(decodeEntities(raw), params.baseUrl).toString()
  } catch {
    return null
  }
}

const isHtml = (contentType: string | null): boolean => contentType?.includes('text/html') ?? false

const download = async (params: {
  readonly url: string
  readonly fetchFn: FetchFn
  readonly maxBytes: number
  readonly timeoutMs: number
}): Promise<Result<{ readonly response: Response; readonly bytes: Uint8Array }>> => {
  try {
    const response = await params.fetchFn(params.url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(params.timeoutMs),
      headers: { 'user-agent': 'Mozilla/5.0 (Inspiratio reference importer)', accept: '*/*' },
    })
    if (!response.ok)
      return err({ code: 'upstream', message: `Download failed with HTTP ${response.status}` })
    const declared = Number(response.headers.get('content-length') ?? '0')
    if (declared > params.maxBytes)
      return err({ code: 'validation', message: 'Remote file exceeds the size limit' })
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > params.maxBytes)
      return err({ code: 'validation', message: 'Remote file exceeds the size limit' })
    return ok({ response, bytes })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return err({ code: 'upstream', message: `Download failed: ${message}` })
  }
}

/** Downloads a media URL, following one level of HTML → Open Graph indirection. */
export const fetchRemoteMedia = async (params: {
  readonly url: string
  readonly fetchFn: FetchFn
  readonly maxBytes: number
  readonly timeoutMs: number
}): Promise<Result<RemoteMedia>> => {
  const first = await download(params)
  if (!first.ok) return first
  const finalUrl = first.value.response.url === '' ? params.url : first.value.response.url
  if (!isHtml(first.value.response.headers.get('content-type')))
    return ok({ bytes: first.value.bytes, finalUrl })

  const html = new TextDecoder().decode(first.value.bytes)
  const mediaUrl = extractOpenGraphMedia({ html, baseUrl: finalUrl })
  if (mediaUrl === null)
    return err({ code: 'unsupported_media', message: 'The page does not expose an image or video' })
  const second = await download({ ...params, url: mediaUrl })
  return second.ok ? ok({ bytes: second.value.bytes, finalUrl: mediaUrl }) : second
}
