import type { ComponentProps, ReactNode } from 'react'
import { cx } from '../lib/cx.ts'

/**
 * Layout primitives. Feature code never writes raw HTML elements (enforced by ESLint);
 * it composes these and the Base UI based controls instead.
 */
export type BoxProps = ComponentProps<'div'> & { readonly testId?: string }

export const Box = ({ testId, ...props }: BoxProps) => <div data-testid={testId} {...props} />

type Gap = 0 | 1 | 2 | 3 | 4 | 6 | 8

const GAP: Readonly<Record<Gap, string>> = {
  0: 'gap-0',
  1: 'gap-1',
  2: 'gap-2',
  3: 'gap-3',
  4: 'gap-4',
  6: 'gap-6',
  8: 'gap-8',
}

const ALIGN = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
} as const
const JUSTIFY = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
} as const

export type StackProps = BoxProps & {
  readonly direction?: 'row' | 'column'
  readonly gap?: Gap
  readonly align?: keyof typeof ALIGN
  readonly justify?: keyof typeof JUSTIFY
  readonly wrap?: boolean
}

export const Stack = ({
  direction = 'column',
  gap = 2,
  align = 'stretch',
  justify = 'start',
  wrap = false,
  className,
  ...props
}: StackProps) => (
  <Box
    className={cx(
      'flex',
      direction === 'row' ? 'flex-row' : 'flex-col',
      GAP[gap],
      ALIGN[align],
      JUSTIFY[justify],
      wrap && 'flex-wrap',
      className,
    )}
    {...props}
  />
)

const TEXT_VARIANT = {
  title: 'text-sm font-semibold tracking-tight',
  heading: 'text-xs font-semibold uppercase tracking-wider text-muted-foreground',
  body: 'text-sm',
  caption: 'text-xs text-muted-foreground',
  label: 'text-xs font-medium',
  mono: 'font-mono text-xs',
} as const

export type TextProps = Omit<ComponentProps<'span'>, 'children'> & {
  readonly variant?: keyof typeof TEXT_VARIANT
  readonly truncate?: boolean
  readonly children?: ReactNode
  readonly testId?: string
}

export const Text = ({
  variant = 'body',
  truncate = false,
  className,
  testId,
  ...props
}: TextProps) => (
  <span
    data-testid={testId}
    className={cx(TEXT_VARIANT[variant], truncate && 'truncate', className)}
    {...props}
  />
)

export const Panel = ({ className, ...props }: BoxProps) => (
  <Box
    className={cx(
      'rounded-(--radius-panel) border border-border bg-panel shadow-(--shadow-panel)',
      className,
    )}
    {...props}
  />
)

export const Kbd = ({ children }: { readonly children: ReactNode }) => (
  <kbd className="rounded border border-border-strong bg-background px-1 font-mono text-[10px] text-muted-foreground">
    {children}
  </kbd>
)

export const ExternalLink = ({
  href,
  children,
  testId,
}: {
  readonly href: string
  readonly children: ReactNode
  readonly testId?: string
}) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer noopener"
    data-testid={testId}
    className="truncate text-xs text-link underline-offset-2 hover:underline"
  >
    {children}
  </a>
)
