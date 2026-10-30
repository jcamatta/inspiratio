import { AudioLines, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import type { SyntheticEvent } from 'react'
import { formatTime } from '../domain/time.ts'
import {
  Box,
  IconButton,
  MediaAudio,
  Slider,
  Stack,
  Text,
  Waveform,
} from '../../../shared/ui/index.ts'

export type AudioPlayerViewProps = {
  readonly src: string
  readonly title: string
  readonly onAudioElement: (element: HTMLAudioElement | null) => void
  readonly peaks: readonly number[]
  readonly playing: boolean
  readonly currentTime: number
  readonly duration: number
  readonly muted: boolean
  readonly onToggleMute: () => void
  readonly onLoadedMetadata: (event: SyntheticEvent<HTMLAudioElement>) => void
  readonly onTimeUpdate: (event: SyntheticEvent<HTMLAudioElement>) => void
  readonly onPlay: () => void
  readonly onPause: () => void
  readonly onEnded: () => void
  readonly onTogglePlay: () => void
  readonly onRestart: () => void
  readonly onSeek: (time: number) => void
}

/** Audio has no picture: the node shows its waveform, filled as it plays, over always-on controls. */
export const AudioPlayerView = ({ onAudioElement, ...props }: AudioPlayerViewProps) => (
  <Stack gap={1} className="size-full bg-mint-50 p-2" testId="audio-player">
    <MediaAudio
      src={props.src}
      ref={onAudioElement}
      testId="audio-element"
      muted={props.muted}
      onLoadedMetadata={props.onLoadedMetadata}
      onTimeUpdate={props.onTimeUpdate}
      onPlay={props.onPlay}
      onPause={props.onPause}
      onEnded={props.onEnded}
    />
    <Stack direction="row" align="center" gap={2} className="min-h-0 flex-1">
      <AudioLines size={16} className="shrink-0 text-primary" aria-label={props.title} />
      <Box className="h-full min-h-4 flex-1">
        <Waveform
          peaks={props.peaks}
          progress={props.duration > 0 ? props.currentTime / props.duration : 0}
          testId="audio-waveform"
        />
      </Box>
    </Stack>
    <Stack
      direction="row"
      align="center"
      gap={1}
      testId="audio-controls"
      className="nodrag nowheel shrink-0"
    >
      <IconButton
        icon={props.playing ? Pause : Play}
        label={props.playing ? 'Pause' : 'Play'}
        size="sm"
        testId="audio-toggle"
        onClick={props.onTogglePlay}
      />
      <IconButton
        icon={RotateCcw}
        label="Restart"
        size="sm"
        testId="audio-restart"
        onClick={props.onRestart}
      />
      <Box className="min-w-8 flex-1 px-1">
        <Slider
          value={props.currentTime}
          max={props.duration}
          label="Seek"
          onValueChange={props.onSeek}
          testId="audio-seek"
        />
      </Box>
      <IconButton
        icon={props.muted ? VolumeX : Volume2}
        label={props.muted ? 'Unmute' : 'Mute'}
        size="sm"
        testId="audio-mute"
        onClick={props.onToggleMute}
      />
      <Text variant="mono" className="pr-1 text-[10px]">
        {formatTime(props.currentTime)}/{formatTime(props.duration)}
      </Text>
    </Stack>
  </Stack>
)
