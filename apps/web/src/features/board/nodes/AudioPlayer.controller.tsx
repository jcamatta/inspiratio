import type { Item } from '@inspiratio/shared'
import { mediaUrlOf } from '@inspiratio/shared'
import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { flatWaveform, waveformPeaks } from '../domain/waveform.ts'
import { AudioPlayerView } from './AudioPlayer.view.tsx'

export type AudioPlayerControllerProps = {
  readonly item: Item
}

/** Decodes the file once to draw its waveform; browsers without Web Audio keep the flat one. */
const useWaveform = (src: string): number[] => {
  const [peaks, setPeaks] = useState(flatWaveform)
  useEffect(() => {
    if (typeof AudioContext === 'undefined') return
    const aborted = { current: false }
    const context = new AudioContext()
    void fetch(src)
      .then((response) => response.arrayBuffer())
      .then((buffer) => context.decodeAudioData(buffer))
      .then((audio) => {
        if (!aborted.current) setPeaks(waveformPeaks({ samples: audio.getChannelData(0) }))
      })
      .catch(() => undefined)
      .finally(() => void context.close())
    return () => {
      aborted.current = true
    }
  }, [src])
  return peaks
}

export const AudioPlayer = ({ item }: AudioPlayerControllerProps) => {
  const src = mediaUrlOf(item.media)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const peaks = useWaveform(src)

  const onLoadedMetadata = useCallback((event: SyntheticEvent<HTMLAudioElement>) => {
    const element = event.currentTarget
    setDuration(Number.isFinite(element.duration) ? element.duration : 0)
  }, [])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (audio === null) return
    if (audio.paused) void audio.play()
    else audio.pause()
  }, [])

  const restart = useCallback(() => {
    const audio = audioRef.current
    if (audio === null) return
    audio.currentTime = 0
    void audio.play()
  }, [])

  const seek = useCallback((time: number) => {
    const audio = audioRef.current
    if (audio === null) return
    audio.currentTime = time
    setCurrentTime(time)
  }, [])

  return (
    <AudioPlayerView
      src={src}
      title={item.title}
      onAudioElement={(element) => {
        audioRef.current = element
      }}
      peaks={peaks}
      playing={playing}
      currentTime={currentTime}
      duration={duration}
      muted={muted}
      onToggleMute={() => {
        setMuted((current) => !current)
      }}
      onLoadedMetadata={onLoadedMetadata}
      onTimeUpdate={(event) => {
        setCurrentTime(event.currentTarget.currentTime)
      }}
      onPlay={() => {
        setPlaying(true)
      }}
      onPause={() => {
        setPlaying(false)
      }}
      onEnded={() => {
        setPlaying(false)
      }}
      onTogglePlay={togglePlay}
      onRestart={restart}
      onSeek={seek}
    />
  )
}
