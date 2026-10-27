export type AppErrorCode =
  'not_found' | 'validation' | 'conflict' | 'unsupported_media' | 'upstream' | 'invalid_state'

export type AppError = {
  readonly code: AppErrorCode
  readonly message: string
}

export type Ok<T> = { readonly ok: true; readonly value: T }
export type Err = { readonly ok: false; readonly error: AppError }
export type Result<T> = Ok<T> | Err

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value })

export const err = (error: AppError): Err => ({ ok: false, error })

export const notFound = (params: { readonly entity: string; readonly id: string }): Err =>
  err({ code: 'not_found', message: `${params.entity} ${params.id} not found` })
