import type { BoardSnapshot, GenerationRequest } from '@inspiratio/shared'
import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { makePng, type Rgb } from './make-png.ts'

export const API_URL = 'http://127.0.0.1:4329'

export type PngFile = { readonly name: string; readonly base64: string }

export const pngFile = (params: {
  readonly name: string
  readonly from: Rgb
  readonly to: Rgb
}): PngFile => ({
  name: params.name,
  base64: makePng({ width: 480, height: 270, from: params.from, to: params.to }).toString('base64'),
})

export const board = async (request: APIRequestContext): Promise<BoardSnapshot> =>
  (await (await request.get(`${API_URL}/api/board`)).json()) as BoardSnapshot

export const generations = async (request: APIRequestContext): Promise<GenerationRequest[]> =>
  (await (await request.get(`${API_URL}/api/generations`)).json()) as GenerationRequest[]

export const resetLibrary = async (request: APIRequestContext): Promise<void> => {
  const snapshot = await board(request)
  for (const item of snapshot.items) await request.delete(`${API_URL}/api/items/${item.id}`)
  for (const section of snapshot.sections)
    await request.delete(`${API_URL}/api/sections/${section.id}`)
  for (const tag of snapshot.tags) await request.delete(`${API_URL}/api/tags/${tag.id}`)
  for (const generation of await generations(request))
    await request.delete(`${API_URL}/api/generations/${generation.id}`)
}

/** Drops files on the canvas the way a desktop drag does (a DataTransfer with File objects). */
export const dropFiles = async (params: {
  readonly page: Page
  readonly files: readonly PngFile[]
}): Promise<void> => {
  const transfer = await params.page.evaluateHandle((files) => {
    const data = new DataTransfer()
    for (const file of files) {
      const bytes = Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0))
      data.items.add(new File([bytes], file.name, { type: 'image/png' }))
    }
    return data
  }, params.files)
  const target = params.page.getByTestId('board')
  await target.dispatchEvent('dragover', { dataTransfer: transfer, clientX: 400, clientY: 300 })
  await target.dispatchEvent('drop', { dataTransfer: transfer, clientX: 400, clientY: 300 })
  await expect(params.page.getByTestId('toast').filter({ hasText: 'Added' }).first()).toBeVisible()
}

export const nodeByTitle = (params: { readonly page: Page; readonly title: string }): Locator =>
  params.page
    .locator('[data-testid^="media-node-"]')
    .filter({ has: params.page.getByText(params.title, { exact: true }) })

type Box = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

const settledBox = async (locator: Locator): Promise<Box> => {
  let previous = await locator.boundingBox()
  await expect
    .poll(async () => {
      const current = await locator.boundingBox()
      const settled = current !== null && JSON.stringify(current) === JSON.stringify(previous)
      previous = current
      return settled
    })
    .toBe(true)
  if (previous === null) throw new Error('missing box')
  return previous
}

export const dragOnto = async (params: {
  readonly page: Page
  readonly source: Locator
  readonly target: Locator
}): Promise<void> => {
  const from = await settledBox(params.source)
  const to = await settledBox(params.target)
  await params.page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await params.page.mouse.down()
  await params.page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 })
  await params.page.mouse.up()
}
