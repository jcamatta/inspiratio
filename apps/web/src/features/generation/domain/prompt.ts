import {
  DEFAULT_MODEL_SPECS,
  MAX_REFERENCES,
  modelSpecOf,
  modelsOfKind,
  resolveOptions,
  type GenerationKind,
  type GenerationOptions,
  type GenerationRequest,
  type ModelSetting,
  type ModelSpec,
  type OptionValue,
  type SettingChoice,
} from '@inspiratio/shared'

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

/** The model a card generates with: its own when still offered for its kind, else the kind default. */
export const cardModelOf = (params: {
  readonly model: string | null
  readonly kind: GenerationKind
}): ModelSpec => {
  const own = params.model === null ? undefined : modelSpecOf(params.model)
  return own?.kind === params.kind ? own : DEFAULT_MODEL_SPECS[params.kind]
}

export const modelChoicesOf = (kind: GenerationKind): SettingChoice[] =>
  modelsOfKind(kind).map((model) => ({ value: model.id, label: model.label }))

export const AUTO_ASPECT = 'auto'

/** "Auto" leaves the ratio to the model (the param is omitted), then the ratios the model accepts. */
export const aspectChoicesOf = (model: ModelSpec): SettingChoice[] => [
  { value: AUTO_ASPECT, label: 'Auto' },
  ...model.aspectRatios
    .filter((ratio) => ratio !== AUTO_ASPECT)
    .map((ratio) => ({ value: ratio, label: ratio })),
]

/** Switching model resets its settings to the new defaults and drops a ratio it does not accept. */
export const modelChangePatch = (params: {
  readonly aspectRatio: string | null
  readonly model: string
}): { model: string; options: GenerationOptions; aspectRatio: string | null } => ({
  model: params.model,
  options: {},
  aspectRatio:
    params.aspectRatio !== null &&
    modelSpecOf(params.model)?.aspectRatios.includes(params.aspectRatio)
      ? params.aspectRatio
      : null,
})

const ON = 'on'
const OFF = 'off'

/** Choices of a card control; numbers become one choice per whole value, toggles On/Off. */
export const settingChoicesOf = (setting: ModelSetting): SettingChoice[] => {
  if (setting.type === 'select') return [...setting.choices]
  if (setting.type === 'toggle')
    return [
      { value: ON, label: 'On' },
      { value: OFF, label: 'Off' },
    ]
  return [...Array(setting.max - setting.min + 1).keys()].map((index) => {
    const value = String(setting.min + index)
    return { value, label: `${value}${setting.unit}` }
  })
}

export const encodeSetting = (value: OptionValue): string =>
  typeof value === 'boolean' ? (value ? ON : OFF) : String(value)

export const decodeSetting = (params: {
  readonly setting: ModelSetting
  readonly value: string
}): OptionValue => {
  if (params.setting.type === 'toggle') return params.value === ON
  if (params.setting.type === 'number') return Number(params.value)
  return params.value
}

/** Short line of the card settings for a queued card, e.g. "1080p · 5s · Audio on". */
export const settingsSummaryOf = (params: {
  readonly model: ModelSpec
  readonly options: GenerationOptions
}): string => {
  const resolved = resolveOptions({ model: params.model.id, options: params.options })
  return params.model.settings
    .map((setting) => {
      const value = resolved[setting.key]
      if (value === undefined) return ''
      if (setting.type === 'toggle') return `${setting.label} ${value === true ? 'on' : 'off'}`
      return (
        settingChoicesOf(setting).find((choice) => choice.value === encodeSetting(value))?.label ??
        encodeSetting(value)
      )
    })
    .filter((part) => part !== '')
    .join(' · ')
}

export const STALLED_AFTER_MS = 10 * 60 * 1000

/** An in-progress request with no update for a while: the agent session probably ended. */
export const isStalled = (params: {
  readonly request: GenerationRequest
  readonly now: number
}): boolean =>
  params.request.status === 'in_progress' &&
  params.now - Date.parse(params.request.updatedAt) > STALLED_AFTER_MS

export const claudeInstruction = (generationId: string): string =>
  `Use the inspiratio-generate skill to fulfil Inspiratio generation request ${generationId}.`

const pad = (value: number): string => String(value).padStart(2, '0')

/** Elapsed time on a queued card: m:ss, or h:mm:ss past an hour. */
export const formatElapsed = (milliseconds: number): string => {
  const total = Math.max(0, Math.floor(milliseconds / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = pad(total % 60)
  return hours > 0 ? `${String(hours)}:${pad(minutes)}:${seconds}` : `${String(minutes)}:${seconds}`
}
