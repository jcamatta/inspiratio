import { mediaUrlOf, type Item } from '@inspiratio/shared'
import { Maximize, ZoomIn, ZoomOut } from 'lucide-react'
import type { PointerEvent, WheelEvent } from 'react'
import {
  Box,
  Dialog,
  IconButton,
  MediaImage,
  MediaVideo,
  Panel,
  Text,
} from '../../shared/ui/index.ts'
import { toCss, type ViewTransform } from './domain/zoom.ts'

export type ViewerViewProps = {
  readonly item: Item | null
  readonly view: ViewTransform
  readonly onStageElement: (element: HTMLDivElement | null) => void
  readonly onClose: () => void
  readonly onWheel: (event: WheelEvent) => void
  readonly onPointerDown: (event: PointerEvent) => void
  readonly onPointerMove: (event: PointerEvent) => void
  readonly onPointerUp: () => void
  readonly onZoomIn: () => void
  readonly onZoomOut: () => void
  readonly onReset: () => void
}

export const ViewerView = ({ onStageElement, ...props }: ViewerViewProps) => (
  <Dialog
    open={props.item !== null}
    onOpenChange={(open) => {
      if (!open) props.onClose()
    }}
    title={props.item?.title ?? ''}
    size="full"
    testId="viewer"
  >
    {props.item !== null && (
      <Box className="relative min-h-0 flex-1">
        <Box
          ref={onStageElement}
          testId="viewer-stage"
          className="absolute inset-0 cursor-grab touch-none overflow-hidden rounded-lg bg-mint-950 active:cursor-grabbing"
          onWheel={props.onWheel}
          onPointerDown={props.onPointerDown}
          onPointerMove={props.onPointerMove}
          onPointerUp={props.onPointerUp}
          onDoubleClick={props.onReset}
        >
          <Box
            testId="viewer-content"
            className="absolute inset-0 origin-top-left"
            style={{ transform: toCss(props.view) }}
          >
            {props.item.kind === 'video' ? (
              <MediaVideo
                src={mediaUrlOf(props.item.media)}
                fit="contain"
                controls
                autoPlay
                muted={false}
              />
            ) : (
              <MediaImage src={mediaUrlOf(props.item.media)} alt={props.item.title} fit="contain" />
            )}
          </Box>
        </Box>
        <Panel className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-0.5 p-1">
          <IconButton
            icon={ZoomOut}
            label="Zoom out"
            onClick={props.onZoomOut}
            testId="viewer-zoom-out"
          />
          <Text variant="mono" className="w-12 text-center" testId="viewer-zoom">
            {Math.round(props.view.scale * 100)}%
          </Text>
          <IconButton
            icon={ZoomIn}
            label="Zoom in"
            onClick={props.onZoomIn}
            testId="viewer-zoom-in"
          />
          <IconButton icon={Maximize} label="Fit" onClick={props.onReset} testId="viewer-reset" />
        </Panel>
      </Box>
    )}
  </Dialog>
)
