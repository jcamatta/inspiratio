/** Browsers only accept PNG on the clipboard, so other formats are redrawn through a canvas. */
const toPng = async (blob: Blob): Promise<Blob> => {
  if (blob.type === 'image/png') return blob
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
  bitmap.close()
  const png = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png')
  })
  if (png === null) throw new Error('Could not encode the image as PNG')
  return png
}

const fetchBlob = async (url: string): Promise<Blob> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not load ${url} (${String(response.status)})`)
  return response.blob()
}

/** Puts the image itself on the clipboard; the blob is passed as a promise to keep the user gesture. */
export const copyImageToClipboard = (url: string): Promise<void> =>
  navigator.clipboard.write([new ClipboardItem({ 'image/png': fetchBlob(url).then(toPng) })])
