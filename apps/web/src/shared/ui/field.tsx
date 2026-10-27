import { Field as BaseField } from '@base-ui/react/field'
import { Input as BaseInput } from '@base-ui/react/input'
import type { ComponentProps, ReactNode } from 'react'
import { cx } from '../lib/cx.ts'

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
  readonly rows?: number
  readonly className?: string
  readonly testId?: string
  readonly onDrop?: ComponentProps<'textarea'>['onDrop']
  readonly onDragOver?: ComponentProps<'textarea'>['onDragOver']
  readonly onKeyDown?: ComponentProps<'textarea'>['onKeyDown']
  readonly onBlur?: () => void
  readonly highlighted?: boolean
}

/** Multi-line input: a Base UI Input rendered as a textarea. */
export const TextArea = ({
  value,
  onValueChange,
  label,
  placeholder,
  rows = 4,
  className,
  testId,
  onDrop,
  onDragOver,
  onKeyDown,
  onBlur,
  highlighted = false,
}: TextAreaProps) => (
  <BaseField.Root className={cx('flex flex-col gap-1', className)}>
    {label !== undefined && (
      <BaseField.Label className="text-xs font-medium text-muted-foreground">
        {label}
      </BaseField.Label>
    )}
    <BaseInput
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      onBlur={onBlur}
      render={
        <textarea
          rows={rows}
          data-testid={testId}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onKeyDown={onKeyDown}
        />
      }
      className={cx(
        CONTROL,
        'resize-none py-2 leading-relaxed',
        highlighted && 'border-input ring-2 ring-primary/60',
      )}
    />
  </BaseField.Root>
)
