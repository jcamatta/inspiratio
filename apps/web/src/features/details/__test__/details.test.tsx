import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createFakeApi, makeItem } from '../../../__test__/fake-api.ts'
import { renderWithApp } from '../../../__test__/render.tsx'
import { Details } from '../Details.controller.tsx'

const base = makeItem({ id: 'itm_g' })
const generated = {
  ...base,
  metadata: {
    ...base.metadata,
    origin: 'generated' as const,
    generation: {
      requestId: 'gen_1',
      provider: 'higgsfield',
      model: 'nano_banana_pro',
      prompt: 'usa el estilo de @1',
      providerPrompt: 'Repaint image 2 in the style of image 1',
      run: 1,
      promptGuide: null,
      referenceItemIds: [],
    },
  },
}

describe('Details', () => {
  it('keeps the prompt sent to the provider behind a toggle and copies it', async () => {
    const { user } = renderWithApp({
      ui: <Details item={generated} onClose={vi.fn()} />,
      api: createFakeApi({ items: [generated] }),
    })
    const copy = vi.spyOn(navigator.clipboard, 'writeText')
    expect(screen.getByTestId('details-prompt')).toHaveTextContent('usa el estilo de @1')
    expect(screen.queryByText('Repaint image 2 in the style of image 1')).not.toBeInTheDocument()
    await user.click(screen.getByTestId('details-provider-prompt-toggle'))
    expect(screen.getByText('Repaint image 2 in the style of image 1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Copy sent prompt' }))
    expect(copy).toHaveBeenCalledWith('Repaint image 2 in the style of image 1')
  })
})
