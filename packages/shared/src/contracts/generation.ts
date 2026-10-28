import { z } from 'zod'
import { IdSchema, SizeSchema, Vec2Schema } from './geometry.ts'
import { ItemKindSchema } from './item.ts'

export const GenerationKindSchema = ItemKindSchema
export type GenerationKind = z.infer<typeof GenerationKindSchema>

export const GENERATION_STATUSES = [
  'draft',
  'pending',
  'in_progress',
  'completed',
  'failed',
] as const
export const GenerationStatusSchema = z.enum(GENERATION_STATUSES)
export type GenerationStatus = z.infer<typeof GenerationStatusSchema>

export const MAX_REFERENCES = 14

export const GenerationReferenceSchema = z.object({
  itemId: IdSchema,
  /** Token used inside the prompt, e.g. "@1". */
  label: z.string(),
})
export type GenerationReference = z.infer<typeof GenerationReferenceSchema>

/** One phase of an agent run, e.g. "Uploading references"; endedAt is null while it runs. */
export const GenerationStepSchema = z.object({
  label: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
})
export type GenerationStep = z.infer<typeof GenerationStepSchema>

export const GenerationRequestSchema = z.object({
  id: IdSchema,
  prompt: z.string(),
  kind: GenerationKindSchema,
  model: z.string().nullable(),
  aspectRatio: z.string().nullable(),
  count: z.number().int().min(1).max(4),
  references: z.array(GenerationReferenceSchema),
  status: GenerationStatusSchema,
  traceId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  resultItemIds: z.array(IdSchema),
  error: z.string().nullable(),
  /** Where the prompt card sits on the canvas. */
  position: Vec2Schema.default({ x: 0, y: 0 }),
  /** Card size after a resize; null keeps the default width and fits the content. */
  size: SizeSchema.nullable().default(null),
  /** Latest status line reported by the agent while it works on the request. */
  progress: z.string().nullable().default(null),
  /** When the request was last queued, for the elapsed time on the card. */
  queuedAt: z.string().nullable().default(null),
  /** Phases of the current run, read from the agent output. */
  steps: z.array(GenerationStepSchema).default([]),
  /** When the current run completed or failed. */
  finishedAt: z.string().nullable().default(null),
})
export type GenerationRequest = z.infer<typeof GenerationRequestSchema>

const AspectRatioSchema = z
  .string()
  .regex(/^\d{1,2}:\d{1,2}$/)
  .nullable()

export const CreateGenerationSchema = z
  .object({
    prompt: z.string().trim().max(8000).default(''),
    kind: GenerationKindSchema.default('image'),
    model: z.string().trim().min(1).max(80).nullable().default(null),
    aspectRatio: AspectRatioSchema.default(null),
    count: z.number().int().min(1).max(4).default(1),
    referenceItemIds: z.array(IdSchema).max(MAX_REFERENCES).default([]),
    position: Vec2Schema.optional(),
    size: SizeSchema.nullable().optional(),
    /** false keeps the request as an editable draft card on the canvas. */
    submit: z.boolean().default(true),
  })
  .refine((input) => !input.submit || input.prompt !== '', {
    message: 'A prompt is required to submit',
    path: ['prompt'],
  })
export type CreateGenerationInput = z.input<typeof CreateGenerationSchema>
export type CreateGenerationCommand = z.output<typeof CreateGenerationSchema>

export const UpdateGenerationSchema = z.object({
  prompt: z.string().trim().max(8000).optional(),
  kind: GenerationKindSchema.optional(),
  model: z.string().trim().min(1).max(80).nullable().optional(),
  aspectRatio: AspectRatioSchema.optional(),
  count: z.number().int().min(1).max(4).optional(),
  referenceItemIds: z.array(IdSchema).max(MAX_REFERENCES).optional(),
  position: Vec2Schema.optional(),
  size: SizeSchema.nullable().optional(),
})
export type UpdateGenerationInput = z.infer<typeof UpdateGenerationSchema>

export const GenerationResultSourceSchema = z.union([
  z.object({ url: z.url({ protocol: /^https?$/ }) }),
  z.object({ filePath: z.string().min(1) }),
])
export type GenerationResultSource = z.infer<typeof GenerationResultSourceSchema>

export const GenerationResultSchema = z.object({
  source: GenerationResultSourceSchema,
  model: z.string().trim().min(1).max(80),
  provider: z.string().trim().min(1).max(40).default('higgsfield'),
  title: z.string().trim().max(200).optional(),
})
export type GenerationResultInput = z.input<typeof GenerationResultSchema>
export type GenerationResult = z.output<typeof GenerationResultSchema>

export const ProviderUploadSchema = z.object({
  itemId: IdSchema,
  provider: z.string().trim().min(1).max(40).default('higgsfield'),
  mediaId: z.string().trim().min(1).max(200),
})
export type ProviderUpload = z.output<typeof ProviderUploadSchema>

export const CompleteGenerationSchema = z.object({
  results: z.array(GenerationResultSchema).min(1).max(8),
  providerPrompt: z.string().trim().min(1).max(8000).optional(),
  uploads: z.array(ProviderUploadSchema).max(20).default([]),
  /** Prompt guide followed for the provider prompt: a model id or "default". */
  promptGuide: z.string().trim().min(1).max(80).optional(),
})
export type CompleteGenerationInput = z.input<typeof CompleteGenerationSchema>
export type CompleteGenerationCommand = z.output<typeof CompleteGenerationSchema>

export const FailGenerationSchema = z.object({ error: z.string().trim().min(1).max(2000) })
export type FailGenerationInput = z.infer<typeof FailGenerationSchema>

export const ReportProgressSchema = z.object({ message: z.string().trim().min(1).max(280) })
export type ReportProgressInput = z.infer<typeof ReportProgressSchema>

export const ListGenerationsSchema = z.object({ status: GenerationStatusSchema.optional() })
export type ListGenerationsInput = z.infer<typeof ListGenerationsSchema>

/** A reference resolved with everything an agent needs to upload it to a generation provider. */
export const ResolvedReferenceSchema = z.object({
  label: z.string(),
  itemId: IdSchema,
  title: z.string(),
  kind: ItemKindSchema,
  mimeType: z.string(),
  absolutePath: z.string(),
  /** File to upload to the provider: the original, or a resized JPEG copy when it is large. */
  uploadPath: z.string(),
  uploadMimeType: z.string(),
  /** Provider → media id of a previous upload of this file; reuse it instead of uploading again. */
  providerMediaIds: z.record(z.string(), z.string()),
  mediaUrl: z.string(),
  sourceUrl: z.string().nullable(),
  tags: z.array(z.string()),
  notes: z.string(),
})
export type ResolvedReference = z.infer<typeof ResolvedReferenceSchema>

/** The guide an agent must follow to write the provider prompt for the resolved model. */
export const PromptGuideSchema = z.object({
  /** Model to generate with: the request model, or the default for its kind when it is Auto. */
  model: z.string(),
  /** Guide file used: the model id when `prompt-guides/<model>.md` exists, otherwise "default". */
  guide: z.string(),
  /** Markdown of that guide; empty when no guide file exists. */
  content: z.string(),
})
export type PromptGuide = z.infer<typeof PromptGuideSchema>

export const GenerationDetailsSchema = GenerationRequestSchema.extend({
  resolvedReferences: z.array(ResolvedReferenceSchema),
  promptGuide: PromptGuideSchema,
})
export type GenerationDetails = z.infer<typeof GenerationDetailsSchema>
