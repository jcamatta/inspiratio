import type { Item } from '@inspiratio/shared'
import { mediaUrlOf } from '@inspiratio/shared'
import { useCallback, useRef, useState, type SyntheticEvent } from 'react'
import { VideoPlayerView } from './VideoPlayer.view.tsx'

export type VideoPlayerControllerProps = {
  readonly item: Item
  readonly showControls: boolean
  readonly onDimensions: (input: { readonly width: number; readonly height: number }) => void
}

export const VideoPlayer = ({ item, showControls, onDimensions }: VideoPlayerControllerProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)

  const onLoadedMetadata = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      const element = event.currentTarget
      setDuration(Number.isFinite(element.duration) ? element.duration : 0)
      if (item.media.width === null && element.videoWidth > 0 && element.videoHeight > 0)
        onDimensions({ width: element.videoWidth, height: element.videoHeight })
    },
    [item.media.width, onDimensions],
  )

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (video === null) return
    if (video.paused) void video.play()
    else video.pause()
  }, [])

  const restart = useCallback(() => {
    const video = videoRef.current
    if (video === null) return
    video.currentTime = 0
    void video.play()
  }, [])

  const seek = useCallback((time: number) => {
    const video = videoRef.current
    if (video === null) return
    video.currentTime = time
    setCurrentTime(time)
  }, [])

  return (
    <VideoPlayerView
      src={mediaUrlOf(item.media)}
      onVideoElement={(element) => {
        videoRef.current = element
      }}
      playing={playing}
      currentTime={currentTime}
      duration={duration}
      showControls={showControls}
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
      onTogglePlay={togglePlay}
      onRestart={restart}
      onSeek={seek}
    />
  )
}
