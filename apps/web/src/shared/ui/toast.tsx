import { Toast as BaseToast } from '@base-ui/react/toast'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from '../lib/cx.ts'
import { toastManager } from './toast-manager.ts'

const ToastList = () => {
  const { toasts } = BaseToast.useToastManager()
  return toasts.map((toast) => (
    <BaseToast.Root
      key={toast.id}
      toast={toast}
      data-testid="toast"
      className={cx(
        'absolute right-0 bottom-0 flex w-80 [transform:translateY(calc(var(--toast-index)*-8px))_scale(calc(1-var(--toast-index)*0.04))] items-start gap-3 rounded-xl border bg-panel p-3 shadow-(--shadow-panel) transition-all data-[ending-style]:opacity-0 data-[starting-style]:translate-y-2 data-[starting-style]:opacity-0',
        toast.type === 'error' ? 'border-coral-500/40' : 'border-border',
      )}
    >
      <span
        className={cx(
          'mt-1 size-2 shrink-0 rounded-full',
          toast.type === 'error'
            ? 'bg-accent'
            : toast.type === 'success'
              ? 'bg-primary'
              : 'bg-mint-700',
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <BaseToast.Title className="text-sm font-medium" />
        <BaseToast.Description className="text-xs break-words text-muted-foreground" />
      </div>
      <BaseToast.Close
        aria-label="Dismiss"
        className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-surface"
      >
        <X size={14} />
      </BaseToast.Close>
    </BaseToast.Root>
  ))
}

export const ToastProvider = ({ children }: { readonly children: ReactNode }) => (
  <BaseToast.Provider toastManager={toastManager} limit={4}>
    {children}
    <BaseToast.Portal>
      <BaseToast.Viewport className="fixed right-4 bottom-4 z-50 w-80">
        <ToastList />
      </BaseToast.Viewport>
    </BaseToast.Portal>
  </BaseToast.Provider>
)
