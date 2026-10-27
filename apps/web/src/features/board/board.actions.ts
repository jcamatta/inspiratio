import type { GenerationKind, GenerationRequest, LayoutChange, Vec2 } from '@inspiratio/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useGenerationCommands, useGenerationsQuery } from '../generation/generation.hooks.ts'
import { dropReferences, removeReference } from '../generation/domain/prompt.ts'
import { useHistory } from '../history/history.context.ts'
import { useBoardCommands, useBoardQuery } from './board.hooks.ts'
import { sectionAround } from './domain/context-target.ts'
import type { PersistencePlan, SectionPatch } from './domain/flow-mapping.ts'
import { inverseLayout, inverseSectionPatch, sectionChildren } from './domain/undo.ts'

type Step = () => Promise<unknown>

const sequence =
  (steps: readonly Step[]): Step =>
  async () => {
    for (const step of steps) await step()
  }

const referenceIds = (request: GenerationRequest): string[] =>
  request.references.map((reference) => reference.itemId)

/** Board actions: each one performs its commands and records how to undo them. */
export const useBoardActions = () => {
  const { board } = useBoardQuery()
  const { requests } = useGenerationsQuery()
  const commands = useBoardCommands()
  const generations = useGenerationCommands()
  const history = useHistory()
  const queryClient = useQueryClient()

  const perform = useCallback(
    async (params: { readonly label: string; readonly redo: Step; readonly undo: Step }) => {
      history.record(params)
      await params.redo()
    },
    [history],
  )

  const layout =
    (changes: readonly LayoutChange[]): Step =>
    async () => {
      if (changes.length > 0) await commands.applyLayout({ changes: [...changes] })
    }

  const patchSection =
    (patch: SectionPatch): Step =>
    async () => {
      const { id, ...rest } = patch
      await commands.updateSection({ id, patch: rest })
    }

  const patchPrompt =
    (params: {
      readonly id: string
      readonly request: Partial<GenerationRequest> & { readonly referenceItemIds?: string[] }
    }): Step =>
    async () => {
      const { referenceItemIds, prompt, position, size } = params.request
      await generations.update({
        id: params.id,
        patch: {
          ...(referenceItemIds === undefined ? {} : { referenceItemIds }),
          ...(prompt === undefined ? {} : { prompt }),
          ...(position === undefined ? {} : { position }),
          ...(size === undefined ? {} : { size }),
        },
      })
    }

  const requestOf = (id: string) => requests.find((request) => request.id === id)

  const persistPlan = (plan: PersistencePlan): void => {
    const redo: Step[] = [layout(plan.items)]
    const undo: Step[] = [layout(inverseLayout({ changes: plan.items, items: board.items }))]
    for (const patch of plan.sections) {
      redo.push(patchSection(patch))
      const inverse = inverseSectionPatch({ patch, sections: board.sections })
      if (inverse !== null) undo.push(patchSection(inverse))
    }
    for (const patch of plan.prompts) {
      const before = requestOf(patch.id)
      const { id, ...request } = patch
      redo.push(patchPrompt({ id, request }))
      if (before !== undefined)
        undo.push(
          patchPrompt({
            id,
            request: {
              position: before.position,
              ...(patch.size === undefined ? {} : { size: before.size }),
            },
          }),
        )
    }
    for (const drop of plan.drops) {
      const before = requestOf(drop.promptId)
      if (before === undefined) continue
      const next = dropReferences({
        prompt: before.prompt,
        references: referenceIds(before),
        itemIds: drop.itemIds,
        caret: null,
      })
      redo.push(
        patchPrompt({
          id: before.id,
          request: { prompt: next.prompt.trim(), referenceItemIds: next.references },
        }),
      )
      undo.push(
        patchPrompt({
          id: before.id,
          request: { prompt: before.prompt, referenceItemIds: referenceIds(before) },
        }),
      )
    }
    const label =
      plan.drops.length > 0
        ? 'Add reference'
        : plan.prompts.some((patch) => patch.size !== undefined)
          ? 'Resize'
          : 'Move'
    void perform({ label, redo: sequence(redo), undo: sequence(undo.reverse()) })
  }

  const rename = (params: { readonly id: string; readonly title: string }) => {
    const before = board.items.find((item) => item.id === params.id)
    if (before === undefined || params.title === before.title || params.title === '') return
    void perform({
      label: 'Rename',
      redo: () => commands.updateItem({ id: params.id, patch: { title: params.title } }),
      undo: () => commands.updateItem({ id: params.id, patch: { title: before.title } }),
    })
  }

  const setTags = (params: { readonly id: string; readonly tagIds: readonly string[] }) => {
    const before = board.items.find((item) => item.id === params.id)
    if (before === undefined) return
    void perform({
      label: 'Tags',
      redo: () => commands.setItemTags({ id: params.id, tagIds: [...params.tagIds] }),
      undo: () => commands.setItemTags({ id: params.id, tagIds: before.tagIds }),
    })
  }

  const deleteItems = (ids: readonly string[]) => {
    if (ids.length === 0) return
    void perform({
      label: ids.length === 1 ? 'Delete' : `Delete ${String(ids.length)} items`,
      redo: sequence(ids.map((id) => () => commands.deleteItem({ id }))),
      undo: sequence(ids.map((id) => () => commands.restoreItem({ id }))),
    })
  }

  const setZIndex = (params: { readonly ids: readonly string[]; readonly zIndex: number }) => {
    const before = board.items.filter((item) => params.ids.includes(item.id))
    void perform({
      label: 'Reorder',
      redo: sequence(
        before.map(
          (item) => () => commands.updateItem({ id: item.id, patch: { zIndex: params.zIndex } }),
        ),
      ),
      undo: sequence(
        before.map(
          (item) => () => commands.updateItem({ id: item.id, patch: { zIndex: item.zIndex } }),
        ),
      ),
    })
  }

  const detach = (changes: readonly LayoutChange[]) => {
    if (changes.length === 0) return
    void perform({
      label: 'Remove from section',
      redo: layout(changes),
      undo: layout(inverseLayout({ changes, items: board.items })),
    })
  }

  const createSection = (position: Vec2) => {
    let id: string | undefined
    void perform({
      label: 'Add section',
      redo: async () => {
        id = (await commands.createSection({ input: { position } }))?.id
      },
      undo: async () => {
        if (id !== undefined) await commands.deleteSection({ id })
      },
    })
  }

  const createSectionFrom = (ids: readonly string[]) => {
    const frame = sectionAround({ ids, items: board.items, sections: board.sections })
    if (frame === null) return
    const restore = inverseLayout({
      changes: frame.members.map((member) => ({ ...member, sectionId: null })),
      items: board.items,
    })
    let id: string | undefined
    void perform({
      label: 'Create section',
      redo: async () => {
        id = (
          await commands.createSection({
            input: { position: frame.position, size: frame.size },
          })
        )?.id
        if (id !== undefined) {
          const sectionId = id
          await commands.applyLayout({
            changes: frame.members.map((member) => ({ ...member, sectionId })),
          })
        }
      },
      undo: async () => {
        await commands.applyLayout({ changes: restore })
        if (id !== undefined) await commands.deleteSection({ id })
      },
    })
  }

  const renameSection = (params: { readonly id: string; readonly title: string }) => {
    const before = board.sections.find((section) => section.id === params.id)
    if (before === undefined || params.title === '' || params.title === before.title) return
    void perform({
      label: 'Rename section',
      redo: () => commands.updateSection({ id: params.id, patch: { title: params.title } }),
      undo: () => commands.updateSection({ id: params.id, patch: { title: before.title } }),
    })
  }

  const deleteSection = (sectionId: string) => {
    const section = board.sections.find((candidate) => candidate.id === sectionId)
    if (section === undefined) return
    const children = sectionChildren({ sectionId, items: board.items })
    let currentId = sectionId
    void perform({
      label: 'Delete section',
      redo: () => commands.deleteSection({ id: currentId }),
      undo: async () => {
        const created = await commands.createSection({
          input: {
            title: section.title,
            position: section.position,
            size: section.size,
            color: section.color,
          },
        })
        if (created === undefined) return
        currentId = created.id
        if (children.length > 0)
          await commands.applyLayout({
            changes: children.map((child) => ({ ...child, sectionId: created.id })),
          })
      },
    })
  }

  const createPrompt = (params: {
    readonly position: Vec2
    readonly kind: GenerationKind
    readonly referenceItemIds: readonly string[]
  }) => {
    let id: string | undefined
    const prompt = dropReferences({
      prompt: '',
      references: [],
      itemIds: params.referenceItemIds,
      caret: null,
    })
    void perform({
      label: 'New prompt',
      redo: async () => {
        id = (
          await generations.create({
            input: {
              submit: false,
              kind: params.kind,
              position: params.position,
              referenceItemIds: prompt.references,
              prompt: prompt.prompt.trim(),
            },
          })
        )?.id
      },
      undo: async () => {
        if (id !== undefined) await generations.remove({ id })
      },
    })
  }

  const deletePrompt = (promptId: string) => {
    const request = requestOf(promptId)
    if (request === undefined) return
    let currentId = promptId
    void perform({
      label: 'Delete prompt',
      redo: () => generations.remove({ id: currentId }),
      undo: async () => {
        const created = await generations.create({
          input: {
            submit: false,
            kind: request.kind,
            model: request.model,
            aspectRatio: request.aspectRatio,
            count: request.count,
            position: request.position,
            size: request.size,
            prompt: request.prompt,
            referenceItemIds: referenceIds(request),
          },
        })
        if (created !== undefined) currentId = created.id
      },
    })
  }

  const removePromptReference = (params: {
    readonly promptId: string
    readonly itemId: string
  }) => {
    const request = requestOf(params.promptId)
    if (request === undefined) return
    const next = removeReference({
      prompt: request.prompt,
      references: referenceIds(request),
      itemId: params.itemId,
    })
    void perform({
      label: 'Remove reference',
      redo: patchPrompt({
        id: request.id,
        request: { prompt: next.prompt, referenceItemIds: next.references },
      }),
      undo: patchPrompt({
        id: request.id,
        request: { prompt: request.prompt, referenceItemIds: referenceIds(request) },
      }),
    })
  }

  const recordImport = (ids: readonly string[]) => {
    if (ids.length === 0) return
    history.record({
      label: ids.length === 1 ? 'Import' : `Import ${String(ids.length)} items`,
      undo: sequence(ids.map((id) => () => commands.deleteItem({ id }))),
      redo: sequence(ids.map((id) => () => commands.restoreItem({ id }))),
    })
  }

  const refresh = () => queryClient.invalidateQueries()

  return {
    persistPlan,
    rename,
    setTags,
    deleteItems,
    setZIndex,
    detach,
    createSection,
    createSectionFrom,
    renameSection,
    deleteSection,
    createPrompt,
    deletePrompt,
    removePromptReference,
    recordImport,
    refresh,
  }
}

export type BoardActions = ReturnType<typeof useBoardActions>
