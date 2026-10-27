import type { Item, Tag } from '@inspiratio/shared'
import { MessageSquarePlus, MousePointerClick } from 'lucide-react'
import { Button, Stack, Text } from '../../shared/ui/index.ts'
import { TagPicker } from '../tags/TagPicker.controller.tsx'
import { ItemDetails } from './ItemDetails.controller.tsx'

export type InspectorViewProps = {
  readonly selected: readonly Item[]
  readonly tags: readonly Tag[]
  readonly sharedTagIds: readonly string[]
  readonly onTagsChange: (tagIds: string[]) => void
  readonly onUseAsReferences: () => void
}

export const InspectorView = (props: InspectorViewProps) => {
  const [first, ...rest] = props.selected
  if (first === undefined)
    return (
      <Stack
        align="center"
        justify="center"
        gap={2}
        className="flex-1 p-8 text-center"
        testId="inspector-empty"
      >
        <MousePointerClick size={20} className="text-muted-foreground" />
        <Text variant="caption">
          Select a reference to rename it, tag it and see its metadata. Shift-click or drag a box to
          select several.
        </Text>
      </Stack>
    )

  if (rest.length === 0)
    return (
      // Re-mounting on every server update resets the drafts to the saved values.
      <ItemDetails key={`${first.id}:${first.metadata.updatedAt}`} item={first} />
    )

  return (
    <Stack gap={4} className="p-4" testId="inspector-multi">
      <Text variant="title">{props.selected.length} references selected</Text>
      <Stack gap={2}>
        <Text variant="heading">Shared tags</Text>
        <TagPicker tags={props.tags} value={props.sharedTagIds} onChange={props.onTagsChange} />
        <Text variant="caption">Tags added here are applied to every selected reference.</Text>
      </Stack>
      <Button
        variant="primary"
        icon={MessageSquarePlus}
        onClick={props.onUseAsReferences}
        testId="inspector-use-references"
      >
        Use as prompt references
      </Button>
    </Stack>
  )
}
