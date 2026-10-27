/**
 * Comparator factories. Array#sort imposes a two-argument comparator, so this file is
 * whitelisted from the single-parameter lint rule; everything else uses these helpers.
 */
export type Comparator<T> = (a: T, b: T) => number

export const compareBy = <T>(key: (value: T) => number | string): Comparator<T> => {
  return (a: T, b: T) => {
    const left = key(a)
    const right = key(b)
    if (left < right) return -1
    if (left > right) return 1
    return 0
  }
}

export const sortBy = <T>(params: {
  readonly values: readonly T[]
  readonly key: (value: T) => number | string
}): T[] => [...params.values].sort(compareBy(params.key))
