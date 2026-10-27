import { useBoardCommands, useBoardQuery } from '../board/board.hooks.ts'
import { bulkTagUpdates, commonTagIds } from '../tags/domain/tag-options.ts'
import { useWorkspace } from '../workspace/workspace.context.ts'
import { InspectorView } from './Inspector.view.tsx'

export const Inspector = () => {
  const { board } = useBoardQuery()
  const { state, dispatch } = useWorkspace()
  const commands = useBoardCommands()
  const selected = board.items.filter((item) => state.selection.includes(item.id))
  const sharedTagIds = commonTagIds(selected)

  return (
    <InspectorView
      selected={selected}
      tags={board.tags}
      sharedTagIds={sharedTagIds}
      onTagsChange={(tagIds) => {
        for (const update of bulkTagUpdates({
          items: selected,
          previous: sharedTagIds,
          next: tagIds,
        }))
          void commands.setItemTags(update)
      }}
      onUseAsReferences={() => {
        dispatch({ type: 'referencesAdded', itemIds: selected.map((item) => item.id), caret: null })
      }}
    />
  )
}
