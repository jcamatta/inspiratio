import type { BoardSnapshot, GenerationRequest } from '@inspiratio/shared'
import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { makePng, type Rgb } from './make-png.ts'

export const API_URL = 'http://127.0.0.1:4329'

export const pngFile = (params: {
  readonly name: string
  readonly from: Rgb
  readonly to: Rgb
}) => ({
  name: params.name,
  mimeType: 'image/png',
  buffer: makePng({ width: 480, height: 270, from: params.from, to: params.to }),
})

export const board = async (request: APIRequestContext): Promise<BoardSnapshot> =>
  (await (await request.get(`${API_URL}/api/board`)).json()) as BoardSnapshot

export const generations = async (request: APIRequestContext): Promise<GenerationRequest[]> =>
  (await (await request.get(`${API_URL}/api/generations`)).json()) as GenerationRequest[]

/** Removes everything so each test starts from an empty canvas (files go to the e2e trash). */
export const resetLibrary = async (request: APIRequestContext): Promise<void> => {
  const snapshot = await board(request)
  for (const item of snapshot.items) await request.delete(`${API_URL}/api/items/${item.id}`)
  for (const section of snapshot.sections)
    await request.delete(`${API_URL}/api/sections/${section.id}`)
  for (const tag of snapshot.tags) await request.delete(`${API_URL}/api/tags/${tag.id}`)
  for (const generation of await generations(request))
    await request.delete(`${API_URL}/api/generations/${generation.id}`)
}

export const uploadThroughToolbar = async (params: {
  readonly page: Page
  readonly files: readonly ReturnType<typeof pngFile>[]
}): Promise<void> => {
  await params.page.getByTestId('file-input').setInputFiles([...params.files])
  await expect(params.page.getByTestId('toast').filter({ hasText: 'Added' }).first()).toBeVisible()
}

export const nodeByTitle = (params: { readonly page: Page; readonly title: string }) =>
  params.page
    .locator('[data-testid^="media-node-"]')
    .filter({ has: params.page.getByText(params.title, { exact: true }) })
