import { expect, test } from '@playwright/test'
import { board, nodeByTitle, pngFile, resetLibrary, uploadThroughToolbar } from './fixtures/app.ts'

test.beforeEach(async ({ page, request }) => {
  await resetLibrary(request)
  await page.goto('/')
})

test('imports references, renames, tags and filters them', async ({ page, request }) => {
  await expect(page.getByTestId('empty-state')).toBeVisible()
  await uploadThroughToolbar({
    page,
    files: [
      pngFile({ name: 'neon-alley.png', from: [13, 38, 29], to: [88, 252, 195] }),
      pngFile({ name: 'golden-hour.png', from: [252, 120, 88], to: [255, 220, 150] }),
    ],
  })
  await expect(page.locator('[data-testid^="media-node-"]')).toHaveCount(2)
  await expect(page.getByText('2 refs')).toBeVisible()

  await nodeByTitle({ page, title: 'neon-alley' }).click()
  const title = page.getByTestId('inspector-title')
  await title.fill('Neon alley at night')
  await title.press('Enter')
  await expect(nodeByTitle({ page, title: 'Neon alley at night' })).toBeVisible()

  const tags = page.getByTestId('inspector').getByTestId('tag-picker')
  await tags.fill('cyberpunk')
  await tags.press('Enter')
  await expect(page.getByTestId('inspector').getByTestId('chip-cyberpunk')).toBeVisible()
  await expect
    .poll(async () => (await board(request)).tags.map((tag) => tag.name))
    .toEqual(['cyberpunk'])

  await page.getByTestId('inspector-notes').fill('Teal & orange, wet asphalt')
  await page.getByTestId('inspector-title').click()
  await expect
    .poll(
      async () =>
        (await board(request)).items.find((item) => item.title === 'Neon alley at night')?.metadata
          .notes,
    )
    .toBe('Teal & orange, wet asphalt')

  const filter = page.getByTestId('filter-tags')
  await filter.fill('cyber')
  await filter.press('Enter')
  await expect(nodeByTitle({ page, title: 'golden-hour' })).toHaveClass(/opacity-20/)
  await expect(nodeByTitle({ page, title: 'Neon alley at night' })).not.toHaveClass(/opacity-20/)
})

test('groups references into a section by dragging and persists the layout', async ({
  page,
  request,
}) => {
  await uploadThroughToolbar({
    page,
    files: [pngFile({ name: 'fog.png', from: [40, 60, 70], to: [200, 220, 210] })],
  })
  await page.getByTestId('toolbar-add-section').click()
  await expect(page.locator('[data-testid^="section-node-"]')).toHaveCount(1)
  await page.getByTestId('toolbar-fit').click()

  const section = page.locator('[data-testid^="section-node-"]')
  const node = nodeByTitle({ page, title: 'fog' })
  const target = await section.boundingBox()
  const source = await node.boundingBox()
  if (target === null || source === null) throw new Error('missing boxes')
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 })
  await page.mouse.up()

  await expect
    .poll(async () => (await board(request)).items[0]?.sectionId)
    .toBe((await board(request)).sections[0]?.id)
  await page.reload()
  await expect(page.locator('[data-testid^="section-node-"]')).toContainText('1')

  await page.locator('[data-testid^="section-node-"]').getByTestId('section-title').dblclick()
  await page.getByTestId('section-title-input').fill('Act I — The city')
  await page.getByTestId('section-title-input').press('Enter')
  await expect(page.getByTestId('section-title')).toHaveText('Act I — The city')
})

test('opens the viewer and deletes from the context menu', async ({ page, request }) => {
  await uploadThroughToolbar({
    page,
    files: [pngFile({ name: 'still.png', from: [0, 0, 0], to: [255, 255, 255] })],
  })
  const node = nodeByTitle({ page, title: 'still' })
  await node.click({ button: 'right' })
  await page.getByTestId('menu-view').click()
  await expect(page.getByTestId('viewer')).toBeVisible()
  await page.keyboard.press('Escape')
  await node.click({ button: 'right' })
  await page.getByTestId('menu-delete').click()
  await expect(page.locator('[data-testid^="media-node-"]')).toHaveCount(0)
  await expect.poll(async () => (await board(request)).items.length).toBe(0)
})
