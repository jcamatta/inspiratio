import {
  BoardSnapshotSchema,
  CreatedManySchema,
  CreatedSchema,
  type CreateSectionInput,
  type LayoutChange,
  type TraceContext,
  type UpdateItemInput,
  type UpdateSectionInput,
  type Vec2,
} from '@inspiratio/shared'
import { z } from 'zod'
import { http } from '../../../shared/api/http-client.ts'

const NoContent = z.undefined()

type Traced = { readonly trace?: TraceContext }

/** Actions: thin HTTP calls for the board. Queries are GETs, commands are writes (CQS). */
export const boardApi = {
  fetchBoard: () =>
    http.request({ method: 'GET', path: '/api/board', schema: BoardSnapshotSchema }),

  uploadFiles: (
    params: Traced & {
      readonly files: readonly File[]
      readonly position: Vec2
      readonly sectionId?: string
    },
  ) => {
    const form = new FormData()
    for (const file of params.files) form.append('files', file)
    form.append('x', String(Math.round(params.position.x)))
    form.append('y', String(Math.round(params.position.y)))
    if (params.sectionId !== undefined) form.append('sectionId', params.sectionId)
    return http.request({
      method: 'POST',
      path: '/api/items/upload',
      form,
      schema: CreatedManySchema,
      ...params,
    })
  },

  importUrl: (params: Traced & { readonly url: string; readonly position: Vec2 }) =>
    http.request({
      method: 'POST',
      path: '/api/items/import-url',
      body: { url: params.url, position: params.position },
      schema: CreatedSchema,
      ...params,
    }),

  applyLayout: (params: Traced & { readonly changes: readonly LayoutChange[] }) =>
    http.request({
      method: 'POST',
      path: '/api/items/layout',
      body: { changes: params.changes },
      schema: NoContent,
      ...params,
    }),

  updateItem: (params: Traced & { readonly id: string; readonly patch: UpdateItemInput }) =>
    http.request({
      method: 'PATCH',
      path: `/api/items/${params.id}`,
      body: params.patch,
      schema: NoContent,
      ...params,
    }),

  setItemTags: (params: Traced & { readonly id: string; readonly tagIds: readonly string[] }) =>
    http.request({
      method: 'PUT',
      path: `/api/items/${params.id}/tags`,
      body: { tagIds: params.tagIds },
      schema: NoContent,
      ...params,
    }),

  reportDimensions: (
    params: Traced & { readonly id: string; readonly width: number; readonly height: number },
  ) =>
    http.request({
      method: 'PUT',
      path: `/api/items/${params.id}/dimensions`,
      body: { width: params.width, height: params.height },
      schema: NoContent,
      ...params,
    }),

  deleteItem: (params: Traced & { readonly id: string }) =>
    http.request({
      method: 'DELETE',
      path: `/api/items/${params.id}`,
      schema: NoContent,
      ...params,
    }),

  restoreItem: (params: Traced & { readonly id: string }) =>
    http.request({
      method: 'POST',
      path: `/api/items/${params.id}/restore`,
      schema: NoContent,
      ...params,
    }),

  createSection: (params: Traced & { readonly input: CreateSectionInput }) =>
    http.request({
      method: 'POST',
      path: '/api/sections',
      body: params.input,
      schema: CreatedSchema,
      ...params,
    }),

  updateSection: (params: Traced & { readonly id: string; readonly patch: UpdateSectionInput }) =>
    http.request({
      method: 'PATCH',
      path: `/api/sections/${params.id}`,
      body: params.patch,
      schema: NoContent,
      ...params,
    }),

  deleteSection: (params: Traced & { readonly id: string }) =>
    http.request({
      method: 'DELETE',
      path: `/api/sections/${params.id}`,
      schema: NoContent,
      ...params,
    }),

  createTag: (params: Traced & { readonly name: string }) =>
    http.request({
      method: 'POST',
      path: '/api/tags',
      body: { name: params.name },
      schema: CreatedSchema,
      ...params,
    }),

  renameTag: (params: Traced & { readonly id: string; readonly name: string }) =>
    http.request({
      method: 'PATCH',
      path: `/api/tags/${params.id}`,
      body: { name: params.name },
      schema: NoContent,
      ...params,
    }),

  deleteTag: (params: Traced & { readonly id: string }) =>
    http.request({
      method: 'DELETE',
      path: `/api/tags/${params.id}`,
      schema: NoContent,
      ...params,
    }),
}

export const BOARD_QUERY_KEY = ['board'] as const
