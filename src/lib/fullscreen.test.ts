import { describe, expect, it, vi } from 'vitest'
import { canUseFullscreen, toggleFullscreen } from './fullscreen'

const createDocument = (fullscreenElement: object | null = null) => {
  const requestFullscreen = vi.fn(async () => undefined)
  const exitFullscreen = vi.fn(async () => undefined)
  const target = { fullscreenEnabled: true, fullscreenElement, documentElement: { requestFullscreen }, exitFullscreen } as unknown as Document
  return { target, requestFullscreen, exitFullscreen }
}

describe('fullscreen controls', () => {
  it('requests real browser fullscreen from the document element', async () => {
    const { target, requestFullscreen, exitFullscreen } = createDocument()
    expect(canUseFullscreen(target)).toBe(true)
    await toggleFullscreen(target)
    expect(requestFullscreen).toHaveBeenCalledOnce()
    expect(exitFullscreen).not.toHaveBeenCalled()
  })

  it('exits fullscreen when a fullscreen element exists', async () => {
    const { target, requestFullscreen, exitFullscreen } = createDocument({})
    await toggleFullscreen(target)
    expect(exitFullscreen).toHaveBeenCalledOnce()
    expect(requestFullscreen).not.toHaveBeenCalled()
  })

  it('fails safely when the Fullscreen API is unavailable', async () => {
    const target = { fullscreenEnabled: false, documentElement: {} } as Document
    expect(canUseFullscreen(target)).toBe(false)
    await expect(toggleFullscreen(target)).resolves.toBe(false)
  })
})
