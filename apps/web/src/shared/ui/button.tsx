import { Button as BaseButton } from '@base-ui/react/button'
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import type { LucideIcon } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { cx } from '../lib/cx.ts'

const VARIANT = {
  primary:
    'bg-primary text-primary-foreground hover:brightness-95 active:brightness-90 data-[disabled]:opacity-50',
  secondary:
    'bg-panel text-foreground border border-border-strong hover:bg-surface data-[disabled]:opacity-50',
  ghost: 'text-foreground hover:bg-surface data-[disabled]:opacity-40',
  danger: 'bg-danger-surface text-danger hover:brightness-95 data-[disabled]:opacity-50',
  accent: 'bg-accent text-accent-foreground hover:brightness-95 data-[disabled]:opacity-50',
} as const

const SIZE = {
  sm: 'h-7 px-2 text-xs gap-1.5',
  md: 'h-8 px-3 text-sm gap-2',
} as const

export type ButtonVariant = keyof typeof VARIANT

export type ButtonProps = Omit<ComponentProps<typeof BaseButton>, 'className'> & {
  readonly variant?: ButtonVariant
  readonly size?: keyof typeof SIZE
  readonly icon?: LucideIcon
  readonly className?: string
  readonly testId?: string
}

export const Button = ({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  className,
  testId,
  children,
  ...props
}: ButtonProps) => (
  <BaseButton
    data-testid={testId}
    className={cx(
      'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg font-medium whitespace-nowrap transition select-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-input data-[disabled]:cursor-not-allowed',
      VARIANT[variant],
      SIZE[size],
      className,
    )}
    {...props}
  >
    {Icon !== undefined && <Icon size={size === 'sm' ? 14 : 16} strokeWidth={1.75} aria-hidden />}
    {children}
  </BaseButton>
)

export type TooltipProps = {
  readonly label: ReactNode
  readonly children: ComponentProps<typeof BaseTooltip.Trigger>['render']
  readonly side?: 'top' | 'bottom' | 'left' | 'right'
}

export const Tooltip = ({ label, children, side = 'top' }: TooltipProps) => (
  <BaseTooltip.Root>
    <BaseTooltip.Trigger render={children} />
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner side={side} sideOffset={6} className="z-50">
        <BaseTooltip.Popup className="rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-(--shadow-panel)">
          {label}
        </BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  </BaseTooltip.Root>
)

export type IconButtonProps = Omit<ButtonProps, 'icon' | 'children'> & {
  readonly icon: LucideIcon
  readonly label: string
  readonly tooltipSide?: TooltipProps['side']
  readonly active?: boolean
}

export const IconButton = ({
  icon: Icon,
  label,
  variant = 'ghost',
  size = 'md',
  tooltipSide,
  active = false,
  className,
  testId,
  ...props
}: IconButtonProps) => (
  <Tooltip label={label} side={tooltipSide}>
    <BaseButton
      aria-label={label}
      aria-pressed={active}
      data-testid={testId}
      className={cx(
        'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg transition focus-visible:outline-2 focus-visible:outline-input data-[disabled]:cursor-not-allowed',
        VARIANT[variant],
        size === 'sm' ? 'size-7' : 'size-8',
        active && 'bg-surface text-mint-700',
        className,
      )}
      {...props}
    >
      <Icon size={size === 'sm' ? 14 : 16} strokeWidth={1.75} aria-hidden />
    </BaseButton>
  </Tooltip>
)

export type LinkButtonProps = Omit<ComponentProps<typeof BaseButton>, 'className' | 'children'> & {
  readonly children: string
  /** Cuts overflow at the start instead of the end, so a path keeps its file name visible. */
  readonly truncateStart?: boolean
  readonly testId?: string
}

/** A button that reads as an inline link, for actions on a value shown in a list. */
export const LinkButton = ({
  children,
  truncateStart = false,
  testId,
  ...props
}: LinkButtonProps) => (
  <BaseButton
    data-testid={testId}
    className={cx(
      'min-w-0 cursor-pointer truncate text-xs text-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-input',
      truncateStart && '[direction:rtl]',
    )}
    {...props}
  >
    {truncateStart ? <bdi>{children}</bdi> : children}
  </BaseButton>
)
