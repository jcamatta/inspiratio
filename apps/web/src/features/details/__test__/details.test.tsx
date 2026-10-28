import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createFakeApi, makeGeneration, makeItem } from '../../../__test__/fake-api.ts'
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

  it('lists the steps of the run with their durations and the guide used', async () => {
    const item = {
      ...generated,
      metadata: {
        ...generated.metadata,
        generation: { ...generated.metadata.generation, promptGuide: 'Name images by position' },
      },
    }
    const request = makeGeneration({
      id: 'gen_1',
      status: 'completed',
      queuedAt: '2026-10-27T10:00:00.000Z',
      finishedAt: '2026-10-27T10:01:12.000Z',
      steps: [
        {
          label: 'Starting Claude',
          startedAt: '2026-10-27T10:00:00.000Z',
          endedAt: '2026-10-27T10:00:09.000Z',
        },
        {
          label: 'Rendering on Higgsfield',
          startedAt: '2026-10-27T10:00:09.000Z',
          endedAt: '2026-10-27T10:01:12.000Z',
        },
      ],
    })
    const { user } = renderWithApp({
      ui: <Details item={item} onClose={vi.fn()} />,
      api: createFakeApi({ items: [item], generations: [request] }),
    })
    const toggle = await screen.findByTestId('details-steps-toggle')
    expect(toggle).toHaveTextContent('Steps · 1m 12s')
    await user.click(toggle)
    const steps = screen.getAllByTestId('details-step')
    expect(steps.map((step) => step.textContent)).toEqual([
      'Starting Claude9s',
      'Rendering on Higgsfield1m 3s',
    ])
    expect(screen.getByTestId('details-steps-total')).toHaveTextContent('1m 12s')
    await user.click(screen.getByTestId('details-prompt-guide-toggle'))
    expect(screen.getByText('Name images by position')).toBeInTheDocument()
  })

  it('hides steps when the request has none', () => {
    renderWithApp({
      ui: <Details item={generated} onClose={vi.fn()} />,
      api: createFakeApi({ items: [generated], generations: [makeGeneration({ id: 'gen_1' })] }),
    })
    expect(screen.queryByTestId('details-steps')).not.toBeInTheDocument()
    expect(screen.queryByTestId('details-prompt-guide')).not.toBeInTheDocument()
  })
})
