import { Tooltip } from '@base-ui/react/tooltip'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { ReactFlowProvider } from '@xyflow/react'
import type { ReactNode } from 'react'
import { ToastProvider } from '../shared/ui/index.ts'
import { HistoryProvider } from '../features/history/history.controller.tsx'
import { WorkspaceProvider } from '../features/workspace/workspace.controller.tsx'

export const Providers = ({
  children,
  queryClient,
}: {
  readonly children: ReactNode
  readonly queryClient: QueryClient
}) => (
  <QueryClientProvider client={queryClient}>
    <ReactFlowProvider>
      <HistoryProvider>
        <WorkspaceProvider>
          <Tooltip.Provider delay={400}>
            <ToastProvider>{children}</ToastProvider>
          </Tooltip.Provider>
        </WorkspaceProvider>
      </HistoryProvider>
    </ReactFlowProvider>
  </QueryClientProvider>
)
