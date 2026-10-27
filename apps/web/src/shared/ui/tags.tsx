import { Button as BaseButton } from '@base-ui/react/button'
import { Combobox as BaseCombobox } from '@base-ui/react/combobox'
import type { TagColor } from '@inspiratio/shared'
import { Plus, Sparkles, X } from 'lucide-react'
import { parseCreateOption } from '../lib/create-option.ts'
import { cx } from '../lib/cx.ts'

const TAG_TONE: Readonly<Record<TagColor, string>> = {
  mint: 'bg-tag-mint text-tag-mint-fg',
  coral: 'bg-tag-coral text-tag-coral-fg',
  sky: 'bg-tag-sky text-tag-sky-fg',
  amber: 'bg-tag-amber text-tag-amber-fg',
  violet: 'bg-tag-violet text-tag-violet-fg',
  slate: 'bg-tag-slate text-tag-slate-fg',
}

export type TagChipProps = {
  readonly name: string
  readonly color: TagColor
  readonly system?: boolean
  readonly size?: 'xs' | 'sm'
  readonly testId?: string
  readonly onRemove?: () => void
}

export const TagChip = ({
  name,
  color,
  system = false,
  size = 'sm',
  testId,
  onRemove,
}: TagChipProps) => (
  <span
    data-testid={testId}
    className={cx(
      'inline-flex max-w-40 items-center gap-1 rounded-full font-medium',
      size === 'xs' ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-[11px]',
      TAG_TONE[color],
    )}
  >
    {system && <Sparkles size={10} aria-label="system tag" />}
    <span className="truncate">{name}</span>
    {onRemove !== undefined && (
      <BaseButton
        aria-label={`Remove ${name}`}
        onClick={onRemove}
        className="nodrag -mr-0.5 cursor-pointer rounded-full p-px hover:bg-black/10"
      >
        <X size={size === 'xs' ? 9 : 10} />
      </BaseButton>
    )}
  </span>
)

export type ChipOption = {
  readonly id: string
  readonly name: string
  readonly color: TagColor
  readonly system: boolean
}

export type ChipComboboxProps = {
  readonly options: readonly ChipOption[]
  /** Ids shown in the list (options plus an optional create sentinel). */
  readonly listIds: readonly string[]
  readonly value: readonly string[]
  readonly onValueChange: (ids: string[]) => void
  readonly inputValue: string
  readonly onInputValueChange: (value: string) => void
  readonly labelOf: (id: string) => string
  readonly placeholder: string
  readonly testId?: string
  readonly autoFocus?: boolean
  readonly onEscape?: () => void
}

/** Multi-select combobox with chips (Base UI Combobox). Options are addressed by id. */
export const ChipCombobox = ({
  options,
  listIds,
  value,
  onValueChange,
  inputValue,
  onInputValueChange,
  labelOf,
  placeholder,
  testId,
  autoFocus = false,
  onEscape,
}: ChipComboboxProps) => {
  const optionOf = (id: string): ChipOption | undefined =>
    options.find((option) => option.id === id)
  return (
    <BaseCombobox.Root
      multiple
      autoHighlight
      items={listIds}
      value={[...value]}
      onValueChange={(next: string[]) => {
        onValueChange(next)
      }}
      inputValue={inputValue}
      onInputValueChange={(next: string) => {
        onInputValueChange(next)
      }}
      itemToStringLabel={labelOf}
    >
      <BaseCombobox.Chips className="flex min-h-8 w-full flex-wrap items-center gap-1 rounded-lg border border-border-strong bg-panel px-1.5 py-1 focus-within:border-input focus-within:ring-2 focus-within:ring-primary/40">
        <BaseCombobox.Value>
          {(selected: string[]) =>
            selected.map((id) => {
              const option = optionOf(id)
              return (
                <BaseCombobox.Chip
                  key={id}
                  data-testid={`chip-${labelOf(id)}`}
                  className={cx(
                    'flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2 text-[11px] font-medium outline-none',
                    TAG_TONE[option?.color ?? 'slate'],
                  )}
                >
                  {option?.system === true && <Sparkles size={10} />}
                  {labelOf(id)}
                  <BaseCombobox.ChipRemove
                    aria-label={`Remove ${labelOf(id)}`}
                    className="cursor-pointer rounded-full p-0.5 hover:bg-black/10"
                  >
                    <X size={10} />
                  </BaseCombobox.ChipRemove>
                </BaseCombobox.Chip>
              )
            })
          }
        </BaseCombobox.Value>
        <BaseCombobox.Input
          data-testid={testId}
          autoFocus={autoFocus}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            event.preventBaseUIHandler()
            onEscape?.()
          }}
          placeholder={value.length === 0 ? placeholder : ''}
          className="h-6 min-w-16 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground/70"
        />
      </BaseCombobox.Chips>
      <BaseCombobox.Portal>
        <BaseCombobox.Positioner className="z-50" sideOffset={4}>
          <BaseCombobox.Popup className="max-h-64 w-(--anchor-width) overflow-y-auto rounded-xl border border-border bg-panel p-1 text-sm shadow-(--shadow-panel) outline-none">
            <BaseCombobox.Empty className="px-2 py-1.5 text-xs text-muted-foreground empty:hidden">
              No tags
            </BaseCombobox.Empty>
            <BaseCombobox.List>
              {(id: string) => {
                const creating = parseCreateOption(id)
                const option = optionOf(id)
                return (
                  <BaseCombobox.Item
                    key={id}
                    value={id}
                    data-testid={creating === null ? `option-${labelOf(id)}` : 'option-create'}
                    className="flex cursor-default items-center gap-2 rounded-lg px-2 py-1.5 outline-none select-none data-[highlighted]:bg-surface"
                  >
                    {creating === null ? (
                      <TagChip
                        name={labelOf(id)}
                        color={option?.color ?? 'slate'}
                        system={option?.system ?? false}
                      />
                    ) : (
                      <>
                        <Plus size={14} className="text-mint-700" />
                        <span>
                          Create <strong>{creating}</strong>
                        </span>
                      </>
                    )}
                  </BaseCombobox.Item>
                )
              }}
            </BaseCombobox.List>
          </BaseCombobox.Popup>
        </BaseCombobox.Positioner>
      </BaseCombobox.Portal>
    </BaseCombobox.Root>
  )
}
