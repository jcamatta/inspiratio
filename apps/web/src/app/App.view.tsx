import { Board } from '../features/board/Board.controller.tsx'
import { Box } from '../shared/ui/index.ts'

export const AppView = () => (
  <Box className="h-full">
    <Board />
  </Box>
)
