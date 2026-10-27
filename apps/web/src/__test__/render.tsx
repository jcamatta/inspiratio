import { QueryClient } from '@tanstack/react-query'
import { render, type RenderResult } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { Providers } from '../app/Providers.tsx'
import { initialWorkspace, type WorkspaceState } from '../features/workspace/domain/workspace.ts'
import { WorkspaceProvider } from '../features/workspace/workspace.controller.tsx'
import { createFakeApi, type FakeApi } from './fake-api.ts'

export type AppRender = RenderResult & {
  readonly api: FakeApi
  readonly user: UserEvent
  readonly queryClient: QueryClient
}

/** Renders UI inside the real providers with `fetch` routed to an in-memory fake backend. */
export const renderWithApp = (params: {
  readonly ui: ReactNode
  readonly api?: FakeApi
  readonly workspace?: Partial<WorkspaceState>
}): AppRender => {
  const api = params.api ?? createFakeApi()
  vi.stubGlobal('fetch', api.fetch)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } },
  })
  const workspace = { ...initialWorkspace, ...params.workspace }
  const result = render(
    <Providers queryClient={queryClient}>
      {/* A nested provider lets tests start from a custom workspace state. */}
      <WorkspaceProvider initial={workspace}>{params.ui}</WorkspaceProvider>
    </Providers>,
  )
  return { ...result, api, user: userEvent.setup(), queryClient }
}
