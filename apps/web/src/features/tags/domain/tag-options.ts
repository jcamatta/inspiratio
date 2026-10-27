import type { Item, Tag } from '@inspiratio/shared'
import { createOptionId, parseCreateOption } from '../../../shared/lib/create-option.ts'
import type { ChipOption } from '../../../shared/ui/tags.tsx'

export const toChipOptions = (tags: readonly Tag[]): ChipOption[] =>
  tags.map((tag) => ({ id: tag.id, name: tag.name, color: tag.color, system: tag.system }))

const normalize = (name: string): string => name.trim().replace(/\s+/g, ' ')

/** Ids listed in the combobox: every tag, plus a "Create …" entry when the text is new. */
export const listIdsFor = (params: {
  readonly tags: readonly Tag[]
  readonly inputValue: string
  readonly creatable: boolean
}): string[] => {
  const typed = normalize(params.inputValue)
  const ids = params.tags.map((tag) => tag.id)
  const exists = params.tags.some((tag) => tag.name.toLowerCase() === typed.toLowerCase())
  return params.creatable && typed !== '' && !exists ? [...ids, createOptionId(typed)] : ids
}

export const labelFor = (params: {
  readonly tags: readonly Tag[]
  readonly id: string
}): string => {
  const creating = parseCreateOption(params.id)
  if (creating !== null) return `Create "${creating}"`
  return params.tags.find((tag) => tag.id === params.id)?.name ?? params.id
}

export type SelectionSplit = { readonly existing: string[]; readonly toCreate: string[] }

/** Separates real tag ids from "create" sentinels picked in the combobox. */
export const splitSelection = (ids: readonly string[]): SelectionSplit => ({
  existing: ids.filter((id) => parseCreateOption(id) === null),
  toCreate: ids.map(parseCreateOption).filter((name): name is string => name !== null),
})

/** Tags shared by every item in a multi-selection. */
export const commonTagIds = (items: readonly Item[]): string[] => {
  const [first, ...rest] = items
  if (first === undefined) return []
  return first.tagIds.filter((id) => rest.every((item) => item.tagIds.includes(id)))
}

/**
 * Applies a bulk edit made on the shared tags of a selection: added tags go to every item,
 * removed ones are taken from every item, other tags are left untouched.
 */
export const bulkTagUpdates = (params: {
  readonly items: readonly Item[]
  readonly previous: readonly string[]
  readonly next: readonly string[]
}): { readonly id: string; readonly tagIds: string[] }[] => {
  const added = params.next.filter((id) => !params.previous.includes(id))
  const removed = params.previous.filter((id) => !params.next.includes(id))
  return params.items
    .map((item) => ({
      id: item.id,
      tagIds: [...new Set([...item.tagIds.filter((id) => !removed.includes(id)), ...added])],
      before: item.tagIds,
    }))
    .filter(
      (update) =>
        update.tagIds.length !== update.before.length ||
        update.tagIds.some((id) => !update.before.includes(id)),
    )
    .map((update) => ({ id: update.id, tagIds: update.tagIds }))
}
