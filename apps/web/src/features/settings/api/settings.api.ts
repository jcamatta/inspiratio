import { StorageInfoSchema, type StorageFolder, type TraceContext } from '@inspiratio/shared'
import { z } from 'zod'
import { http } from '../../../shared/api/http-client.ts'

export const STORAGE_QUERY_KEY = 'storage'

export const settingsApi = {
  fetchStorage: () =>
    http.request({ method: 'GET', path: '/api/storage', schema: StorageInfoSchema }),

  openFolder: (params: { readonly folder: StorageFolder; readonly trace?: TraceContext }) =>
    http.request({
      method: 'POST',
      path: '/api/storage/open',
      body: { folder: params.folder },
      schema: z.undefined(),
      trace: params.trace,
    }),

  revealFile: (params: { readonly fileName: string; readonly trace?: TraceContext }) =>
    http.request({
      method: 'POST',
      path: '/api/storage/reveal',
      body: { fileName: params.fileName },
      schema: z.undefined(),
      trace: params.trace,
    }),
}
