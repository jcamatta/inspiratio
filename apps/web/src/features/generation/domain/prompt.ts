import { MAX_REFERENCES, type GenerationKind } from '@inspiratio/shared'

export const labelOf = (index: number): string => `@${index + 1}`

export const TOKEN_PATTERN = /@(\d+)\b/g

/** Adds references in order (ignoring duplicates) up to the provider limit. */
export const addReferences = (params: {
  readonly references: readonly string[]
  readonly itemIds: readonly string[]
}): string[] => [...new Set([...params.references, ...params.itemIds])].slice(0, MAX_REFERENCES)

/** Inserts a token at the caret (or the end), padding it with spaces as needed. */
export const insertToken = (params: {
  readonly prompt: string
  readonly token: string
  readonly caret: number | null
}): string => {
  const at =
    params.caret === null
      ? params.prompt.length
      : Math.min(Math.max(params.caret, 0), params.prompt.length)
  const before = params.prompt.slice(0, at)
  const after = params.prompt.slice(at)
  const left = before === '' || before.endsWith(' ') || before.endsWith('\n') ? '' : ' '
  return `${before}${left}${params.token} ${after.trimStart()}`
}

/** Adds references and writes their tokens into the prompt for those not already mentioned. */
export const dropReferences = (params: {
  readonly prompt: string
  readonly references: readonly string[]
  readonly itemIds: readonly string[]
  readonly caret: number | null
}): { readonly prompt: string; readonly references: string[] } => {
  const references = addReferences({ references: params.references, itemIds: params.itemIds })
  const tokens = params.itemIds
    .map((id) => references.indexOf(id))
    .filter((index) => index !== -1)
    .map(labelOf)
    .filter((token) => !mentionedTokens(params.prompt).includes(token))
  const prompt =
    tokens.length === 0
      ? params.prompt
      : insertToken({ prompt: params.prompt, token: tokens.join(' '), caret: params.caret })
  return { prompt, references }
}

export const mentionedTokens = (prompt: string): string[] =>
  [...prompt.matchAll(TOKEN_PATTERN)].map((match) => match[0])

/**
 * Removing reference N deletes its @N token and shifts higher tokens down so the prompt keeps
 * pointing at the same images (the backend labels references by position).
 */
export const removeReference = (params: {
  readonly prompt: string
  readonly references: readonly string[]
  readonly itemId: string
}): { readonly prompt: string; readonly references: string[] } => {
  const index = params.references.indexOf(params.itemId)
  if (index === -1) return { prompt: params.prompt, references: [...params.references] }
  const removed = index + 1
  const prompt = params.prompt
    .replace(TOKEN_PATTERN, (token: string) => {
      const number = Number(token.slice(1))
      if (number === removed) return ''
      return number > removed ? `@${number - 1}` : token
    })
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
  return { prompt, references: params.references.filter((id) => id !== params.itemId) }
}

/** Tokens in the prompt that point at no reference, surfaced as a warning in the composer. */
export const danglingTokens = (params: {
  readonly prompt: string
  readonly referenceCount: number
}): string[] =>
  [...new Set(mentionedTokens(params.prompt))].filter((token) => {
    const number = Number(token.slice(1))
    return number < 1 || number > params.referenceCount
  })

export type ModelOption = {
  readonly value: string
  readonly label: string
  readonly kind: GenerationKind | 'any'
}

export const AUTO_MODEL = 'auto'

/** Suggestions only: Claude may pick another Higgsfield model (models_explore) when set to auto. */
export const MODEL_OPTIONS: readonly ModelOption[] = [
  { value: AUTO_MODEL, label: 'Let Claude choose', kind: 'any' },
  { value: 'nano_banana_pro', label: 'Nano Banana Pro', kind: 'image' },
  { value: 'gpt_image_2_5', label: 'GPT Image 2.5', kind: 'image' },
  { value: 'seedream_4_5', label: 'Seedream 4.5', kind: 'image' },
  { value: 'soul_2', label: 'Higgsfield Soul 2', kind: 'image' },
  { value: 'seedance_2_5', label: 'Seedance 2.5', kind: 'video' },
  { value: 'kling3_0', label: 'Kling 3.0', kind: 'video' },
  { value: 'minimax_h3', label: 'MiniMax H3', kind: 'video' },
]

export const modelsFor = (kind: GenerationKind): ModelOption[] =>
  MODEL_OPTIONS.filter((option) => option.kind === 'any' || option.kind === kind)

export const ASPECT_RATIOS = [
  'auto',
  '16:9',
  '9:16',
  '1:1',
  '4:3',
  '3:4',
  '21:9',
  '2:3',
  '3:2',
] as const

export const claudeInstruction = (generationId: string): string =>
  `Use the inspiratio-generate skill to fulfil Inspiratio generation request ${generationId}.`
