export const formatTime = (seconds: number): string => {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  const minutes = Math.floor(safe / 60)
  const rest = Math.floor(safe % 60)
  return `${minutes}:${rest.toString().padStart(2, '0')}`
}
