import type { Vec2 } from '@inspiratio/shared'

export type ViewTransform = { readonly scale: number; readonly x: number; readonly y: number }

export const IDENTITY: ViewTransform = { scale: 1, x: 0, y: 0 }
export const MIN_SCALE = 0.2
export const MAX_SCALE = 20

const clamp = (params: { readonly value: number; readonly min: number; readonly max: number }) =>
  Math.min(params.max, Math.max(params.min, params.value))

/** Zooms keeping `point` (in container coordinates) fixed under the cursor. */
export const zoomAt = (params: {
  readonly view: ViewTransform
  readonly factor: number
  readonly point: Vec2
}): ViewTransform => {
  const scale = clamp({ value: params.view.scale * params.factor, min: MIN_SCALE, max: MAX_SCALE })
  const ratio = scale / params.view.scale
  return {
    scale,
    x: params.point.x - (params.point.x - params.view.x) * ratio,
    y: params.point.y - (params.point.y - params.view.y) * ratio,
  }
}

export const panBy = (params: {
  readonly view: ViewTransform
  readonly delta: Vec2
}): ViewTransform => ({
  ...params.view,
  x: params.view.x + params.delta.x,
  y: params.view.y + params.delta.y,
})

/** Mouse wheel delta → zoom factor (one notch ≈ 15%). */
export const wheelFactor = (deltaY: number): number => Math.exp(-deltaY * 0.0015)

export const toCss = (view: ViewTransform): string =>
  `translate(${String(view.x)}px, ${String(view.y)}px) scale(${String(view.scale)})`
