import { useCallback, useState, type DragEvent } from 'react'
import { notify } from '../../shared/ui/index.ts'
import { useBoardQuery } from '../board/board.hooks.ts'
import { ITEM_DRAG_TYPE, parseItemIds } from '../board/domain/drop-data.ts'
import { useWorkspace } from '../workspace/workspace.context.ts'
import { AUTO_MODEL, claudeInstruction, danglingTokens, modelsFor } from './domain/prompt.ts'
import { ComposerView } from './Composer.view.tsx'
import { useGenerationCommands } from './generation.hooks.ts'

/** Insert at the caret only while the user is typing in the prompt; otherwise append. */
const caretOf = (target: EventTarget): number | null =>
  target instanceof HTMLTextAreaElement && target.ownerDocument.activeElement === target
    ? target.selectionStart
    : null

export const Composer = () => {
  const { board } = useBoardQuery()
  const { state, dispatch } = useWorkspace()
  const commands = useGenerationCommands()
  const [dropActive, setDropActive] = useState(false)
  const { composer } = state

  const references = composer.references
    .map((id) => board.items.find((item) => item.id === id))
    .filter((item) => item !== undefined)

  const onDrop = useCallback(
    (event: DragEvent) => {
      const itemIds = parseItemIds(event.dataTransfer.getData(ITEM_DRAG_TYPE))
      setDropActive(false)
      if (itemIds.length === 0) return
      event.preventDefault()
      dispatch({ type: 'referencesAdded', itemIds, caret: caretOf(event.target) })
    },
    [dispatch],
  )

  const onDragOver = useCallback((event: DragEvent) => {
    if (!event.dataTransfer.types.includes(ITEM_DRAG_TYPE)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setDropActive(true)
  }, [])

  const submit = useCallback(async () => {
    const created = await commands.create({
      input: {
        prompt: composer.prompt,
        kind: composer.kind,
        model: composer.model === AUTO_MODEL ? null : composer.model,
        aspectRatio: composer.aspectRatio === 'auto' ? null : composer.aspectRatio,
        count: composer.count,
        referenceItemIds: [...composer.references],
      },
    })
    if (created === undefined) return
    const instruction = claudeInstruction(created.id)
    const copied = await navigator.clipboard.writeText(instruction).then(
      () => true,
      () => false,
    )
    notify({
      title: 'Queued for Claude Code',
      description: copied
        ? `Instruction copied — paste it in Claude Code (${created.id}).`
        : instruction,
      tone: 'success',
    })
    dispatch({ type: 'composerReset' })
    dispatch({ type: 'panelTabChanged', tab: 'queue' })
  }, [commands, composer, dispatch])

  const dangling = danglingTokens({
    prompt: composer.prompt,
    referenceCount: composer.references.length,
  })

  return (
    <ComposerView
      composer={composer}
      references={references}
      models={modelsFor(composer.kind)}
      dangling={dangling}
      canSubmit={composer.prompt.trim() !== '' && dangling.length === 0}
      dropActive={dropActive}
      onPromptChange={(prompt) => {
        dispatch({ type: 'promptChanged', prompt })
      }}
      onSettingsChange={(settings) => {
        dispatch({ type: 'composerSettingsChanged', settings })
      }}
      onKindChange={(kind) => {
        dispatch({ type: 'composerSettingsChanged', settings: { kind, model: AUTO_MODEL } })
      }}
      onRemoveReference={(itemId) => {
        dispatch({ type: 'referenceRemoved', itemId })
      }}
      onUseSelection={() => {
        dispatch({ type: 'referencesAdded', itemIds: state.selection, caret: null })
      }}
      selectionCount={state.selection.length}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={() => {
        setDropActive(false)
      }}
      onSubmit={() => {
        void submit()
      }}
    />
  )
}
