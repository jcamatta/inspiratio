import { Field as BaseField } from '@base-ui/react/field'
import { Input as BaseInput } from '@base-ui/react/input'
import type { ComponentProps, ReactNode } from 'react'
import { cx } from '../lib/cx.ts'
import { ScrollArea } from './controls.tsx'
import { Box } from './layout.tsx'

const CONTROL =
  'w-full rounded-lg border border-border-strong bg-panel px-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 transition outline-none focus:border-input focus:ring-2 focus:ring-primary/40'

export type TextFieldProps = Omit<ComponentProps<typeof BaseInput>, 'className' | 'onChange'> & {
  readonly label?: ReactNode
  readonly className?: string
  readonly testId?: string
  readonly dense?: boolean
}

/** Single-line input built on Base UI Field + Input. Use `onValueChange` for updates. */
export const TextField = ({
  label,
  className,
  testId,
  dense = false,
  ...props
}: TextFieldProps) => (
  <BaseField.Root className={cx('flex flex-col gap-1', className)}>
    {label !== undefined && (
      <BaseField.Label className="text-xs font-medium text-muted-foreground">
        {label}
      </BaseField.Label>
    )}
    <BaseInput
      data-testid={testId}
      className={cx(CONTROL, dense ? 'h-7 text-xs' : 'h-8')}
      {...props}
    />
  </BaseField.Root>
)

export type TextAreaProps = {
  readonly value: string
  readonly onValueChange: (value: string) => void
  readonly label?: ReactNode
  readonly placeholder?: string
  readonly className?: string
  readonly testId?: string
  readonly onKeyDown?: ComponentProps<'textarea'>['onKeyDown']
  readonly onBlur?: () => void
  readonly disabled?: boolean
}

/** Grows with its content; past the max height it scrolls inside a Base UI ScrollArea. */
export const TextArea = ({
  value,
  onValueChange,
  label,
  placeholder,
  className,
  testId,
  onKeyDown,
  onBlur,
  disabled = false,
}: TextAreaProps) => (
  <BaseField.Root className={cx('flex flex-col gap-1', className)} disabled={disabled}>
    {label !== undefined && (
      <BaseField.Label className="text-xs font-medium text-muted-foreground">
        {label}
      </BaseField.Label>
    )}
    <Box className="rounded-lg border border-border-strong bg-panel transition focus-within:border-input focus-within:ring-2 focus-within:ring-primary/40">
      <ScrollArea className="nowheel max-h-48">
        <BaseInput
          value={value}
          onValueChange={onValueChange}
          placeholder={placeholder}
          onBlur={onBlur}
          render={<textarea rows={3} data-testid={testId} onKeyDown={onKeyDown} />}
          className="block [field-sizing:content] min-h-20 w-full resize-none overflow-hidden bg-transparent px-2.5 py-2 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70 data-[disabled]:opacity-60"
        />
      </ScrollArea>
    </Box>
  </BaseField.Root>
)
