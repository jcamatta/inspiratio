import { QueryClient } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Providers } from '../../../app/Providers.tsx'
import { createFakeApi, makeGeneration, makeItem, makeSection } from '../../../__test__/fake-api.ts'
import { useGenerationsQuery } from '../../generation/generation.hooks.ts'
import { useHistory } from '../../history/history.context.ts'
import { useBoardActions } from '../board.actions.ts'
import { useBoardQuery } from '../board.hooks.ts'

const setup = () => {
  const api = createFakeApi({
    items: [
      makeItem({ id: 'itm_a', position: { x: 0, y: 0 } }),
      makeItem({ id: 'itm_b', position: { x: 400, y: 0 } }),
    ],
    sections: [makeSection({ id: 'sec_1', position: { x: 0, y: 500 } })],
    generations: [
      makeGeneration({
        id: 'gen_1',
        status: 'draft',
        prompt: 'Storm @1',
        references: [{ itemId: 'itm_a', label: '@1' }],
      }),
    ],
  })
  vi.stubGlobal('fetch', api.fetch)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <Providers queryClient={queryClient}>{children}</Providers>
  )
  const hook = renderHook(
    () => ({
      actions: useBoardActions(),
      history: useHistory(),
      board: useBoardQuery(),
      generations: useGenerationsQuery(),
    }),
    { wrapper },
  )
  return { api, hook }
}

const loaded = async (hook: ReturnType<typeof setup>['hook']) => {
  await waitFor(() => {
    expect(hook.result.current.board.board.items).toHaveLength(2)
    expect(hook.result.current.generations.requests).toHaveLength(1)
  })
}

describe('board actions', () => {
  it('adds dropped images as prompt references and moves cards, with undo', async () => {
    const { api, hook } = setup()
    await loaded(hook)
    act(() => {
      hook.result.current.actions.persistPlan({
        items: [{ id: 'itm_a', position: { x: 10, y: 10 } }],
        sections: [{ id: 'sec_1', position: { x: 5, y: 600 }, size: { width: 700, height: 500 } }],
        prompts: [{ id: 'gen_1', position: { x: 900, y: 40 } }],
        drops: [
          { promptId: 'gen_1', itemIds: ['itm_b', 'itm_a'] },
          { promptId: 'gen_gone', itemIds: ['itm_a'] },
        ],
      })
    })
    await waitFor(() => {
      expect(api.state.generations[0]).toMatchObject({
        prompt: 'Storm @1 @2',
        position: { x: 900, y: 40 },
        references: [{ itemId: 'itm_a' }, { itemId: 'itm_b' }],
      })
      expect(api.state.sections[0]).toMatchObject({ position: { x: 5, y: 600 } })
      expect(api.state.items[0]?.position).toEqual({ x: 10, y: 10 })
    })
    await waitFor(() => {
      expect(hook.result.current.history.canUndo).toBe(true)
    })
    await act(async () => {
      await hook.result.current.history.undo()
    })
    expect(api.state.generations[0]).toMatchObject({
      prompt: 'Storm @1',
      position: { x: 600, y: 0 },
    })
    expect(api.state.generations[0]?.references).toHaveLength(1)
    expect(api.state.sections[0]?.position).toEqual({ x: 0, y: 500 })
    expect(api.state.items[0]?.position).toEqual({ x: 0, y: 0 })
  })

  it('ignores no-op renames and unknown targets', async () => {
    const { api, hook } = setup()
    await loaded(hook)
    const { actions } = hook.result.current
    act(() => {
      actions.rename({ id: 'itm_a', title: 'itm_a' })
      actions.rename({ id: 'ghost', title: 'x' })
      actions.setTags({ id: 'ghost', tagIds: [] })
      actions.deleteItems([])
      actions.detach([])
      actions.renameSection({ id: 'sec_1', title: '' })
      actions.deleteSection('ghost')
      actions.deletePrompt('ghost')
      actions.removePromptReference({ promptId: 'ghost', itemId: 'itm_a' })
      actions.recordImport([])
    })
    expect(hook.result.current.history.canUndo).toBe(false)
    expect(api.requests.filter((request) => request.method !== 'GET')).toEqual([])
    await act(async () => {
      await hook.result.current.history.undo()
      await hook.result.current.history.redo()
      await actions.refresh()
    })
  })

  it('deletes several items and restores them', async () => {
    const { api, hook } = setup()
    await loaded(hook)
    act(() => {
      hook.result.current.actions.deleteItems(['itm_a', 'itm_b'])
    })
    await waitFor(() => {
      expect(api.state.items).toHaveLength(0)
    })
    await act(async () => {
      await hook.result.current.history.undo()
    })
    expect(api.state.items).toHaveLength(2)
  })
})
