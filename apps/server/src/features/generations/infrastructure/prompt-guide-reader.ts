import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DEFAULT_GUIDE, guideCandidatesOf, guideFileOf } from '../domain/generation.ts'

export type GuideContent = { readonly guide: string; readonly content: string }

/** Port: the prompt guide for a model, falling back to the default guide; never fails. */
export type PromptGuideReader = (params: { readonly model: string }) => Promise<GuideContent>

const firstGuide = async (params: {
  readonly model: string
  readonly read: (guide: string) => Promise<string | undefined>
}): Promise<GuideContent> => {
  for (const guide of guideCandidatesOf({ model: params.model })) {
    const content = await params.read(guide)
    if (content !== undefined) return { guide, content }
  }
  return { guide: DEFAULT_GUIDE, content: '' }
}

/** Reads `<dir>/<model>.md` on every call, so edited guides apply to the next request. */
export const createFsPromptGuideReader =
  (params: { readonly dir: string }): PromptGuideReader =>
  ({ model }) =>
    firstGuide({
      model,
      read: (guide) =>
        readFile(join(params.dir, guideFileOf({ guide })), 'utf8').catch(() => undefined),
    })

export const createMemoryPromptGuideReader =
  (params: { readonly guides: Readonly<Record<string, string>> }): PromptGuideReader =>
  ({ model }) =>
    firstGuide({ model, read: (guide) => Promise.resolve(params.guides[guide]) })
