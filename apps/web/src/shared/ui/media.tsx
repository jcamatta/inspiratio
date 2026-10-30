import { Button as BaseButton } from '@base-ui/react/button'
import type { LucideIcon } from 'lucide-react'
import type { ChangeEvent, ComponentProps, Ref } from 'react'
import { cx } from '../lib/cx.ts'

export type MediaImageProps = {
  readonly src: string
  readonly alt: string
  readonly fit?: 'cover' | 'contain'
  readonly className?: string
  readonly testId?: string
}

export const MediaImage = ({ src, alt, fit = 'cover', className, testId }: MediaImageProps) => (
  <img
    src={src}
    alt={alt}
    draggable={false}
    loading="lazy"
    decoding="async"
    data-testid={testId}
    className={cx(
      'pointer-events-none size-full select-none',
      fit === 'cover' ? 'object-cover' : 'object-contain',
      className,
    )}
  />
)

export type MediaVideoProps = {
  readonly src: string
  readonly ref?: Ref<HTMLVideoElement>
  readonly fit?: 'cover' | 'contain'
  readonly className?: string
  readonly testId?: string
  readonly controls?: boolean
  readonly autoPlay?: boolean
  /** Muted by default so background previews stay silent; players that own a sound toggle unmute. */
  readonly muted?: boolean
  readonly onLoadedMetadata?: ComponentProps<'video'>['onLoadedMetadata']
  readonly onTimeUpdate?: ComponentProps<'video'>['onTimeUpdate']
  readonly onPlay?: () => void
  readonly onPause?: () => void
  readonly onEnded?: () => void
}

export const MediaVideo = ({
  src,
  ref,
  fit = 'cover',
  className,
  testId,
  controls = false,
  autoPlay = false,
  muted = true,
  onLoadedMetadata,
  onTimeUpdate,
  onPlay,
  onPause,
  onEnded,
}: MediaVideoProps) => (
  <video
    ref={ref}
    src={src}
    data-testid={testId}
    muted={muted}
    loop
    playsInline
    preload="metadata"
    controls={controls}
    autoPlay={autoPlay}
    onLoadedMetadata={onLoadedMetadata}
    onTimeUpdate={onTimeUpdate}
    onPlay={onPlay}
    onPause={onPause}
    onEnded={onEnded}
    className={cx(
      'size-full select-none',
      fit === 'cover' ? 'object-cover' : 'object-contain',
      className,
    )}
  />
)

export type MediaAudioProps = {
  readonly src: string
  readonly ref?: Ref<HTMLAudioElement>
  readonly testId?: string
  /** Native controls; off for players that draw their own (the element is then invisible). */
  readonly controls?: boolean
  readonly autoPlay?: boolean
  readonly muted?: boolean
  readonly className?: string
  readonly onLoadedMetadata?: ComponentProps<'audio'>['onLoadedMetadata']
  readonly onTimeUpdate?: ComponentProps<'audio'>['onTimeUpdate']
  readonly onPlay?: () => void
  readonly onPause?: () => void
  readonly onEnded?: () => void
}

export const MediaAudio = ({
  src,
  ref,
  testId,
  controls = false,
  autoPlay = false,
  muted = false,
  className,
  onLoadedMetadata,
  onTimeUpdate,
  onPlay,
  onPause,
  onEnded,
}: MediaAudioProps) => (
  <audio
    ref={ref}
    src={src}
    data-testid={testId}
    muted={muted}
    preload="metadata"
    controls={controls}
    autoPlay={autoPlay}
    onLoadedMetadata={onLoadedMetadata}
    onTimeUpdate={onTimeUpdate}
    onPlay={onPlay}
    onPause={onPause}
    onEnded={onEnded}
    className={cx(controls ? 'w-full' : 'hidden', className)}
  />
)

export type WaveformProps = {
  /** Bar heights from 0 to 1. */
  readonly peaks: readonly number[]
  /** Share of the bars drawn as played, from 0 to 1. */
  readonly progress: number
  readonly className?: string
  readonly testId?: string
}

export const Waveform = ({ peaks, progress, className, testId }: WaveformProps) => {
  const played = Math.round(progress * peaks.length)
  return (
    <div
      data-testid={testId}
      aria-hidden
      className={cx('flex size-full items-center gap-px', className)}
    >
      {[...peaks.entries()].map(([index, peak]) => (
        <span
          key={index}
          className={cx(
            'min-w-px flex-1 rounded-full transition-colors',
            index < played ? 'bg-mint-700' : 'bg-mint-200',
          )}
          style={{ height: `${String(Math.round(peak * 100))}%` }}
        />
      ))}
    </div>
  )
}

export type FilePickerProps = {
  readonly label: string
  readonly icon: LucideIcon
  readonly accept: string
  readonly onFiles: (files: File[]) => void
  readonly testId?: string
}

/** A Base UI button that opens the native file dialog (the input element stays encapsulated here). */
export const FilePicker = ({ label, icon: Icon, accept, onFiles, testId }: FilePickerProps) => {
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    onFiles(Array.from(event.target.files ?? []))
    event.target.value = ''
  }
  return (
    <BaseButton
      render={<label />}
      nativeButton={false}
      aria-label={label}
      className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-foreground transition hover:bg-surface"
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden />
      <input
        data-testid={testId}
        type="file"
        multiple
        accept={accept}
        className="sr-only"
        onChange={onChange}
      />
    </BaseButton>
  )
}
