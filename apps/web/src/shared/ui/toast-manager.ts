import { Toast as BaseToast } from '@base-ui/react/toast'

/** App-wide toast manager so actions outside React (mutation callbacks) can notify. */
export const toastManager = BaseToast.createToastManager()

export type NotifyParams = {
  readonly title: string
  readonly description?: string
  readonly tone?: 'info' | 'success' | 'error'
}

export const notify = (params: NotifyParams): void => {
  toastManager.add({
    title: params.title,
    description: params.description,
    type: params.tone ?? 'info',
    timeout: params.tone === 'error' ? 8000 : 4000,
  })
}
