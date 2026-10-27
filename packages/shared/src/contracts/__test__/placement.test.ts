import { describe, expect, it } from 'vitest'
import { gridSlot } from '../placement.ts'

describe('gridSlot', () => {
  it('lays batch imports out in non-overlapping rows of four', () => {
    const origin = { x: 10, y: 20 }
    expect(gridSlot({ origin, index: 0 })).toEqual({ x: 10, y: 20 })
    expect(gridSlot({ origin, index: 1 })).toEqual({ x: 378, y: 20 })
    expect(gridSlot({ origin, index: 4 })).toEqual({ x: 10, y: 388 })
  })
})
