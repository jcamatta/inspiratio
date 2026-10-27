import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { notify } from '../../shared/ui/index.ts'
import {
  emptyHistory,
  historyShortcut,
  recordEntry,
  stepBack,
  stepForward,
  type HistoryEntry,
  type HistoryState,
} from './domain/history.ts'
import { HistoryContext } from './history.context.ts'

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

export const HistoryProvider = ({ children }: { readonly children: ReactNode }) => {
  const queryClient = useQueryClient()
  const historyRef = useRef<HistoryState>(emptyHistory)
  const [history, setHistory] = useState<HistoryState>(emptyHistory)

  const commit = useCallback((next: HistoryState) => {
    historyRef.current = next
    setHistory(next)
  }, [])

  const record = useCallback(
    (entry: HistoryEntry) => {
      commit(recordEntry({ history: historyRef.current, entry }))
    },
    [commit],
  )

  const apply = useCallback(
    async (direction: 'undo' | 'redo') => {
      const step =
        direction === 'undo' ? stepBack(historyRef.current) : stepForward(historyRef.current)
      if (step.entry === null) return
      commit(step.history)
      await (direction === 'undo' ? step.entry.undo() : step.entry.redo())
      await queryClient.invalidateQueries()
      notify({ title: `${direction === 'undo' ? 'Undone' : 'Redone'}: ${step.entry.label}` })
    },
    [commit, queryClient],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = historyShortcut(event)
      if (action === null || isTyping(event.target)) return
      event.preventDefault()
      void apply(action)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [apply])

  const value = useMemo(
    () => ({
      record,
      undo: () => apply('undo'),
      redo: () => apply('redo'),
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
    }),
    [record, apply, history],
  )

  return <HistoryContext value={value}>{children}</HistoryContext>
}
