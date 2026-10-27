import {
  CreatedSchema,
  GenerationRequestSchema,
  type CreateGenerationInput,
  type TraceContext,
  type UpdateGenerationInput,
} from '@inspiratio/shared'
import { z } from 'zod'
import { http } from '../../../shared/api/http-client.ts'

type Traced = { readonly trace?: TraceContext }

const NoContent = z.undefined()

export const CANCELLED = 'Cancelled'

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
      trace: params.trace,
    }),

  update: (params: Traced & { readonly id: string; readonly patch: UpdateGenerationInput }) =>
    http.request({
      method: 'PATCH',
      path: `/api/generations/${params.id}`,
      body: params.patch,
      schema: NoContent,
      trace: params.trace,
    }),

  submit: (params: Traced & { readonly id: string }) =>
    http.request({
      method: 'POST',
      path: `/api/generations/${params.id}/submit`,
      schema: CreatedSchema,
      trace: params.trace,
    }),

  retry: (params: Traced & { readonly id: string }) =>
    http.request({
      method: 'POST',
      path: `/api/generations/${params.id}/retry`,
      schema: NoContent,
      trace: params.trace,
    }),

  cancel: (params: Traced & { readonly id: string }) =>
    http.request({
      method: 'POST',
      path: `/api/generations/${params.id}/fail`,
      body: { error: CANCELLED },
      schema: NoContent,
      trace: params.trace,
    }),

  remove: (params: Traced & { readonly id: string }) =>
    http.request({
      method: 'DELETE',
      path: `/api/generations/${params.id}`,
      schema: NoContent,
      trace: params.trace,
    }),
}

export const GENERATIONS_QUERY_KEY = ['generations'] as const
