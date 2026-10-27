import {
  mediaUrlOf,
  notFound,
  ok,
  type BoardSnapshot,
  type Item,
  type Result,
  type SearchItemsInput,
} from '@inspiratio/shared'
import { findById } from '../../../shared/lib/collections.ts'
import { sortBy } from '../../../shared/lib/compare.ts'
import type { LibraryStore } from '../../../shared/persistence/library-store.ts'
import type { MediaStorage } from '../../../shared/media/media-storage.ts'
import { matchesSearch, tagNamesOf } from '../domain/item.ts'

/** An item enriched for agents: resolved tag names, the file on disk and its HTTP URL. */
export type ItemView = Item & {
  readonly tagNames: string[]
  readonly absolutePath: string
  readonly mediaUrl: string
}

/** Queries never mutate; they read the current snapshot and project it. */
export const createItemQueries = (deps: {
  readonly store: LibraryStore
  readonly storage: MediaStorage
}) => {
  const toView = (item: Item): ItemView => ({
    ...item,
    tagNames: tagNamesOf({ item, tags: deps.store.read().tags }),
    absolutePath: deps.storage.absolutePathOf(item.media.fileName),
    mediaUrl: mediaUrlOf(item.media),
  })

  const board = (): BoardSnapshot => {
    const state = deps.store.read()
    return {
      items: sortBy({ values: state.items, key: (item) => item.zIndex }),
      tags: sortBy({ values: state.tags, key: (tag) => tag.name.toLowerCase() }),
      sections: state.sections,
    }
  }

  const search = (criteria: SearchItemsInput): ItemView[] => {
    const state = deps.store.read()
    return state.items
      .filter((item) => matchesSearch({ item, tags: state.tags, criteria }))
      .map(toView)
  }

  const byId = (params: { readonly id: string }): Result<ItemView> => {
    const item = findById({ list: deps.store.read().items, id: params.id })
    return item === undefined ? notFound({ entity: 'Item', id: params.id }) : ok(toView(item))
  }

  return { board, search, byId }
}

export type ItemQueries = ReturnType<typeof createItemQueries>
