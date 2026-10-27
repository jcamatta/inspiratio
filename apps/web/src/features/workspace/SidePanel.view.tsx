import { ListTodo, SlidersHorizontal, Sparkles } from 'lucide-react'
import { Box, Tabs } from '../../shared/ui/index.ts'
import { Composer } from '../generation/Composer.controller.tsx'
import { Queue } from '../generation/Queue.controller.tsx'
import { Inspector } from '../inspector/Inspector.controller.tsx'
import type { PanelTab } from './domain/workspace.ts'

export type SidePanelViewProps = {
  readonly open: boolean
  readonly tab: PanelTab
  readonly activeGenerations: number
  readonly referenceCount: number
  readonly onTabChange: (tab: PanelTab) => void
}

export const SidePanelView = (props: SidePanelViewProps) =>
  props.open ? (
    <Box
      testId="side-panel"
      className="flex w-[360px] shrink-0 flex-col border-l border-border bg-panel"
    >
      <Tabs<PanelTab>
        value={props.tab}
        onValueChange={props.onTabChange}
        tabs={[
          {
            value: 'inspector',
            label: 'Inspector',
            icon: SlidersHorizontal,
            content: <Inspector />,
          },
          {
            value: 'generate',
            label: 'Generate',
            icon: Sparkles,
            badge: props.referenceCount,
            content: <Composer />,
          },
          {
            value: 'queue',
            label: 'Queue',
            icon: ListTodo,
            badge: props.activeGenerations,
            content: <Queue />,
          },
        ]}
      />
    </Box>
  ) : null
