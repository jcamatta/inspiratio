import { SYSTEM_TAGS, TAG_COLORS, type Tag, type TagColor } from '@inspiratio/shared'
import type { IdGenerator } from '../../../shared/lib/runtime.ts'

export const normalizeTagName = (name: string): string => name.trim().replace(/\s+/g, ' ')

const sameName = (params: { readonly left: string; readonly right: string }): boolean =>
  normalizeTagName(params.left).toLowerCase() === normalizeTagName(params.right).toLowerCase()

export const findTagByName = (params: {
  readonly tags: readonly Tag[]
  readonly name: string
}): Tag | undefined => params.tags.find((tag) => sameName({ left: tag.name, right: params.name }))

export const isNameTaken = (params: {
  readonly tags: readonly Tag[]
  readonly name: string
  readonly exceptId: string
}): boolean =>
  params.tags.some(
    (tag) => tag.id !== params.exceptId && sameName({ left: tag.name, right: params.name }),
  )

/** Rotates through the palette so neighbouring tags are visually distinct. */
export const pickTagColor = (tags: readonly Tag[]): TagColor =>
  TAG_COLORS[tags.length % TAG_COLORS.length] ?? 'mint'

export const createTag = (params: {
  readonly id: string
  readonly name: string
  readonly color: TagColor
  readonly system: boolean
  readonly now: string
}): Tag => ({
  id: params.id,
  name: normalizeTagName(params.name),
  color: params.color,
  system: params.system,
  createdAt: params.now,
})

export const updateTag = (params: {
  readonly tag: Tag
  readonly name: string | undefined
  readonly color: TagColor | undefined
}): Tag => ({
  ...params.tag,
  name: params.name === undefined ? params.tag.name : normalizeTagName(params.name),
  color: params.color ?? params.tag.color,
})

/** Resolves names to tag ids, creating the missing tags. Matching is case-insensitive. */
export const ensureTags = (params: {
  readonly tags: readonly Tag[]
  readonly names: readonly string[]
  readonly system: boolean
  readonly now: string
  readonly newId: IdGenerator
}): { readonly tags: Tag[]; readonly ids: string[] } => {
  const tags = [...params.tags]
  const ids: string[] = []
  for (const name of params.names) {
    const existing = findTagByName({ tags, name })
    const tag =
      existing ??
      createTag({
        id: params.newId({ prefix: 'tag' }),
        name,
        color: params.system ? 'coral' : pickTagColor(tags),
        system: params.system,
        now: params.now,
      })
    if (existing === undefined) tags.push(tag)
    if (!ids.includes(tag.id)) ids.push(tag.id)
  }
  return { tags, ids }
}

const slug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** The fixed tags every AI result receives: origin, provider and model. */
export const generatedTagNames = (params: {
  readonly provider: string
  readonly model: string
}): string[] => [
  SYSTEM_TAGS.aiGenerated,
  `${SYSTEM_TAGS.providerPrefix}${slug(params.provider)}`,
  `${SYSTEM_TAGS.modelPrefix}${slug(params.model)}`,
]
