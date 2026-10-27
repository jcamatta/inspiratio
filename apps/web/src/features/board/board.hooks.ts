import type { BoardSnapshot } from '@inspiratio/shared'
import { useQuery } from '@tanstack/react-query'
import { useCommand } from '../../shared/api/use-command.ts'
import { GENERATIONS_QUERY_KEY } from '../generation/api/generation.api.ts'
import { BOARD_QUERY_KEY, boardApi } from './api/board.api.ts'

const EMPTY_BOARD: BoardSnapshot = { items: [], tags: [], sections: [] }

export const useBoardQuery = () => {
  const query = useQuery({ queryKey: BOARD_QUERY_KEY, queryFn: boardApi.fetchBoard })
  return { board: query.data ?? EMPTY_BOARD, isLoading: query.isLoading }
}

const BOARD = [BOARD_QUERY_KEY]

/** Every board command, each one traced and followed by a board refetch. */
export const useBoardCommands = () => ({
  uploadFiles: useCommand({
    name: 'item.upload',
    call: boardApi.uploadFiles,
    invalidate: BOARD,
    errorTitle: 'Could not import files',
  }),
  importUrl: useCommand({
    name: 'item.import_url',
    call: boardApi.importUrl,
    invalidate: BOARD,
    errorTitle: 'Could not import that link',
  }),
  applyLayout: useCommand({
    name: 'item.layout',
    call: boardApi.applyLayout,
    invalidate: BOARD,
    errorTitle: 'Could not save the layout',
  }),
  updateItem: useCommand({
    name: 'item.update',
    call: boardApi.updateItem,
    invalidate: BOARD,
    errorTitle: 'Could not update the item',
  }),
  setItemTags: useCommand({
    name: 'item.tags',
    call: boardApi.setItemTags,
    invalidate: BOARD,
    errorTitle: 'Could not update tags',
  }),
  reportDimensions: useCommand({
    name: 'item.dimensions',
    call: boardApi.reportDimensions,
    invalidate: BOARD,
    errorTitle: 'Could not save the video size',
  }),
  deleteItem: useCommand({
    name: 'item.delete',
    call: boardApi.deleteItem,
    invalidate: [BOARD_QUERY_KEY, GENERATIONS_QUERY_KEY],
    errorTitle: 'Could not delete the item',
  }),
  restoreItem: useCommand({
    name: 'item.restore',
    call: boardApi.restoreItem,
    invalidate: BOARD,
    errorTitle: 'Could not restore the item',
  }),
  createSection: useCommand({
    name: 'section.create',
    call: boardApi.createSection,
    invalidate: BOARD,
    errorTitle: 'Could not create the section',
  }),
  updateSection: useCommand({
    name: 'section.update',
    call: boardApi.updateSection,
    invalidate: BOARD,
    errorTitle: 'Could not update the section',
  }),
  deleteSection: useCommand({
    name: 'section.delete',
    call: boardApi.deleteSection,
    invalidate: BOARD,
    errorTitle: 'Could not delete the section',
  }),
  createTag: useCommand({
    name: 'tag.create',
    call: boardApi.createTag,
    invalidate: BOARD,
    errorTitle: 'Could not create the tag',
  }),
  deleteTag: useCommand({
    name: 'tag.delete',
    call: boardApi.deleteTag,
    invalidate: BOARD,
    errorTitle: 'Could not delete the tag',
  }),
})

export type BoardCommands = ReturnType<typeof useBoardCommands>
