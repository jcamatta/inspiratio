import { createContext, useContext } from 'react'
import type { HistoryEntry } from './domain/history.ts'

export type HistoryContextValue = {
  readonly record: (entry: HistoryEntry) => void
  readonly undo: () => Promise<void>
  readonly redo: () => Promise<void>
  readonly canUndo: boolean
  readonly canRedo: boolean
}

export const HistoryContext = createContext<HistoryContextValue | null>(null)

export const useHistory = (): HistoryContextValue => {
  const value = useContext(HistoryContext)
  if (value === null) throw new Error('useHistory must be used inside <HistoryProvider>')
  return value
}
