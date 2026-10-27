import { z } from 'zod'
import { IdSchema } from './geometry.ts'

export const TAG_COLORS = ['mint', 'coral', 'sky', 'amber', 'violet', 'slate'] as const
export const TagColorSchema = z.enum(TAG_COLORS)
export type TagColor = z.infer<typeof TagColorSchema>

export const TagNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(48)
  .transform((name) => name.replace(/\s+/g, ' '))

export const TagSchema = z.object({
  id: IdSchema,
  name: z.string(),
  color: TagColorSchema,
  /** System tags are created by the app (e.g. ai-generated) and flagged in the UI. */
  system: z.boolean(),
  createdAt: z.string(),
})
export type Tag = z.infer<typeof TagSchema>

export const CreateTagSchema = z.object({
  name: TagNameSchema,
  color: TagColorSchema.optional(),
})
export type CreateTagInput = z.input<typeof CreateTagSchema>

export const UpdateTagSchema = z
  .object({ name: TagNameSchema.optional(), color: TagColorSchema.optional() })
  .refine((patch) => patch.name !== undefined || patch.color !== undefined, {
    message: 'Nothing to update',
  })
export type UpdateTagInput = z.input<typeof UpdateTagSchema>

/** Fixed tags the generation pipeline applies to AI results. */
export const SYSTEM_TAGS = {
  aiGenerated: 'ai-generated',
  modelPrefix: 'model:',
  providerPrefix: 'by:',
} as const
