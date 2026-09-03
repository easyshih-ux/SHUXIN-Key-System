import { describe, expect, it, vi } from 'vitest'
import { canUseCloudProgress, loadProgressWithFallback } from './cloudAccess'

describe('cloud progress authorization gate', () => {
  it.each(['loading', 'signed-out', 'checking', 'unauthorized', 'error'] as const)('blocks %s users', (status) => expect(canUseCloudProgress(status, true, false)).toBe(false))
  it('allows an authorized teacher after the class cloud state was loaded', () => expect(canUseCloudProgress('authorized', true, false)).toBe(true))
  it('blocks an authorized teacher until the class is reopened safely', () => expect(canUseCloudProgress('authorized', false, false)).toBe(false))
  it('blocks Firestore during test mode', () => expect(canUseCloudProgress('authorized', true, true)).toBe(false))
})
describe('Firestore failure fallback', () => {
  it('returns local progress when Firestore rejects permission', async () => {
    const local = { classId: '701', progress: 8 }
    const result = await loadProgressWithFallback(true, async () => { throw new Error('permission-denied') }, () => local)
    expect(result).toEqual({ value: local, cloudLoaded: false, cloudError: true })
  })
  it('does not call Firestore for test mode or unauthorized sessions', async () => {
    const cloud = vi.fn()
    const local = { classId: '702', progress: 3 }
    const result = await loadProgressWithFallback(false, cloud, () => local)
    expect(cloud).not.toHaveBeenCalled()
    expect(result.value).toBe(local)
  })
})
