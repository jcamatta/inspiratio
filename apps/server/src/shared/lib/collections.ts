type Identified = { readonly id: string }

export const findById = <T extends Identified>(params: {
  readonly list: readonly T[]
  readonly id: string
}): T | undefined => params.list.find((entity) => entity.id === params.id)

/** Replaces the entity with the same id, or appends it. */
export const upsert = <T extends Identified>(params: {
  readonly list: readonly T[]
  readonly entity: T
}): T[] => {
  const exists = params.list.some((entity) => entity.id === params.entity.id)
  return exists
    ? params.list.map((entity) => (entity.id === params.entity.id ? params.entity : entity))
    : [...params.list, params.entity]
}

export const upsertMany = <T extends Identified>(params: {
  readonly list: readonly T[]
  readonly entities: readonly T[]
}): T[] => {
  const replacements = new Map(params.entities.map((entity) => [entity.id, entity]))
  const kept = params.list.map((entity) => replacements.get(entity.id) ?? entity)
  const existing = new Set(params.list.map((entity) => entity.id))
  return [...kept, ...params.entities.filter((entity) => !existing.has(entity.id))]
}

export const removeById = <T extends Identified>(params: {
  readonly list: readonly T[]
  readonly id: string
}): T[] => params.list.filter((entity) => entity.id !== params.id)

export const unique = <T>(values: readonly T[]): T[] => [...new Set(values)]
