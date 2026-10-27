import type { CreateSectionCommand, Section, UpdateSectionInput } from '@inspiratio/shared'

export const createSection = (params: {
  readonly id: string
  readonly now: string
  readonly input: CreateSectionCommand
}): Section => ({
  id: params.id,
  title: params.input.title === '' ? 'Untitled section' : params.input.title,
  position: params.input.position,
  size: params.input.size,
  color: params.input.color,
  createdAt: params.now,
  updatedAt: params.now,
})

export const updateSection = (params: {
  readonly section: Section
  readonly patch: UpdateSectionInput
  readonly now: string
}): Section => ({
  ...params.section,
  title: params.patch.title ?? params.section.title,
  position: params.patch.position ?? params.section.position,
  size: params.patch.size ?? params.section.size,
  color: params.patch.color ?? params.section.color,
  updatedAt: params.now,
})
