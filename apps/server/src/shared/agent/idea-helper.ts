import {
  err,
  IdeaSuggestionSchema,
  ok,
  type GenerationKind,
  type IdeaSuggestion,
  type IdeaTurn,
  type ItemKind,
  type Result,
} from '@inspiratio/shared'
import { spawn } from 'node:child_process'
import { once } from 'node:events'

export type IdeaReference = {
  readonly label: string
  readonly kind: ItemKind
  readonly title: string
  readonly path: string
}

export type IdeaRequest = {
  readonly kind: GenerationKind
  readonly brief: string
  readonly references: readonly IdeaReference[]
  /** Earlier rounds of refining, oldest first. */
  readonly history: readonly IdeaTurn[]
}

/** Helps the user shape the idea of a generation before any model-specific prompt is written. */
export type IdeaHelper = (request: IdeaRequest) => Promise<Result<IdeaSuggestion>>

const FOCUS: Readonly<Record<GenerationKind, string>> = {
  video:
    'what moves and how (direction, shape, speed, rhythm), what stays still, what the camera does (or that it stays locked), and how the shot begins and ends',
  image: 'subject, composition and framing, light, mood and style',
  audio:
    'who speaks (age, gender, accent, character), the exact words of each line in order, and how each is delivered (emotion, pace, volume, pauses)',
}

const referenceLine = (reference: IdeaReference): string =>
  reference.kind === 'image'
    ? `- ${reference.label}: image "${reference.title}", file ${reference.path}`
    : `- ${reference.label}: ${reference.kind} "${reference.title}" (not readable, rely on its title)`

const historyLines = (history: readonly IdeaTurn[]): string[] =>
  history.length === 0
    ? []
    : [
        '',
        'Refining so far (oldest first):',
        ...[...history.entries()].flatMap(([index, turn]) => [
          `Your version ${String(index + 1)}:`,
          turn.suggestion,
          'Feedback of the user on it:',
          turn.feedback,
        ]),
        '',
        'Revise your last version following the last feedback. Keep everything the user did not ask to change, and drop questions the feedback already answers.',
      ]

export const ideaPrompt = (request: IdeaRequest): string =>
  [
    `You help a filmmaker develop the idea behind a ${request.kind} they want to generate with AI.`,
    'You do not know which model will render it and must not care: a later step adapts the text to the model. Your job is the idea itself, so it is clear and impossible to misread.',
    '',
    'Rules:',
    '- Keep the intent of the user and every reference token (@1, @2…) exactly as written.',
    '- Read the image files below so the description matches what is really in them.',
    `- Make the idea concrete${request.kind === 'audio' ? '' : ' and visual'}: ${FOCUS[request.kind]}.`,
    '- Spell out what must NOT happen when the wording implies it, e.g. "the camera does not zoom".',
    '- Plain prose in the language of the user, at most about 120 words. No model names, technical settings, durations, resolutions or prompt jargon.',
    '- If something important is ambiguous, ask up to 3 short questions; otherwise ask none.',
    '',
    'References:',
    ...(request.references.length === 0 ? ['- none'] : request.references.map(referenceLine)),
    '',
    'Brief of the user:',
    request.brief,
    ...historyLines(request.history),
    '',
    'Reply with only a JSON object: {"brief": "<the developed idea>", "questions": ["<question>"]}',
  ].join('\n')

export const ideaArgs = (params: {
  readonly model: string
  readonly mediaDir: string
}): string[] => [
  '-p',
  '--model',
  params.model,
  '--strict-mcp-config',
  '--allowedTools',
  'Read',
  '--add-dir',
  params.mediaDir,
  '--output-format',
  'json',
]

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

/** Reads the `--output-format json` envelope and the JSON object Claude wrote inside it. */
export const parseIdeaOutput = (stdout: string): Result<IdeaSuggestion> => {
  const envelope = parseJson(stdout.trim()) as { result?: unknown; is_error?: unknown } | null
  if (envelope === null || typeof envelope.result !== 'string' || envelope.is_error === true)
    return err({ code: 'upstream', message: 'Claude did not answer' })
  const text = envelope.result
  const parsed = IdeaSuggestionSchema.safeParse(
    parseJson(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)),
  )
  return parsed.success
    ? ok(parsed.data)
    : err({ code: 'upstream', message: 'Claude answered in an unexpected format' })
}

const TIMEOUT_MS = 3 * 60 * 1000

/** Headless Claude with only the Read tool, so it can look at the reference images. */
export const createClaudeIdeaHelper = (params: {
  readonly command: string
  readonly model: string
  readonly cwd: string
  readonly mediaDir: string
  readonly spawnFn?: typeof spawn
}): IdeaHelper => {
  const spawnFn = params.spawnFn ?? spawn
  return async (request) => {
    const child = spawnFn(params.command, ideaArgs(params), {
      cwd: params.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    const chunks: Buffer[] = []
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    child.stderr.resume()
    child.stdin.end(ideaPrompt(request))
    const timer = setTimeout(() => child.kill(), TIMEOUT_MS)
    const exitCode = await once(child, 'close').then(
      ([code]: unknown[]) => (typeof code === 'number' ? code : null),
      () => null,
    )
    clearTimeout(timer)
    if (exitCode !== 0)
      return err({ code: 'upstream', message: 'Claude could not help with the idea' })
    return parseIdeaOutput(Buffer.concat(chunks).toString('utf8'))
  }
}
