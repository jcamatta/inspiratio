import { z } from 'zod'
import { IdSchema, SizeSchema, Vec2Schema } from './geometry.ts'

/** What a canvas item holds; generation cards produce the same kinds. */
export const ITEM_KINDS = ['image', 'video', 'audio'] as const
export const ItemKindSchema = z.enum(ITEM_KINDS)
export type ItemKind = z.infer<typeof ItemKindSchema>

export const ItemOriginSchema = z.enum(['upload', 'url', 'generated', 'file'])
export type ItemOrigin = z.infer<typeof ItemOriginSchema>

export const MediaFileSchema = z.object({
  fileName: z.string(),
  mimeType: z.string(),
  bytes: z.number().int().nonnegative(),
  width: z.number().positive().nullable(),
  height: z.number().positive().nullable(),
})
export type MediaFile = z.infer<typeof MediaFileSchema>

export const GenerationInfoSchema = z.object({
  requestId: z.string().nullable(),
  provider: z.string(),
  model: z.string(),
  prompt: z.string(),
  /** Exact prompt the agent sent to the provider, when it rewrote the user's brief. */
  providerPrompt: z.string().nullable().default(null),
  /** Which Generate run of the request produced this result, starting at 1. */
  run: z.number().int().min(1).default(1),
  /** Model id whose prompt guide was used to write providerPrompt (prompt-guides/<id>.md). */
  promptGuide: z.string().nullable().default(null),
  referenceItemIds: z.array(IdSchema),
})
export type GenerationInfo = z.infer<typeof GenerationInfoSchema>

export const ItemMetadataSchema = z.object({
  createdAt: z.string(),
  updatedAt: z.string(),
  origin: ItemOriginSchema,
  sourceUrl: z.string().nullable(),
  originalFileName: z.string().nullable(),
  notes: z.string(),
  generation: GenerationInfoSchema.nullable(),
  /** Media ids this file already has at generation providers, so it is uploaded only once. */
  providerMedia: z.record(z.string(), z.string()).default({}),
})
export type ItemMetadata = z.infer<typeof ItemMetadataSchema>

export const ItemSchema = z.object({
  id: IdSchema,
  kind: ItemKindSchema,
  title: z.string(),
  media: MediaFileSchema,
  /** Relative to the parent section when sectionId is set, absolute otherwise. */
  position: Vec2Schema,
  size: SizeSchema,
  zIndex: z.number().int(),
  sectionId: IdSchema.nullable(),
  tagIds: z.array(IdSchema),
  metadata: ItemMetadataSchema,
})
export type Item = z.infer<typeof ItemSchema>

export const ItemTitleSchema = z.string().trim().max(200)

export const ImportPlacementSchema = z.object({
  position: Vec2Schema.optional(),
  title: ItemTitleSchema.optional(),
  sectionId: IdSchema.nullable().optional(),
})
export type ImportPlacement = z.infer<typeof ImportPlacementSchema>

export const ImportUrlSchema = ImportPlacementSchema.extend({
  url: z.url({ protocol: /^https?$/ }),
})
export type ImportUrlInput = z.infer<typeof ImportUrlSchema>

export const ImportFileSchema = ImportPlacementSchema.extend({
  filePath: z.string().min(1),
})
export type ImportFileInput = z.infer<typeof ImportFileSchema>

export const UpdateItemSchema = z.object({
  title: ItemTitleSchema.optional(),
  notes: z.string().max(10000).optional(),
  zIndex: z.number().int().optional(),
})
export type UpdateItemInput = z.infer<typeof UpdateItemSchema>

export const LayoutChangeSchema = z.object({
  id: IdSchema,
  position: Vec2Schema.optional(),
  size: SizeSchema.optional(),
  sectionId: IdSchema.nullable().optional(),
})
export type LayoutChange = z.infer<typeof LayoutChangeSchema>

export const ApplyLayoutSchema = z.object({
  changes: z.array(LayoutChangeSchema).min(1).max(500),
})
export type ApplyLayoutInput = z.infer<typeof ApplyLayoutSchema>

export const SetItemTagsSchema = z.object({ tagIds: z.array(IdSchema).max(100) })
export type SetItemTagsInput = z.infer<typeof SetItemTagsSchema>

export const ReportMediaDimensionsSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
})
export type ReportMediaDimensionsInput = z.infer<typeof ReportMediaDimensionsSchema>

export const SearchItemsSchema = z.object({
  text: z.string().trim().max(200).optional(),
  tags: z.array(z.string()).optional(),
  kind: ItemKindSchema.optional(),
})
export type SearchItemsInput = z.infer<typeof SearchItemsSchema>

export const MEDIA_ROUTE = '/media'

export const mediaUrlOf = (media: Pick<MediaFile, 'fileName'>): string =>
  `${MEDIA_ROUTE}/${encodeURIComponent(media.fileName)}`
