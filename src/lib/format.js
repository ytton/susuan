export function formatDuration(ms) {
  if (!Number.isFinite(ms)) {
    return '0.0秒'
  }

  const seconds = Math.max(0, ms / 1000)

  if (seconds < 60) {
    return `${seconds.toFixed(seconds < 10 ? 2 : 1)}秒`
  }

  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60

  return `${minutes}分${rest.toFixed(1).padStart(4, '0')}秒`
}

export function formatLiveDuration(ms) {
  const seconds = Math.max(0, ms / 1000)

  if (seconds < 60) {
    return `${seconds.toFixed(1)}秒`
  }

  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)

  return `${minutes}:${String(rest).padStart(2, '0')}`
}
