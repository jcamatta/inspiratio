import { QueryClient } from '@tanstack/react-query'

export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: { staleTime: 5_000, refetchOnWindowFocus: true, retry: 1 },
      mutations: { retry: 0 },
    },
  })
