import { useReducer, type ReactNode } from 'react'
import {
  initialWorkspace,
  reduceWorkspace,
  type WorkspaceAction,
  type WorkspaceState,
} from './domain/workspace.ts'
import { WorkspaceContext } from './workspace.context.ts'

// eslint-disable-next-line max-params -- React's useReducer imposes the (state, action) signature
const reducer = (state: WorkspaceState, action: WorkspaceAction): WorkspaceState =>
  reduceWorkspace({ state, action })

export const WorkspaceProvider = ({
  children,
  initial = initialWorkspace,
}: {
  readonly children: ReactNode
  readonly initial?: WorkspaceState
}) => {
  const [state, dispatch] = useReducer(reducer, initial)
  return <WorkspaceContext value={{ state, dispatch }}>{children}</WorkspaceContext>
}
