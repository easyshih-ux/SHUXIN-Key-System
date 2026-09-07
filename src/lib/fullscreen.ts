export const canUseFullscreen = (targetDocument: Document) => targetDocument.fullscreenEnabled
  && typeof targetDocument.documentElement.requestFullscreen === 'function'
  && typeof targetDocument.exitFullscreen === 'function'

export async function toggleFullscreen(targetDocument: Document) {
  if (!canUseFullscreen(targetDocument)) return false
  if (targetDocument.fullscreenElement) await targetDocument.exitFullscreen()
  else await targetDocument.documentElement.requestFullscreen()
  return true
}
