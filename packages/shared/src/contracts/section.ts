import { z } from 'zod'
import { IdSchema, SizeSchema, Vec2Schema } from './geometry.ts'
import { TagColorSchema } from './tag.ts'

export const SectionSchema = z.object({
  id: IdSchema,
  title: z.string(),
  position: Vec2Schema,
  size: SizeSchema,
  color: TagColorSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Section = z.infer<typeof SectionSchema>

export const SectionTitleSchema = z.string().trim().max(120)

export const CreateSectionSchema = z.object({
  title: SectionTitleSchema.default('Untitled section'),
  position: Vec2Schema,
  size: SizeSchema.default({ width: 640, height: 420 }),
  color: TagColorSchema.default('mint'),
})
export type CreateSectionInput = z.input<typeof CreateSectionSchema>
export type CreateSectionCommand = z.output<typeof CreateSectionSchema>

export const UpdateSectionSchema = z.object({
  title: SectionTitleSchema.optional(),
  position: Vec2Schema.optional(),
  size: SizeSchema.optional(),
  color: TagColorSchema.optional(),
})
export type UpdateSectionInput = z.infer<typeof UpdateSectionSchema>
