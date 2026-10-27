import {
  notFound,
  ok,
  type CreateSectionCommand,
  type Result,
  type UpdateSectionInput,
} from '@inspiratio/shared'
import { findById, removeById, upsert } from '../../../shared/lib/collections.ts'
import type { Clock, IdGenerator } from '../../../shared/lib/runtime.ts'
import type { LibraryStore } from '../../../shared/persistence/library-store.ts'
import { detachFromSection } from '../../items/domain/item.ts'
import { createSection, updateSection } from '../domain/section.ts'

export type SectionDeps = {
  readonly store: LibraryStore
  readonly clock: Clock
  readonly newId: IdGenerator
}

export const createSectionCommands = (deps: SectionDeps) => {
  const exists = (id: string): boolean =>
    findById({ list: deps.store.read().sections, id }) !== undefined

  const create = async (input: CreateSectionCommand): Promise<Result<{ readonly id: string }>> => {
    const section = createSection({ id: deps.newId({ prefix: 'sec' }), now: deps.clock(), input })
    await deps.store.update((state) => ({ ...state, sections: [...state.sections, section] }))
    return ok({ id: section.id })
  }

  const update = async (params: {
    readonly id: string
    readonly patch: UpdateSectionInput
  }): Promise<Result<undefined>> => {
    if (!exists(params.id)) return notFound({ entity: 'Section', id: params.id })
    await deps.store.update((state) => {
      const section = findById({ list: state.sections, id: params.id })
      if (section === undefined) return state
      const entity = updateSection({ section, patch: params.patch, now: deps.clock() })
      return { ...state, sections: upsert({ list: state.sections, entity }) }
    })
    return ok(undefined)
  }

  /** Removing a section keeps its items on the board at the same on-screen position. */
  const remove = async (params: { readonly id: string }): Promise<Result<undefined>> => {
    if (!exists(params.id)) return notFound({ entity: 'Section', id: params.id })
    await deps.store.update((state) => {
      const section = findById({ list: state.sections, id: params.id })
      if (section === undefined) return state
      return {
        ...state,
        sections: removeById({ list: state.sections, id: params.id }),
        items: detachFromSection({ items: state.items, section, now: deps.clock() }),
      }
    })
    return ok(undefined)
  }

  return { create, update, remove }
}

export type SectionCommands = ReturnType<typeof createSectionCommands>
