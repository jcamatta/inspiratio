import {
  CreatedSchema,
  GenerationRequestSchema,
  type CreateGenerationInput,
  type TraceContext,
} from '@inspiratio/shared'
import { z } from 'zod'
import { http } from '../../../shared/api/http-client.ts'

type Traced = { readonly trace?: TraceContext }

export const generationApi = {
  list: () =>
    http.request({
      method: 'GET',
      path: '/api/generations',
      schema: z.array(GenerationRequestSchema),
    }),

  create: (params: Traced & { readonly input: CreateGenerationInput }) =>
    http.request({
      method: 'POST',
      path: '/api/generations',
      body: params.input,
      schema: CreatedSchema,
      ...params,
    }),

  retry: (params: Traced & { readonly id: string }) =>
    http.request({
      method: 'POST',
      path: `/api/generations/${params.id}/retry`,
      schema: z.undefined(),
      ...params,
    }),

  remove: (params: Traced & { readonly id: string }) =>
    http.request({
      method: 'DELETE',
      path: `/api/generations/${params.id}`,
      schema: z.undefined(),
      ...params,
    }),
}

export const GENERATIONS_QUERY_KEY = ['generations'] as const
