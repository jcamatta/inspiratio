import { useReactFlow, useViewport } from '@xyflow/react'
import { useState } from 'react'
import { notify } from '../../shared/ui/index.ts'
import { useBoardCommands, useBoardQuery } from '../board/board.hooks.ts'
import { useWorkspace } from '../workspace/workspace.context.ts'
import { ToolbarView } from './Toolbar.view.tsx'

export const Toolbar = () => {
  const flow = useReactFlow()
  const { zoom } = useViewport()
  const { board } = useBoardQuery()
  const { state, dispatch } = useWorkspace()
  const commands = useBoardCommands()
  const [urlOpen, setUrlOpen] = useState(false)

  const center = () =>
    flow.screenToFlowPosition({ x: window.innerWidth / 2 - 180, y: window.innerHeight / 2 })

  return (
    <ToolbarView
      zoom={zoom}
      tags={board.tags}
      filter={state.filter}
      panelOpen={state.panelOpen}
      itemCount={board.items.length}
      onFilterChange={(filter) => {
        dispatch({ type: 'filterChanged', filter })
      }}
      onFiles={(files) => {
        void commands.uploadFiles({ files, position: center() }).then((created) => {
          if (created !== undefined)
            notify({ title: `Added ${created.ids.length} reference(s)`, tone: 'success' })
        })
      }}
      urlOpen={urlOpen}
      onUrlOpenChange={setUrlOpen}
      onImportUrl={(url) => {
        setUrlOpen(false)
        void commands.importUrl({ url, position: center() })
      }}
      onAddSection={() => {
        void commands.createSection({ input: { position: center() } })
      }}
      onZoomIn={() => {
        void flow.zoomIn({ duration: 200 })
      }}
      onZoomOut={() => {
        void flow.zoomOut({ duration: 200 })
      }}
      onFitView={() => {
        void flow.fitView({ duration: 400, padding: 0.1 })
      }}
      onTogglePanel={() => {
        dispatch({ type: 'panelToggled' })
      }}
    />
  )
}
