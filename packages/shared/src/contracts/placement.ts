import type { Vec2 } from './geometry.ts'

/** Longest edge of a reference when it first lands on the canvas. */
export const INITIAL_EDGE = 320
export const GRID_GAP = 48
export const GRID_COLUMNS = 4

/**
 * Where the n-th file of a batch import lands: a grid of non-overlapping slots starting at the
 * drop point, so dumping a folder of stills never stacks them on top of each other.
 */
export const gridSlot = (params: { readonly origin: Vec2; readonly index: number }): Vec2 => ({
  x: params.origin.x + (params.index % GRID_COLUMNS) * (INITIAL_EDGE + GRID_GAP),
  y: params.origin.y + Math.floor(params.index / GRID_COLUMNS) * (INITIAL_EDGE + GRID_GAP),
})
