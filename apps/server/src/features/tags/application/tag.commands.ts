import {
  err,
  notFound,
  ok,
  type CreateTagInput,
  type Result,
  type Tag,
  type UpdateTagInput,
} from '@inspiratio/shared'
import { findById, removeById, upsert } from '../../../shared/lib/collections.ts'
import type { Clock, IdGenerator } from '../../../shared/lib/runtime.ts'
import type { Logger } from '../../../shared/logging/logger.ts'
import type { LibraryStore } from '../../../shared/persistence/library-store.ts'
import { stripTag } from '../../items/domain/item.ts'
import { createTag, findTagByName, isNameTaken, pickTagColor, updateTag } from '../domain/tag.ts'

export type TagDeps = {
  readonly store: LibraryStore
  readonly clock: Clock
  readonly newId: IdGenerator
  readonly logger: Logger
}

export const createTagCommands = (deps: TagDeps) => {
  /** Idempotent: creating an existing name (case-insensitive) returns the existing tag id. */
  const create = async (input: CreateTagInput): Promise<Result<{ readonly id: string }>> => {
    let id = ''
    await deps.store.update((state) => {
      const existing = findTagByName({ tags: state.tags, name: input.name })
      if (existing !== undefined) {
        id = existing.id
        return state
      }
      const tag = createTag({
        id: deps.newId({ prefix: 'tag' }),
        name: input.name,
        color: input.color ?? pickTagColor(state.tags),
        system: false,
        now: deps.clock(),
      })
      id = tag.id
      return { ...state, tags: [...state.tags, tag] }
    })
    return ok({ id })
  }

  const update = async (params: {
    readonly id: string
    readonly input: UpdateTagInput
  }): Promise<Result<undefined>> => {
    const state = deps.store.read()
    const tag = findById({ list: state.tags, id: params.id })
    if (tag === undefined) return notFound({ entity: 'Tag', id: params.id })
    const { name, color } = params.input
    if (name !== undefined && isNameTaken({ tags: state.tags, name, exceptId: tag.id }))
      return err({ code: 'conflict', message: `A tag named "${name}" already exists` })
    await deps.store.update((current) => {
      const latest = findById({ list: current.tags, id: params.id })
      if (latest === undefined) return current
      const entity: Tag = updateTag({ tag: latest, name, color })
      return { ...current, tags: upsert({ list: current.tags, entity }) }
    })
    return ok(undefined)
  }

  /** Deleting a tag also removes it from every item that carried it. */
  const remove = async (params: { readonly id: string }): Promise<Result<undefined>> => {
    if (findById({ list: deps.store.read().tags, id: params.id }) === undefined)
      return notFound({ entity: 'Tag', id: params.id })
    await deps.store.update((state) => ({
      ...state,
      tags: removeById({ list: state.tags, id: params.id }),
      items: stripTag({ items: state.items, tagId: params.id, now: deps.clock() }),
    }))
    deps.logger.info({ msg: 'tag.removed', tagId: params.id })
    return ok(undefined)
  }

  return { create, update, remove }
}

export type TagCommands = ReturnType<typeof createTagCommands>
