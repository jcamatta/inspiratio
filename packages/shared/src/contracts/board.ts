import { z } from 'zod'
import { GenerationRequestSchema } from './generation.ts'
import { ItemSchema } from './item.ts'
import { SectionSchema } from './section.ts'
import { TagSchema } from './tag.ts'

export const BoardSnapshotSchema = z.object({
  items: z.array(ItemSchema),
  tags: z.array(TagSchema),
  sections: z.array(SectionSchema),
})
export type BoardSnapshot = z.infer<typeof BoardSnapshotSchema>

export const LibraryStateSchema = BoardSnapshotSchema.extend({
  version: z.literal(1),
  generations: z.array(GenerationRequestSchema),
  trash: z.array(ItemSchema).default([]),
})
export type LibraryState = z.infer<typeof LibraryStateSchema>

export const emptyLibraryState = (): LibraryState => ({
  version: 1,
  items: [],
  tags: [],
  sections: [],
  generations: [],
  trash: [],
})

export const CreatedSchema = z.object({ id: z.string() })
export type Created = z.infer<typeof CreatedSchema>

export const CreatedManySchema = z.object({ ids: z.array(z.string()) })
export type CreatedMany = z.infer<typeof CreatedManySchema>

export const ApiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), traceId: z.string().nullable() }),
})
export type ApiError = z.infer<typeof ApiErrorSchema>
