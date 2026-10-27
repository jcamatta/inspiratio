export type HistoryEntry = {
  readonly label: string
  readonly undo: () => Promise<unknown>
  readonly redo: () => Promise<unknown>
}

export type HistoryState = {
  readonly past: readonly HistoryEntry[]
  readonly future: readonly HistoryEntry[]
}

export const MAX_HISTORY = 100

export const emptyHistory: HistoryState = { past: [], future: [] }

export const recordEntry = (params: {
  readonly history: HistoryState
  readonly entry: HistoryEntry
}): HistoryState => ({
  past: [...params.history.past, params.entry].slice(-MAX_HISTORY),
  future: [],
})

export const stepBack = (
  history: HistoryState,
): { readonly history: HistoryState; readonly entry: HistoryEntry | null } => {
  const entry = history.past.at(-1)
  if (entry === undefined) return { history, entry: null }
  return { history: { past: history.past.slice(0, -1), future: [entry, ...history.future] }, entry }
}

export const stepForward = (
  history: HistoryState,
): { readonly history: HistoryState; readonly entry: HistoryEntry | null } => {
  const [entry, ...rest] = history.future
  if (entry === undefined) return { history, entry: null }
  return { history: { past: [...history.past, entry], future: rest }, entry }
}

export type ShortcutKey = {
  readonly key: string
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  readonly shiftKey: boolean
}

export const historyShortcut = (event: ShortcutKey): 'undo' | 'redo' | null => {
  if (!event.ctrlKey && !event.metaKey) return null
  const key = event.key.toLowerCase()
  if (key === 'y' || (key === 'z' && event.shiftKey)) return 'redo'
  if (key === 'z') return 'undo'
  return null
}
