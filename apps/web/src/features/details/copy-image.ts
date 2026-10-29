import { mediaUrlOf, serializeError, type Item } from '@inspiratio/shared'
import { copyImageToClipboard } from '../../shared/lib/clipboard.ts'
import { logger } from '../../shared/observability/logger.ts'
import { notify } from '../../shared/ui/index.ts'

/** Shared by the details dialog and the board's context menu. */
export const copyItemImage = (item: Item): void => {
  copyImageToClipboard(mediaUrlOf(item.media)).then(
    () => {
      notify({ title: 'Image copied', tone: 'success' })
    },
    (error: unknown) => {
      logger.warn({
        msg: 'clipboard.copy_image_failed',
        itemId: item.id,
        error: serializeError(error),
      })
      notify({ title: 'Could not copy the image', tone: 'error' })
    },
  )
}
