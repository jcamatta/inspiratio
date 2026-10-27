import { randomHex } from '@inspiratio/shared'

/** Ports for non-deterministic values, injected so domain logic stays pure and testable. */
export type Clock = () => string

export type IdGenerator = (params: { readonly prefix: string }) => string

export const systemClock: Clock = () => new Date().toISOString()

export const randomIds: IdGenerator = (params) => `${params.prefix}_${randomHex({ bytes: 6 })}`

/** Deterministic generators for tests. */
export const sequentialIds = (): IdGenerator => {
  const counters = new Map<string, number>()
  return (params) => {
    const next = (counters.get(params.prefix) ?? 0) + 1
    counters.set(params.prefix, next)
    return `${params.prefix}_${next}`
  }
}

export const fixedClock =
  (iso: string): Clock =>
  () =>
    iso
