import { Board } from '../features/board/Board.controller.tsx'
import { Toolbar } from '../features/toolbar/Toolbar.controller.tsx'
import { SidePanel } from '../features/workspace/SidePanel.controller.tsx'
import { Box, Stack } from '../shared/ui/index.ts'

/** Application layout: toolbar on top, canvas + side panel below. */
export const AppView = () => (
  <Stack gap={0} className="h-full">
    <Toolbar />
    <Box className="flex min-h-0 flex-1">
      <Board />
      <SidePanel />
    </Box>
  </Stack>
)
