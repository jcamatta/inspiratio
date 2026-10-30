export const WAVEFORM_BARS = 64

/** Bars drawn before the audio is decoded (or when the browser cannot decode it). */
export const flatWaveform = (bars: number = WAVEFORM_BARS): number[] =>
  new Array<number>(bars).fill(0.15)

/**
 * Peak amplitude of each of `bars` equal slices of the samples, scaled so the loudest bar is 1.
 * Silence stays flat instead of being blown up to full height.
 */
export const waveformPeaks = (params: {
  readonly samples: Float32Array
  readonly bars?: number
}): number[] => {
  const bars = params.bars ?? WAVEFORM_BARS
  const { samples } = params
  if (samples.length === 0) return flatWaveform(bars)
  const slice = samples.length / bars
  const peaks = [...Array(bars).keys()].map((bar) => {
    const from = Math.floor(bar * slice)
    const to = Math.max(from + 1, Math.floor((bar + 1) * slice))
    let peak = 0
    for (let index = from; index < to && index < samples.length; index += 1)
      peak = Math.max(peak, Math.abs(samples[index] ?? 0))
    return peak
  })
  const loudest = Math.max(...peaks)
  return loudest < 0.001 ? flatWaveform(bars) : peaks.map((peak) => Math.max(0.06, peak / loudest))
}
