import { createContext, useContext, type Dispatch } from 'react'
import type { WorkspaceAction, WorkspaceState } from './domain/workspace.ts'

export type WorkspaceContextValue = {
  readonly state: WorkspaceState
  readonly dispatch: Dispatch<WorkspaceAction>
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

/** Controller hook: shared UI state for the canvas, inspector and composer. */
export const useWorkspace = (): WorkspaceContextValue => {
  const value = useContext(WorkspaceContext)
  if (value === null) throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  return value
}
