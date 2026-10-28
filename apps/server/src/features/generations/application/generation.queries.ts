import {
  notFound,
  ok,
  resolveOptions,
  type GenerationDetails,
  type GenerationRequest,
  type ListGenerationsInput,
  type Result,
} from '@inspiratio/shared'
import { findById } from '../../../shared/lib/collections.ts'
import { sortBy } from '../../../shared/lib/compare.ts'
import type { MediaStorage } from '../../../shared/media/media-storage.ts'
import type { UploadPreparer } from '../../../shared/media/upload-copy.ts'
import type { LibraryStore } from '../../../shared/persistence/library-store.ts'
import { resolvedModelOf, resolveReferences } from '../domain/generation.ts'
import type { PromptGuideReader } from '../infrastructure/prompt-guide-reader.ts'

export const createGenerationQueries = (deps: {
  readonly store: LibraryStore
  readonly storage: MediaStorage
  readonly prepareUpload: UploadPreparer
  readonly readPromptGuide: PromptGuideReader
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

  const details = async (params: { readonly id: string }): Promise<Result<GenerationDetails>> => {
    const state = deps.store.read()
    const request = findById({ list: state.generations, id: params.id })
    if (request === undefined) return notFound({ entity: 'Generation', id: params.id })
    const references = resolveReferences({
      request,
      items: state.items,
      tags: state.tags,
      absolutePathOf: deps.storage.absolutePathOf,
    })
    const resolvedReferences = await Promise.all(
      references.map(async (reference) => {
        const upload = await deps.prepareUpload(reference)
        return { ...reference, uploadPath: upload.path, uploadMimeType: upload.mimeType }
      }),
    )
    const model = resolvedModelOf(request)
    const guide = await deps.readPromptGuide({ model })
    return ok({
      ...request,
      resolvedReferences,
      promptGuide: { model, ...guide },
      resolvedOptions: resolveOptions({ model, options: request.options }),
    })
  }

  return { list, details }
}

export type GenerationQueries = ReturnType<typeof createGenerationQueries>
