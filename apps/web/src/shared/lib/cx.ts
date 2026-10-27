type ClassValue = string | false | null | undefined

/** Joins truthy class names. Tiny on purpose: Tailwind classes are written statically. */
export const cx = (...values: readonly ClassValue[]): string =>
  values.filter((value): value is string => typeof value === 'string' && value !== '').join(' ')
