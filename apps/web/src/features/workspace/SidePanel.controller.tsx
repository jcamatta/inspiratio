import { useGenerationsQuery, isActive } from '../generation/generation.hooks.ts'
import { useWorkspace } from './workspace.context.ts'
import { SidePanelView } from './SidePanel.view.tsx'

export const SidePanel = () => {
  const { state, dispatch } = useWorkspace()
  const { requests } = useGenerationsQuery()
  return (
    <SidePanelView
      open={state.panelOpen}
      tab={state.panelTab}
      activeGenerations={requests.filter(isActive).length}
      referenceCount={state.composer.references.length}
      onTabChange={(tab) => {
        dispatch({ type: 'panelTabChanged', tab })
      }}
    />
  )
}
