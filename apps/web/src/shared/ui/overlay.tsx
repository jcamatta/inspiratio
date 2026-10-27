import { ContextMenu as BaseContextMenu } from '@base-ui/react/context-menu'
import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { X, type LucideIcon } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { cx } from '../lib/cx.ts'

const POPUP =
  'min-w-52 rounded-xl border border-border bg-panel p-1 text-sm shadow-(--shadow-panel) outline-none origin-(--transform-origin) transition data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0'

export const ContextMenuRoot = BaseContextMenu.Root

export const ContextMenuTrigger = ({
  className,
  ...props
}: ComponentProps<typeof BaseContextMenu.Trigger> & { readonly className?: string }) => (
  <BaseContextMenu.Trigger className={className} {...props} />
)

export const ContextMenuContent = ({
  children,
  testId,
}: {
  readonly children: ReactNode
  readonly testId?: string
}) => (
  <BaseContextMenu.Portal>
    <BaseContextMenu.Positioner className="z-50">
      <BaseContextMenu.Popup data-testid={testId} className={POPUP}>
        {children}
      </BaseContextMenu.Popup>
    </BaseContextMenu.Positioner>
  </BaseContextMenu.Portal>
)

export type MenuItemProps = {
  readonly label: string
  readonly icon?: LucideIcon
  readonly onSelect: () => void
  readonly tone?: 'default' | 'danger'
  readonly hint?: string
  readonly disabled?: boolean
  readonly testId?: string
}

export const ContextMenuItem = ({
  label,
  icon: Icon,
  onSelect,
  tone = 'default',
  hint,
  disabled = false,
  testId,
}: MenuItemProps) => (
  <BaseContextMenu.Item
    data-testid={testId}
    disabled={disabled}
    onClick={onSelect}
    className={cx(
      'flex cursor-default items-center gap-2 rounded-lg px-2 py-1.5 outline-none select-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface',
      tone === 'danger' && 'text-danger data-[highlighted]:bg-danger-surface',
    )}
  >
    {Icon !== undefined && <Icon size={15} strokeWidth={1.75} aria-hidden />}
    <span className="flex-1">{label}</span>
    {hint !== undefined && <span className="text-xs text-muted-foreground">{hint}</span>}
  </BaseContextMenu.Item>
)

export const ContextMenuSeparator = () => (
  <BaseContextMenu.Separator className="my-1 h-px bg-border" />
)

export const ContextMenuLabel = ({ children }: { readonly children: ReactNode }) => (
  <div className="px-2 pt-1.5 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
    {children}
  </div>
)

export type DialogProps = {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly title: ReactNode
  readonly description?: ReactNode
  readonly children: ReactNode
  readonly size?: 'md' | 'full'
  readonly testId?: string
}

export const Dialog = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = 'md',
  testId,
}: DialogProps) => (
  <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-mint-950/40 backdrop-blur-[2px] transition data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
      <BaseDialog.Popup
        data-testid={testId}
        className={cx(
          'fixed top-1/2 left-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-(--radius-panel) bg-panel p-5 shadow-(--shadow-panel) transition outline-none data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
          size === 'md'
            ? 'w-[min(440px,calc(100vw-32px))]'
            : 'h-[calc(100vh-48px)] w-[calc(100vw-48px)]',
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <BaseDialog.Title className="truncate text-sm font-semibold">{title}</BaseDialog.Title>
          <BaseDialog.Close
            aria-label="Close"
            data-testid="dialog-close"
            className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-foreground transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-input"
          >
            <X size={16} strokeWidth={1.75} aria-hidden />
          </BaseDialog.Close>
        </div>
        {description !== undefined && (
          <BaseDialog.Description className="text-xs text-muted-foreground">
            {description}
          </BaseDialog.Description>
        )}
        {children}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  </BaseDialog.Root>
)
