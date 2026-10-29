import { ScrollArea as BaseScrollArea } from '@base-ui/react/scroll-area'
import { Select as BaseSelect } from '@base-ui/react/select'
import { Separator as BaseSeparator } from '@base-ui/react/separator'
import { Slider as BaseSlider } from '@base-ui/react/slider'
import { Tabs as BaseTabs } from '@base-ui/react/tabs'
import { Toggle as BaseToggle } from '@base-ui/react/toggle'
import { ToggleGroup as BaseToggleGroup } from '@base-ui/react/toggle-group'
import { Check, ChevronsUpDown, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from '../lib/cx.ts'

export type SelectOption<V extends string> = { readonly value: V; readonly label: string }

export type SelectProps<V extends string> = {
  readonly value: V
  readonly onValueChange: (value: V) => void
  readonly options: readonly SelectOption<V>[]
  readonly label?: string
  readonly testId?: string
}

export const Select = <V extends string>({
  value,
  onValueChange,
  options,
  label,
  testId,
}: SelectProps<V>) => (
  <BaseSelect.Root
    value={value}
    items={options}
    onValueChange={(next) => {
      if (next !== null) onValueChange(next)
    }}
  >
    <div className="flex min-w-0 flex-col gap-1">
      {label !== undefined && (
        <BaseSelect.Label className="text-xs font-medium text-muted-foreground">
          {label}
        </BaseSelect.Label>
      )}
      <BaseSelect.Trigger
        data-testid={testId}
        className="flex h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-border-strong bg-panel px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <BaseSelect.Value className="truncate" />
        <BaseSelect.Icon>
          <ChevronsUpDown size={14} className="text-muted-foreground" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
    </div>
    <BaseSelect.Portal>
      <BaseSelect.Positioner className="z-50" sideOffset={4} alignItemWithTrigger={false}>
        <BaseSelect.Popup className="max-h-72 min-w-(--anchor-width) overflow-y-auto rounded-xl border border-border bg-panel p-1 text-sm shadow-(--shadow-panel) outline-none">
          {options.map((option) => (
            <BaseSelect.Item
              key={option.value}
              value={option.value}
              className="flex cursor-default items-center gap-2 rounded-lg px-2 py-1.5 outline-none select-none data-[highlighted]:bg-surface"
            >
              <BaseSelect.ItemIndicator className="w-3.5">
                <Check size={14} />
              </BaseSelect.ItemIndicator>
              <BaseSelect.ItemText>{option.label}</BaseSelect.ItemText>
            </BaseSelect.Item>
          ))}
        </BaseSelect.Popup>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  </BaseSelect.Root>
)

export type ChipSelectProps<V extends string> = {
  readonly value: V
  readonly onValueChange: (value: V) => void
  readonly options: readonly SelectOption<V>[]
  /** Names the setting: tooltip, accessible name and heading of the menu. */
  readonly label: string
  readonly icon: ReactNode
  /** Stretches across the row, e.g. for the model. */
  readonly wide?: boolean
  readonly testId?: string
}

const CHIP =
  'inline-flex h-7 min-w-0 cursor-pointer items-center gap-1.5 rounded-full border border-transparent bg-surface px-2.5 text-xs font-medium text-foreground outline-none transition hover:border-border-strong focus-visible:ring-2 focus-visible:ring-primary/40'

/** A compact pill that shows an icon and the current value; the menu opens on click. */
export const ChipSelect = <V extends string>({
  value,
  onValueChange,
  options,
  label,
  icon,
  wide = false,
  testId,
}: ChipSelectProps<V>) => (
  <BaseSelect.Root
    value={value}
    items={options}
    onValueChange={(next) => {
      if (next !== null) onValueChange(next)
    }}
  >
    <BaseSelect.Trigger
      data-testid={testId}
      aria-label={label}
      title={label}
      className={cx(CHIP, 'data-[popup-open]:border-primary', wide && 'w-full')}
    >
      <span className="flex shrink-0 items-center text-muted-foreground">{icon}</span>
      <BaseSelect.Value className="truncate" />
    </BaseSelect.Trigger>
    <BaseSelect.Portal>
      <BaseSelect.Positioner className="z-50" sideOffset={6} alignItemWithTrigger={false}>
        <BaseSelect.Popup className="max-h-72 min-w-36 overflow-y-auto rounded-xl border border-border bg-panel p-1 text-sm shadow-(--shadow-panel) outline-none">
          <div className="px-2 pt-1 pb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </div>
          {options.map((option) => (
            <BaseSelect.Item
              key={option.value}
              value={option.value}
              className="flex cursor-default items-center gap-2 rounded-lg px-2 py-1.5 outline-none select-none data-[highlighted]:bg-surface"
            >
              <BaseSelect.ItemIndicator className="w-3.5">
                <Check size={14} />
              </BaseSelect.ItemIndicator>
              <BaseSelect.ItemText>{option.label}</BaseSelect.ItemText>
            </BaseSelect.Item>
          ))}
        </BaseSelect.Popup>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  </BaseSelect.Root>
)

/** An on/off pill with a different icon per state, e.g. sound on and muted. */
export const ToggleChip = ({
  pressed,
  onPressedChange,
  label,
  onIcon,
  offIcon,
  testId,
}: {
  readonly pressed: boolean
  readonly onPressedChange: (pressed: boolean) => void
  readonly label: string
  readonly onIcon: LucideIcon
  readonly offIcon: LucideIcon
  readonly testId?: string
}) => {
  const Icon = pressed ? onIcon : offIcon
  return (
    <BaseToggle
      pressed={pressed}
      onPressedChange={onPressedChange}
      aria-label={label}
      title={`${label} ${pressed ? 'on' : 'off'}`}
      data-testid={testId}
      className={cx(CHIP, !pressed && 'text-muted-foreground')}
    >
      <Icon size={14} strokeWidth={1.75} className="shrink-0" />
      {label}
    </BaseToggle>
  )
}

export type SliderProps = {
  readonly value: number
  readonly max: number
  readonly onValueChange: (value: number) => void
  readonly label: string
  readonly step?: number
  readonly testId?: string
}

export const Slider = ({ value, max, onValueChange, label, step = 0.01, testId }: SliderProps) => (
  <BaseSlider.Root
    value={value}
    max={max > 0 ? max : 1}
    step={step}
    onValueChange={(next: number | readonly number[]) => {
      onValueChange(typeof next === 'number' ? next : (next[0] ?? 0))
    }}
    className="w-full"
  >
    <BaseSlider.Control className="flex h-4 w-full items-center">
      <BaseSlider.Track className="h-1 w-full rounded-full bg-white/35">
        <BaseSlider.Indicator className="rounded-full bg-primary" />
        <BaseSlider.Thumb
          aria-label={label}
          data-testid={testId}
          className="size-3 rounded-full bg-white shadow outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </BaseSlider.Track>
    </BaseSlider.Control>
  </BaseSlider.Root>
)

export type ScrollAreaProps = {
  readonly children: ReactNode
  readonly className?: string
  /** Takes the full height of its parent; the content stretches to at least that height. */
  readonly fill?: boolean
  readonly testId?: string
}

/** Base UI scroll area with the app's thin scrollbar, used instead of native scrollbars. */
export const ScrollArea = ({ children, className, fill = false, testId }: ScrollAreaProps) => (
  <BaseScrollArea.Root
    className={cx('relative min-h-0 overflow-hidden', fill && 'h-full', className)}
    data-testid={testId}
  >
    <BaseScrollArea.Viewport className="h-full overscroll-contain">
      <BaseScrollArea.Content className={cx(fill && 'flex min-h-full flex-col')}>
        {children}
      </BaseScrollArea.Content>
    </BaseScrollArea.Viewport>
    <BaseScrollArea.Scrollbar className="flex w-1.5 justify-center rounded-full p-px opacity-0 transition data-[hovering]:opacity-100 data-[scrolling]:opacity-100">
      <BaseScrollArea.Thumb className="w-full rounded-full bg-mint-200" />
    </BaseScrollArea.Scrollbar>
  </BaseScrollArea.Root>
)

export const Separator = ({
  orientation = 'horizontal',
}: {
  readonly orientation?: 'horizontal' | 'vertical'
}) => (
  <BaseSeparator
    orientation={orientation}
    className={orientation === 'horizontal' ? 'h-px w-full bg-border' : 'h-5 w-px bg-border-strong'}
  />
)

export type TabItem<V extends string> = {
  readonly value: V
  readonly label: string
  readonly icon: LucideIcon
  readonly badge?: number
  readonly content: ReactNode
}

export const Tabs = <V extends string>({
  value,
  onValueChange,
  tabs,
}: {
  readonly value: V
  readonly onValueChange: (value: V) => void
  readonly tabs: readonly TabItem<V>[]
}) => (
  <BaseTabs.Root
    value={value}
    onValueChange={(next: V) => {
      onValueChange(next)
    }}
    className="flex min-h-0 flex-1 flex-col"
  >
    <BaseTabs.List className="relative flex gap-1 border-b border-border px-2">
      {tabs.map((tab) => (
        <BaseTabs.Tab
          key={tab.value}
          value={tab.value}
          data-testid={`tab-${tab.value}`}
          className="flex h-10 cursor-pointer items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground outline-none data-[active]:text-foreground"
        >
          <tab.icon size={14} strokeWidth={1.75} />
          {tab.label}
          {tab.badge !== undefined && tab.badge > 0 && (
            <span className="rounded-full bg-accent px-1.5 text-[10px] leading-4 text-accent-foreground">
              {tab.badge}
            </span>
          )}
        </BaseTabs.Tab>
      ))}
      <BaseTabs.Indicator className="absolute bottom-0 left-(--active-tab-left) h-0.5 w-(--active-tab-width) bg-mint-700 transition-all" />
    </BaseTabs.List>
    {tabs.map((tab) => (
      <BaseTabs.Panel
        key={tab.value}
        value={tab.value}
        className="flex min-h-0 flex-1 flex-col outline-none"
      >
        {tab.content}
      </BaseTabs.Panel>
    ))}
  </BaseTabs.Root>
)

export type SegmentedOption<V extends string> = {
  readonly value: V
  readonly label: string
  readonly icon?: LucideIcon
}

export const Segmented = <V extends string>({
  value,
  onValueChange,
  options,
  testId,
}: {
  readonly value: V
  readonly onValueChange: (value: V) => void
  readonly options: readonly SegmentedOption<V>[]
  readonly testId?: string
}) => (
  <BaseToggleGroup
    value={[value]}
    onValueChange={(next: V[]) => {
      const picked = next[0]
      if (picked !== undefined) onValueChange(picked)
    }}
    data-testid={testId}
    className="flex rounded-lg bg-surface p-0.5"
  >
    {options.map((option) => (
      <BaseToggle
        key={option.value}
        value={option.value}
        data-testid={`${testId ?? 'segmented'}-${option.value}`}
        className="flex h-7 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition data-[pressed]:bg-panel data-[pressed]:text-foreground data-[pressed]:shadow-sm"
      >
        {option.icon !== undefined && <option.icon size={14} strokeWidth={1.75} />}
        {option.label}
      </BaseToggle>
    ))}
  </BaseToggleGroup>
)
