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
  it('prefers newer synchronous local progress while the latest cloud write is pending', async () => {
    const cloud = { updatedAt: '2026-01-01T00:00:00.000Z', submittedGroups: ['dawn-scroll'] }
    const local = { updatedAt: '2026-01-01T00:00:01.000Z', submittedGroups: ['dawn-scroll', 'forest-scroll'] }
    const result = await loadProgressWithFallback(true, async () => cloud, () => local)
    expect(result.value).toBe(local)
    expect(result.cloudLoaded).toBe(true)
  })

  it('prefers cloud progress when it is at least as recent as local progress', async () => {
    const cloud = { updatedAt: '2026-01-01T00:00:02.000Z', submittedGroups: ['dawn-scroll', 'forest-scroll'] }
    const local = { updatedAt: '2026-01-01T00:00:01.000Z', submittedGroups: ['dawn-scroll'] }
    const result = await loadProgressWithFallback(true, async () => cloud, () => local)
    expect(result.value).toBe(cloud)
  })
})
