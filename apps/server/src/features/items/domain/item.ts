import type {
  GenerationInfo,
  Item,
  ItemKind,
  ItemOrigin,
  LayoutChange,
  SearchItemsInput,
  Section,
  Size,
  Tag,
  UpdateItemInput,
  Vec2,
} from '@inspiratio/shared'
import { INITIAL_EDGE } from '@inspiratio/shared'
import { findById, unique } from '../../../shared/lib/collections.ts'

export { INITIAL_EDGE } from '@inspiratio/shared'
export const PLACEMENT_GAP = 48

export const initialSize = (params: {
  readonly width: number | null
  readonly height: number | null
  readonly kind: ItemKind
}): Size => {
  const width = params.width ?? (params.kind === 'video' ? 16 : 1)
  const height = params.height ?? (params.kind === 'video' ? 9 : 1)
  const scale = INITIAL_EDGE / Math.max(width, height)
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

const stripExtension = (name: string): string => name.replace(/\.[a-z0-9]{2,5}$/i, '')

const lastPathSegment = (url: string): string => {
  try {
    const segments = new URL(url).pathname.split('/').filter((segment) => segment !== '')
    return decodeURIComponent(segments.at(-1) ?? '')
  } catch {
    return ''
  }
}

export const titleFromSource = (params: {
  readonly title: string | undefined
  readonly originalFileName: string | null
  readonly sourceUrl: string | null
}): string => {
  const candidates = [
    params.title,
    params.originalFileName === null ? undefined : stripExtension(params.originalFileName),
    params.sourceUrl === null ? undefined : stripExtension(lastPathSegment(params.sourceUrl)),
  ]
  const found = candidates.map((value) => value?.trim()).find((value) => (value ?? '') !== '')
  return (found ?? 'Untitled').slice(0, 200)
}

export const nextZIndex = (items: readonly Item[]): number =>
  Math.max(0, ...items.map((item) => item.zIndex)) + 1

/** Free spot to the right of everything on the board, used when no drop position is given. */
export const nextFreePosition = (items: readonly Item[]): Vec2 => {
  const roots = items.filter((item) => item.sectionId === null)
  if (roots.length === 0) return { x: 0, y: 0 }
  const right = Math.max(...roots.map((item) => item.position.x + item.size.width))
  const top = Math.min(...roots.map((item) => item.position.y))
  return { x: right + PLACEMENT_GAP, y: top }
}

export type NewItem = {
  readonly id: string
  readonly now: string
  readonly kind: ItemKind
  readonly fileName: string
  readonly mimeType: string
  readonly bytes: number
  readonly width: number | null
  readonly height: number | null
  readonly title: string
  readonly position: Vec2
  readonly sectionId: string | null
  readonly zIndex: number
  readonly origin: ItemOrigin
  readonly sourceUrl: string | null
  readonly originalFileName: string | null
  readonly tagIds: readonly string[]
  readonly generation: GenerationInfo | null
}

export const createItem = (params: NewItem): Item => ({
  id: params.id,
  kind: params.kind,
  title: params.title,
  media: {
    fileName: params.fileName,
    mimeType: params.mimeType,
    bytes: params.bytes,
    width: params.width,
    height: params.height,
  },
  position: params.position,
  size: initialSize({ width: params.width, height: params.height, kind: params.kind }),
  zIndex: params.zIndex,
  sectionId: params.sectionId,
  tagIds: unique(params.tagIds),
  metadata: {
    createdAt: params.now,
    updatedAt: params.now,
    origin: params.origin,
    sourceUrl: params.sourceUrl,
    originalFileName: params.originalFileName,
    notes: '',
    generation: params.generation,
  },
})

const touch = (params: { readonly item: Item; readonly now: string }): Item => ({
  ...params.item,
  metadata: { ...params.item.metadata, updatedAt: params.now },
})

export const updateItem = (params: {
  readonly item: Item
  readonly patch: UpdateItemInput
  readonly now: string
}): Item =>
  touch({
    item: {
      ...params.item,
      title: params.patch.title ?? params.item.title,
      zIndex: params.patch.zIndex ?? params.item.zIndex,
      metadata: {
        ...params.item.metadata,
        notes: params.patch.notes ?? params.item.metadata.notes,
      },
    },
    now: params.now,
  })

export const applyLayoutChange = (params: {
  readonly item: Item
  readonly change: LayoutChange
  readonly now: string
}): Item =>
  touch({
    item: {
      ...params.item,
      position: params.change.position ?? params.item.position,
      size: params.change.size ?? params.item.size,
      sectionId:
        params.change.sectionId === undefined ? params.item.sectionId : params.change.sectionId,
    },
    now: params.now,
  })

export const setItemTags = (params: {
  readonly item: Item
  readonly tagIds: readonly string[]
  readonly now: string
}): Item => touch({ item: { ...params.item, tagIds: unique(params.tagIds) }, now: params.now })

/**
 * Stores intrinsic dimensions reported by the browser (videos cannot be probed server side)
 * and fixes the on-canvas height so the item keeps the media's aspect ratio.
 */
export const withMediaDimensions = (params: {
  readonly item: Item
  readonly width: number
  readonly height: number
  readonly now: string
}): Item =>
  touch({
    item: {
      ...params.item,
      media: { ...params.item.media, width: params.width, height: params.height },
      size: {
        width: params.item.size.width,
        height: Math.max(24, Math.round((params.item.size.width * params.height) / params.width)),
      },
    },
    now: params.now,
  })

export const stripTag = (params: {
  readonly items: readonly Item[]
  readonly tagId: string
  readonly now: string
}): Item[] =>
  params.items.map((item) =>
    item.tagIds.includes(params.tagId)
      ? setItemTags({
          item,
          tagIds: item.tagIds.filter((id) => id !== params.tagId),
          now: params.now,
        })
      : item,
  )

/** Children of a removed section keep their on-screen place: relative → absolute. */
export const detachFromSection = (params: {
  readonly items: readonly Item[]
  readonly section: Section
  readonly now: string
}): Item[] =>
  params.items.map((item) =>
    item.sectionId === params.section.id
      ? applyLayoutChange({
          item,
          change: {
            id: item.id,
            sectionId: null,
            position: {
              x: params.section.position.x + item.position.x,
              y: params.section.position.y + item.position.y,
            },
          },
          now: params.now,
        })
      : item,
  )

export const absolutePositionOf = (params: {
  readonly item: Item
  readonly sections: readonly Section[]
}): Vec2 => {
  const section =
    params.item.sectionId === null
      ? undefined
      : findById({ list: params.sections, id: params.item.sectionId })
  return section === undefined
    ? params.item.position
    : {
        x: section.position.x + params.item.position.x,
        y: section.position.y + params.item.position.y,
      }
}

export const tagNamesOf = (params: {
  readonly item: Item
  readonly tags: readonly Tag[]
}): string[] =>
  params.item.tagIds
    .map((id) => findById({ list: params.tags, id })?.name)
    .filter((name): name is string => name !== undefined)

export const matchesSearch = (params: {
  readonly item: Item
  readonly tags: readonly Tag[]
  readonly criteria: SearchItemsInput
}): boolean => {
  const { criteria, item } = params
  const names = tagNamesOf({ item, tags: params.tags }).map((name) => name.toLowerCase())
  const text = criteria.text?.toLowerCase() ?? ''
  const haystack = [
    item.title,
    item.metadata.notes,
    item.metadata.generation?.prompt ?? '',
    ...names,
  ]
    .join(' ')
    .toLowerCase()
  const kindMatches = criteria.kind === undefined || item.kind === criteria.kind
  const textMatches = text === '' || haystack.includes(text)
  const tagsMatch = (criteria.tags ?? []).every((tag) => names.includes(tag.toLowerCase()))
  return kindMatches && textMatches && tagsMatch
}
