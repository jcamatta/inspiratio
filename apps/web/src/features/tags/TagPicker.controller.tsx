import type { Tag } from '@inspiratio/shared'
import { useCallback, useState } from 'react'
import { useBoardCommands } from '../board/board.hooks.ts'
import { labelFor, listIdsFor, splitSelection, toChipOptions } from './domain/tag-options.ts'
import { TagPickerView } from './TagPicker.view.tsx'

export type TagPickerProps = {
  readonly tags: readonly Tag[]
  readonly value: readonly string[]
  readonly onChange: (tagIds: string[]) => void
  readonly creatable?: boolean
  readonly placeholder?: string
  readonly testId?: string
}

/** Global tag combobox: pick existing tags or create new ones inline (multi-select). */
export const TagPicker = ({
  tags,
  value,
  onChange,
  creatable = true,
  placeholder = 'Add tags…',
  testId = 'tag-picker',
}: TagPickerProps) => {
  const commands = useBoardCommands()
  const [inputValue, setInputValue] = useState('')

  const onValueChange = useCallback(
    async (ids: string[]) => {
      const { existing, toCreate } = splitSelection(ids)
      const created: string[] = []
      for (const name of toCreate) {
        const result = await commands.createTag({ name })
        if (result !== undefined) created.push(result.id)
      }
      setInputValue('')
      onChange([...existing, ...created])
    },
    [commands, onChange],
  )

  return (
    <TagPickerView
      options={toChipOptions(tags)}
      listIds={listIdsFor({ tags, inputValue, creatable })}
      value={value}
      onValueChange={(ids) => {
        void onValueChange(ids)
      }}
      inputValue={inputValue}
      onInputValueChange={setInputValue}
      labelOf={(id) => labelFor({ tags, id })}
      placeholder={placeholder}
      testId={testId}
    />
  )
}
