import { z } from 'zod'

export const Vec2Schema = z.object({ x: z.number(), y: z.number() })
export type Vec2 = z.infer<typeof Vec2Schema>

export const SizeSchema = z.object({
  width: z.number().min(24).max(20000),
  height: z.number().min(24).max(20000),
})
export type Size = z.infer<typeof SizeSchema>

export const IdSchema = z.string().min(1).max(64)
