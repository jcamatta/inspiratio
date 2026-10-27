/** Sentinel item shown in a creatable combobox when the typed text matches no existing option. */
export const CREATE_PREFIX = '__create__:'

export const createOptionId = (name: string): string => `${CREATE_PREFIX}${name}`

export const parseCreateOption = (id: string): string | null =>
  id.startsWith(CREATE_PREFIX) ? id.slice(CREATE_PREFIX.length) : null
