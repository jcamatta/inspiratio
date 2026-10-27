import type { Item, LayoutChange, Section } from '@inspiratio/shared'
import type { SectionPatch } from './flow-mapping.ts'

/** The layout changes that bring items back to how they are in `items`. */
export const inverseLayout = (params: {
  readonly changes: readonly LayoutChange[]
  readonly items: readonly Item[]
}): LayoutChange[] =>
  params.changes.flatMap((change) => {
    const item = params.items.find((candidate) => candidate.id === change.id)
    if (item === undefined) return []
    return [
      {
        id: item.id,
        position: item.position,
        ...(change.size === undefined ? {} : { size: item.size }),
        ...(change.sectionId === undefined ? {} : { sectionId: item.sectionId }),
      },
    ]
  })

export const inverseSectionPatch = (params: {
  readonly patch: SectionPatch
  readonly sections: readonly Section[]
}): SectionPatch | null => {
  const section = params.sections.find((candidate) => candidate.id === params.patch.id)
  if (section === undefined) return null
  return {
    id: section.id,
    ...(params.patch.position === undefined ? {} : { position: section.position }),
    ...(params.patch.size === undefined ? {} : { size: section.size }),
  }
}

/** Children of a section, kept so that undoing its deletion can put them back inside. */
export const sectionChildren = (params: {
  readonly sectionId: string
  readonly items: readonly Item[]
}): { readonly id: string; readonly position: Item['position'] }[] =>
  params.items
    .filter((item) => item.sectionId === params.sectionId)
    .map((item) => ({ id: item.id, position: item.position }))
