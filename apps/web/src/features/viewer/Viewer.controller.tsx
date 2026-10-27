import type { Item } from '@inspiratio/shared'
import { useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { IDENTITY, panBy, wheelFactor, zoomAt, type ViewTransform } from './domain/zoom.ts'
import { ViewerView } from './Viewer.view.tsx'

const ZOOM_STEP = 1.4

export const Viewer = ({
  item,
  onClose,
}: {
  readonly item: Item | null
  readonly onClose: () => void
}) => {
  const [view, setView] = useState<ViewTransform>(IDENTITY)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const stage = useRef<HTMLDivElement | null>(null)

  const center = () => {
    const rect = stage.current?.getBoundingClientRect()
    return { x: (rect?.width ?? 0) / 2, y: (rect?.height ?? 0) / 2 }
  }

  const pointIn = (event: { readonly clientX: number; readonly clientY: number }) => {
    const rect = stage.current?.getBoundingClientRect()
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) }
  }

  return (
    <ViewerView
      item={item}
      view={view}
      onStageElement={(element) => {
        stage.current = element
      }}
      onClose={() => {
        setView(IDENTITY)
        onClose()
      }}
      onWheel={(event: WheelEvent) => {
        setView((current) =>
          zoomAt({ view: current, factor: wheelFactor(event.deltaY), point: pointIn(event) }),
        )
      }}
      onPointerDown={(event: PointerEvent) => {
        drag.current = { x: event.clientX, y: event.clientY }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event: PointerEvent) => {
        const start = drag.current
        if (start === null) return
        drag.current = { x: event.clientX, y: event.clientY }
        setView((current) =>
          panBy({
            view: current,
            delta: { x: event.clientX - start.x, y: event.clientY - start.y },
          }),
        )
      }}
      onPointerUp={() => {
        drag.current = null
      }}
      onZoomIn={() => {
        setView((current) => zoomAt({ view: current, factor: ZOOM_STEP, point: center() }))
      }}
      onZoomOut={() => {
        setView((current) => zoomAt({ view: current, factor: 1 / ZOOM_STEP, point: center() }))
      }}
      onReset={() => {
        setView(IDENTITY)
      }}
    />
  )
}
