import { expect, test } from '@playwright/test'
import { board, dragOnto, dropFiles, nodeByTitle, pngFile, resetLibrary } from './fixtures/app.ts'

test.beforeEach(async ({ page, request }) => {
  await resetLibrary(request)
  await page.goto('/')
})

test('imports by drop, renames by double-click, tags and undoes', async ({ page, request }) => {
  await expect(page.getByTestId('empty-state')).toBeVisible()
  await dropFiles({
    page,
    files: [
      pngFile({ name: 'neon-alley.png', from: [13, 38, 29], to: [88, 252, 195] }),
      pngFile({ name: 'golden-hour.png', from: [252, 120, 88], to: [255, 220, 150] }),
    ],
  })
  await expect(page.locator('[data-testid^="media-node-"]')).toHaveCount(2)

  await nodeByTitle({ page, title: 'neon-alley' }).dblclick()
  await page.getByTestId('node-title-input').fill('Neon alley at night')
  await page.getByTestId('node-title-input').press('Enter')
  const renamed = nodeByTitle({ page, title: 'Neon alley at night' })
  await expect(renamed).toBeVisible()

  await renamed.click()
  await expect(renamed).toHaveAttribute('data-selected', 'true')
  await expect(page.getByTestId('selection-count')).toHaveText('1 selected')
  await renamed.getByTestId('node-add-tag').click()
  await page.getByTestId('node-tag-picker').fill('cyberpunk')
  await page.getByTestId('node-tag-picker').press('Enter')
  await page.keyboard.press('Escape')
  await expect(renamed.getByTestId('node-tag-cyberpunk')).toBeVisible()
  await renamed.getByRole('button', { name: 'Remove cyberpunk' }).click()
  await expect(renamed.getByTestId('node-tag-cyberpunk')).toHaveCount(0)

  await page.locator('.react-flow__pane').click({ position: { x: 20, y: 20 } })
  await page.keyboard.press('Control+z')
  await expect(renamed.getByTestId('node-tag-cyberpunk')).toBeVisible()
  await page.keyboard.press('Control+z')
  await page.keyboard.press('Control+z')
  await expect(nodeByTitle({ page, title: 'neon-alley' })).toBeVisible()
  await page.keyboard.press('Control+Shift+z')
  await expect(nodeByTitle({ page, title: 'Neon alley at night' })).toBeVisible()
  await expect
    .poll(async () => (await board(request)).items.map((item) => item.title).sort())
    .toEqual(['Neon alley at night', 'golden-hour'])
})

test('groups references into a section and keeps them when the section is deleted', async ({
  page,
  request,
}) => {
  await dropFiles({
    page,
    files: [pngFile({ name: 'fog.png', from: [40, 60, 70], to: [200, 220, 210] })],
  })
  await page.locator('.react-flow__pane').click({ button: 'right', position: { x: 900, y: 200 } })
  await page.getByTestId('menu-add-section').click()
  const section = page.locator('[data-testid^="section-node-"]')
  await expect(section).toHaveCount(1)
  await page.getByTestId('fit').click()

  await dragOnto({ page, source: nodeByTitle({ page, title: 'fog' }), target: section })
  await expect
    .poll(async () => (await board(request)).items[0]?.sectionId)
    .toBe((await board(request)).sections[0]?.id)

  await section.getByTestId('section-title').click({ button: 'right' })
  await page.getByTestId('menu-rename-section').click()
  await page.getByTestId('section-title-input').fill('Act I — The city')
  await page.getByTestId('section-title-input').press('Enter')
  await expect(page.getByTestId('section-title')).toHaveText('Act I — The city')

  await section.getByTestId('section-title').click({ button: 'right' })
  await page.getByTestId('menu-delete-section').click()
  await expect(section).toHaveCount(0)
  await expect(nodeByTitle({ page, title: 'fog' })).toBeVisible()
  await page.getByTestId('undo').click()
  await expect(page.locator('[data-testid^="section-node-"]')).toHaveCount(1)
  await expect.poll(async () => (await board(request)).items[0]?.sectionId).not.toBeNull()
})

test('views full size with zoom and deletes with undo from the context menu', async ({
  page,
  request,
}) => {
  await dropFiles({
    page,
    files: [pngFile({ name: 'still.png', from: [0, 0, 0], to: [255, 255, 255] })],
  })
  const node = nodeByTitle({ page, title: 'still' })
  await node.click({ button: 'right' })
  await page.getByTestId('menu-view').click()
  const viewer = page.getByTestId('viewer')
  await expect(viewer).toBeVisible()
  await page.getByTestId('viewer-stage').hover()
  await page.mouse.wheel(0, -500)
  await expect(page.getByTestId('viewer-zoom')).not.toHaveText('100%')
  await page.getByTestId('viewer-reset').click()
  await expect(page.getByTestId('viewer-zoom')).toHaveText('100%')
  await page.getByTestId('dialog-close').click()
  await expect(viewer).toHaveCount(0)

  await node.click({ button: 'right' })
  await page.getByTestId('menu-delete').click()
  await expect(page.locator('[data-testid^="media-node-"]')).toHaveCount(0)
  await page.getByTestId('undo').click()
  await expect(page.locator('[data-testid^="media-node-"]')).toHaveCount(1)
  await expect.poll(async () => (await board(request)).items.length).toBe(1)
})

test('creates a section around the selected images from the floating toolbar', async ({
  page,
  request,
}) => {
  await dropFiles({
    page,
    files: [
      pngFile({ name: 'dawn.png', from: [250, 200, 120], to: [80, 40, 90] }),
      pngFile({ name: 'dusk.png', from: [30, 20, 70], to: [200, 90, 60] }),
    ],
  })
  await page.getByTestId('fit').click()
  await nodeByTitle({ page, title: 'dawn' }).click()
  await nodeByTitle({ page, title: 'dusk' }).click({ modifiers: ['Shift'] })
  await expect(page.getByTestId('selection-count')).toHaveText('2 selected')
  const toolbar = page.getByTestId('selection-toolbar')
  await expect(toolbar).toBeVisible()
  await expect(toolbar.getByTestId('toolbar-view')).toHaveCount(0)
  await toolbar.getByTestId('toolbar-create-section').click()
  await expect(page.locator('[data-testid^="section-node-"]')).toHaveCount(1)
  await expect
    .poll(async () => {
      const snapshot = await board(request)
      const sectionId = snapshot.sections[0]?.id
      return snapshot.items.every((item) => item.sectionId === sectionId)
    })
    .toBe(true)
  await page.getByTestId('undo').click()
  await expect(page.locator('[data-testid^="section-node-"]')).toHaveCount(0)
})
