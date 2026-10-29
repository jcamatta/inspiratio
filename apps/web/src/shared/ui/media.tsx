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
