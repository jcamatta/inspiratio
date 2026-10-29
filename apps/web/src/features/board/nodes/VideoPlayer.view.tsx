import { Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import type { SyntheticEvent } from 'react'
import { cx } from '../../../shared/lib/cx.ts'
import { formatTime } from '../domain/time.ts'
import { Box, IconButton, MediaVideo, Slider, Stack, Text } from '../../../shared/ui/index.ts'

export type VideoPlayerViewProps = {
  readonly src: string
  readonly onVideoElement: (element: HTMLVideoElement | null) => void
  readonly playing: boolean
  readonly currentTime: number
  readonly duration: number
  readonly showControls: boolean
  readonly muted: boolean
  readonly onToggleMute: () => void
  readonly onLoadedMetadata: (event: SyntheticEvent<HTMLVideoElement>) => void
  readonly onTimeUpdate: (event: SyntheticEvent<HTMLVideoElement>) => void
  readonly onPlay: () => void
  readonly onPause: () => void
  readonly onTogglePlay: () => void
  readonly onRestart: () => void
  readonly onSeek: (time: number) => void
}

export const VideoPlayerView = ({ onVideoElement, ...props }: VideoPlayerViewProps) => (
  <Box className="group/video relative size-full">
    <MediaVideo
      src={props.src}
      ref={onVideoElement}
      testId="video-element"
      muted={props.muted}
      onLoadedMetadata={props.onLoadedMetadata}
      onTimeUpdate={props.onTimeUpdate}
      onPlay={props.onPlay}
      onPause={props.onPause}
    />
    <Stack
      direction="row"
      align="center"
      gap={1}
      testId="video-controls"
      className={cx(
        'nodrag nowheel absolute inset-x-1.5 bottom-1.5 rounded-lg bg-mint-950/70 px-1 py-0.5 text-white backdrop-blur transition',
        props.showControls ? 'opacity-100' : 'opacity-0 group-hover/video:opacity-100',
      )}
    >
      <IconButton
        icon={props.playing ? Pause : Play}
        label={props.playing ? 'Pause' : 'Play'}
        size="sm"
        className="text-white hover:bg-white/15"
        testId="video-toggle"
        onClick={props.onTogglePlay}
      />
      <IconButton
        icon={RotateCcw}
        label="Restart"
        size="sm"
        className="text-white hover:bg-white/15"
        testId="video-restart"
        onClick={props.onRestart}
      />
      <Box className="min-w-8 flex-1 px-1">
        <Slider
          value={props.currentTime}
          max={props.duration}
          label="Seek"
          onValueChange={props.onSeek}
          testId="video-seek"
        />
      </Box>
      <IconButton
        icon={props.muted ? VolumeX : Volume2}
        label={props.muted ? 'Unmute' : 'Mute'}
        size="sm"
        className="text-white hover:bg-white/15"
        testId="video-mute"
        onClick={props.onToggleMute}
      />
      <Text variant="mono" className="pr-1 text-[10px] text-white/80">
        {formatTime(props.currentTime)}/{formatTime(props.duration)}
      </Text>
    </Stack>
  </Box>
)
