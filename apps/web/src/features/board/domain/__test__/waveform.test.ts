import { describe, expect, it } from 'vitest'
import { flatWaveform, waveformPeaks } from '../waveform.ts'

describe('waveformPeaks', () => {
  it('takes the peak of each slice, scaled to the loudest', () => {
    const samples = new Float32Array([0.125, -0.5, 0.25, 0.125, 0, -0.125, 0.375, 0.25])
    expect(waveformPeaks({ samples, bars: 4 })).toEqual([1, 0.5, 0.25, 0.75])
  })

  it('keeps quiet bars visible and silence flat', () => {
    const quiet = new Float32Array([1, 0, 0.001, 0])
    expect(waveformPeaks({ samples: quiet, bars: 2 })).toEqual([1, 0.06])
    expect(waveformPeaks({ samples: new Float32Array(10), bars: 3 })).toEqual(flatWaveform(3))
    expect(waveformPeaks({ samples: new Float32Array(), bars: 2 })).toEqual(flatWaveform(2))
  })

  it('spreads short clips over more bars than samples', () => {
    expect(waveformPeaks({ samples: new Float32Array([0.5, 1]), bars: 4 })).toHaveLength(4)
  })
})
