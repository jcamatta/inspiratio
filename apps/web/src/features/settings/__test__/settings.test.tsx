import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createFakeApi } from '../../../__test__/fake-api.ts'
import { renderWithApp } from '../../../__test__/render.tsx'
import { Settings } from '../Settings.controller.tsx'

describe('Settings', () => {
  it('shows the storage folders, copies a path and opens a folder', async () => {
    const api = createFakeApi({})
    const { user } = renderWithApp({ ui: <Settings />, api })
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
    await user.click(screen.getByTestId('settings'))
    expect(await screen.findByTestId('storage-media-path')).toHaveTextContent('D:/data/media')
    await user.click(screen.getByTestId('copy-trash'))
    expect(writeText).toHaveBeenCalledWith('D:/data/trash')
    await user.click(screen.getByTestId('open-trash'))
    await waitFor(() => {
      expect(api.requests).toContainEqual(
        expect.objectContaining({ method: 'POST', path: '/api/storage/open' }),
      )
    })
  })
})
