import { z } from 'zod'
import type { GenerationKind } from './generation.ts'

/** A setting value as Higgsfield takes it: an option id, a number or a flag. */
export const OptionValueSchema = z.union([z.string().max(40), z.number(), z.boolean()])
export type OptionValue = z.infer<typeof OptionValueSchema>

/** Per-model settings keyed by the Higgsfield parameter name, e.g. { resolution: '2k' }. */
export const GenerationOptionsSchema = z.record(z.string().max(40), OptionValueSchema)
export type GenerationOptions = z.infer<typeof GenerationOptionsSchema>

export type SettingChoice = { readonly value: string; readonly label: string }

/** One card control; `key` is the Higgsfield parameter it sets. */
export type ModelSetting =
  | {
      readonly type: 'select'
      readonly key: string
      readonly label: string
      readonly choices: readonly SettingChoice[]
      readonly default: string
    }
  | {
      readonly type: 'number'
      readonly key: string
      readonly label: string
      readonly min: number
      readonly max: number
      readonly unit: string
      readonly default: number
    }
  | {
      readonly type: 'toggle'
      readonly key: string
      readonly label: string
      readonly default: boolean
    }

export type ModelSpec = {
  readonly id: string
  readonly label: string
  readonly kind: GenerationKind
  /** Ratios Higgsfield accepts for this model; "auto" means the param can be left to the model. */
  readonly aspectRatios: readonly string[]
  readonly settings: readonly ModelSetting[]
}

const choices = (values: readonly string[]): SettingChoice[] =>
  values.map((value) => ({ value, label: value }))

const NANO_BANANA_PRO: ModelSpec = {
  id: 'nano_banana_pro',
  label: 'Nano Banana Pro',
  kind: 'image',
  aspectRatios: ['1:1', '3:2', '2:3', '4:3', '3:4', '4:5', '5:4', '9:16', '16:9', '21:9'],
  settings: [
    {
      type: 'select',
      key: 'resolution',
      label: 'Resolution',
      choices: choices(['1k', '2k', '4k']),
      default: '2k',
    },
  ],
}

const SEEDANCE_2_5: ModelSpec = {
  id: 'seedance_2_5',
  label: 'Seedance 2.5',
  kind: 'video',
  aspectRatios: ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
  settings: [
    {
      type: 'number',
      key: 'duration',
      label: 'Duration',
      min: 4,
      max: 30,
      unit: 's',
      default: 5,
    },
    {
      type: 'select',
      key: 'resolution',
      label: 'Quality',
      choices: choices(['480p', '720p', '1080p']),
      default: '1080p',
    },
    {
      type: 'select',
      key: 'bitrate_mode',
      label: 'Bitrate',
      choices: [
        { value: 'standard', label: 'Standard bitrate' },
        { value: 'high', label: 'High bitrate' },
      ],
      default: 'high',
    },
    { type: 'toggle', key: 'generate_audio', label: 'Audio', default: true },
  ],
}

/**
 * The models the card offers, with the settings Higgsfield exposes for each (models_explore).
 * Each has a prompt guide in prompt-guides/<id>.md.
 */
export const MODELS: readonly ModelSpec[] = [
  NANO_BANANA_PRO,
  {
    id: 'gpt_image_2_5',
    label: 'GPT Image 2.5',
    kind: 'image',
    aspectRatios: [
      'auto',
      '1:1',
      '3:2',
      '2:3',
      '4:3',
      '3:4',
      '16:9',
      '9:16',
      '21:9',
      '27:16',
      '16:27',
      '9:8',
      '8:9',
      '4:5',
      '5:4',
    ],
    settings: [
      {
        type: 'select',
        key: 'variant',
        label: 'Variant',
        choices: [
          { value: 'flare', label: 'Flare' },
          { value: 'sunburst', label: 'Sunburst' },
        ],
        default: 'flare',
      },
      {
        type: 'select',
        key: 'quality',
        label: 'Quality',
        choices: [
          { value: 'low', label: 'Low quality' },
          { value: 'medium', label: 'Medium quality' },
          { value: 'high', label: 'High quality' },
          { value: 'xhigh', label: 'Extra high quality' },
          { value: 'max', label: 'Max quality' },
        ],
        default: 'high',
      },
      {
        type: 'select',
        key: 'resolution',
        label: 'Resolution',
        choices: choices(['1k', '2k', '4k']),
        default: '2k',
      },
      {
        type: 'select',
        key: 'background',
        label: 'Background',
        choices: [
          { value: 'auto', label: 'Auto background' },
          { value: 'opaque', label: 'Opaque' },
          { value: 'transparent', label: 'Transparent' },
        ],
        default: 'auto',
      },
    ],
  },
  {
    id: 'flux_3_image',
    label: 'FLUX 3',
    kind: 'image',
    aspectRatios: [
      'auto',
      '21:9',
      '2:1',
      '16:9',
      '3:2',
      '7:5',
      '4:3',
      '5:4',
      '1:1',
      '4:5',
      '3:4',
      '5:7',
      '2:3',
      '9:16',
      '1:2',
    ],
    settings: [
      {
        type: 'select',
        key: 'resolution',
        label: 'Resolution',
        choices: choices(['768sq', '1k', '1.5k', '2k', '4k']),
        default: '2k',
      },
    ],
  },
  SEEDANCE_2_5,
]

/** Model used when a request has none (or one no longer offered). */
export const DEFAULT_MODEL_SPECS: Readonly<Record<GenerationKind, ModelSpec>> = {
  image: NANO_BANANA_PRO,
  video: SEEDANCE_2_5,
}

export const DEFAULT_MODELS: Readonly<Record<GenerationKind, string>> = {
  image: NANO_BANANA_PRO.id,
  video: SEEDANCE_2_5.id,
}

export const modelSpecOf = (id: string): ModelSpec | undefined =>
  MODELS.find((model) => model.id === id)

export const modelsOfKind = (kind: GenerationKind): ModelSpec[] =>
  MODELS.filter((model) => model.kind === kind)

const isValid = (params: { readonly setting: ModelSetting; readonly value: OptionValue }) => {
  const { setting, value } = params
  if (setting.type === 'select')
    return typeof value === 'string' && setting.choices.some((choice) => choice.value === value)
  if (setting.type === 'number')
    return (
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= setting.min &&
      value <= setting.max
    )
  return typeof value === 'boolean'
}

/** Every setting of the model: the stored value when valid for it, otherwise the default. */
export const resolveOptions = (params: {
  readonly model: string
  readonly options: GenerationOptions
}): GenerationOptions =>
  Object.fromEntries(
    (modelSpecOf(params.model)?.settings ?? []).map((setting) => {
      const value = params.options[setting.key]
      return [
        setting.key,
        value !== undefined && isValid({ setting, value }) ? value : setting.default,
      ]
    }),
  )
