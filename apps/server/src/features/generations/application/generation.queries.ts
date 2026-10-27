import {
  notFound,
  ok,
  type GenerationDetails,
  type GenerationRequest,
  type ListGenerationsInput,
  type Result,
} from '@inspiratio/shared'
import { findById } from '../../../shared/lib/collections.ts'
import { sortBy } from '../../../shared/lib/compare.ts'
import type { MediaStorage } from '../../../shared/media/media-storage.ts'
import type { LibraryStore } from '../../../shared/persistence/library-store.ts'
import { resolveReferences } from '../domain/generation.ts'

export const createGenerationQueries = (deps: {
  readonly store: LibraryStore
  readonly storage: MediaStorage
}) => {
  /** Newest first. */
  const list = (input: ListGenerationsInput): GenerationRequest[] =>
    sortBy({
      values: deps.store
        .read()
        .generations.filter(
          (request) => input.status === undefined || request.status === input.status,
        ),
      key: (request) => request.createdAt,
    }).reverse()

  const details = (params: { readonly id: string }): Result<GenerationDetails> => {
    const state = deps.store.read()
    const request = findById({ list: state.generations, id: params.id })
    if (request === undefined) return notFound({ entity: 'Generation', id: params.id })
    return ok({
      ...request,
      resolvedReferences: resolveReferences({
        request,
        items: state.items,
        tags: state.tags,
        absolutePathOf: deps.storage.absolutePathOf,
      }),
    })
  }

  return { list, details }
}

export type GenerationQueries = ReturnType<typeof createGenerationQueries>
