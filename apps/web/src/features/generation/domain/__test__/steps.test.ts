import { describe, expect, it } from 'vitest'
import { makeGeneration } from '../../../../__test__/fake-api.ts'
import { currentStep, formatDuration, runDuration, stepRows } from '../steps.ts'

const at = (seconds: number): string =>
  new Date(Date.UTC(2026, 9, 27, 10, 0, seconds)).toISOString()

describe('formatDuration', () => {
  it('formats seconds, minutes and hours compactly', () => {
    expect(formatDuration(-1)).toBe('0s')
    expect(formatDuration(45_000)).toBe('45s')
    expect(formatDuration(72_000)).toBe('1m 12s')
    expect(formatDuration(3_780_000)).toBe('1h 3m')
  })
})

describe('steps', () => {
  const steps = [
    { label: 'Starting Claude', startedAt: at(0), endedAt: at(8) },
    { label: 'Rendering on Higgsfield', startedAt: at(8), endedAt: null },
  ]

  it('finds the running step', () => {
    expect(currentStep(makeGeneration({ id: 'gen_1', steps }))?.label).toBe(
      'Rendering on Higgsfield',
    )
    expect(currentStep(makeGeneration({ id: 'gen_1' }))).toBeNull()
    expect(currentStep(makeGeneration({ id: 'gen_1', steps: steps.slice(0, 1) }))).toBeNull()
  })

  it('times each step and the whole run', () => {
    expect(stepRows({ steps, now: Date.parse(at(20)) })).toEqual([
      { label: 'Starting Claude', duration: '8s' },
      { label: 'Rendering on Higgsfield', duration: '12s' },
    ])
    expect(runDuration(makeGeneration({ id: 'gen_1', queuedAt: at(0), finishedAt: at(72) }))).toBe(
      '1m 12s',
    )
    expect(runDuration(makeGeneration({ id: 'gen_1', queuedAt: at(0) }))).toBeNull()
    expect(runDuration(makeGeneration({ id: 'gen_1', finishedAt: at(1) }))).toBeNull()
  })
})
