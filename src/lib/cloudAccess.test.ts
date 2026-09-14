import { describe, expect, it, vi } from 'vitest'
import { NO_CLASS_SELECTED, canUseCloudProgress, canWriteCloudProgress, cloudClassSessionKey, confirmClassProgressReset, hasCompletedCloudReadForClass, loadProgressWithFallback } from './cloudAccess'

describe('cloud progress authorization gate', () => {
  it('starts a new browser session without a fallback class such as 701', () => expect(NO_CLASS_SELECTED).toBe(''))
  it.each(['loading', 'signed-out', 'checking', 'unauthorized', 'error'] as const)('blocks %s users', (status) => expect(canUseCloudProgress(status, true, false)).toBe(false))
  it('allows an authorized teacher after the class cloud state was loaded', () => expect(canUseCloudProgress('authorized', true, false)).toBe(true))
  it('blocks an authorized teacher until the class is reopened safely', () => expect(canUseCloudProgress('authorized', false, false)).toBe(false))
  it('blocks Firestore during test mode', () => expect(canUseCloudProgress('authorized', true, true)).toBe(false))
  it('blocks writes until a class and its initial read are both ready', () => {
    const writeFirestore = vi.fn()
    if (canWriteCloudProgress('authorized', '115學年度', '', true, false)) writeFirestore()
    expect(writeFirestore).toHaveBeenCalledTimes(0)
    expect(canWriteCloudProgress('authorized', '', '701', true, false)).toBe(false)
    expect(canWriteCloudProgress('authorized', '115學年度', '701', false, false)).toBe(false)
    expect(canWriteCloudProgress('authorized', '115學年度', '701', true, false)).toBe(true)
  })
  it('binds the completed read to the explicitly selected year and class', () => {
    const loaded701 = cloudClassSessionKey('115學年度', '701')
    expect(hasCompletedCloudReadForClass('115學年度', '701', loaded701)).toBe(true)
    const read702Complete = hasCompletedCloudReadForClass('115學年度', '702', loaded701)
    expect(read702Complete).toBe(false)
    expect(canWriteCloudProgress('authorized', '115學年度', '702', read702Complete, false)).toBe(false)
  })
  it('does not authorize a destructive reset when the teacher cancels confirmation', () => {
    const confirmReset = vi.fn(() => false)
    const resetFirestore = vi.fn()
    if (confirmClassProgressReset(confirmReset, '115學年度', '701')) resetFirestore()
    expect(resetFirestore).toHaveBeenCalledTimes(0)
    expect(confirmReset).toHaveBeenCalledWith(expect.stringContaining('115學年度 701 班'))
  })
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
  it('keeps existing cloud progress authoritative over a newer empty local snapshot', async () => {
    const cloud = { updatedAt: '2026-01-01T00:00:00.000Z', submittedGroups: ['dawn-scroll'] }
    const local = { updatedAt: '2026-01-01T00:00:01.000Z', submittedGroups: [] }
    const result = await loadProgressWithFallback(true, async () => cloud, () => local)
    expect(result.value).toBe(cloud)
    expect(result.cloudLoaded).toBe(true)
  })

  it('treats a successful empty cloud read as a new class instead of reviving local data', async () => {
    const local = { classId: '701', progress: 10 }
    const result = await loadProgressWithFallback(true, async () => null, () => local)
    expect(result).toEqual({ value: null, cloudLoaded: true, cloudError: false })
  })

  it('prefers cloud progress when it is at least as recent as local progress', async () => {
    const cloud = { updatedAt: '2026-01-01T00:00:02.000Z', submittedGroups: ['dawn-scroll', 'forest-scroll'] }
    const local = { updatedAt: '2026-01-01T00:00:01.000Z', submittedGroups: ['dawn-scroll'] }
    const result = await loadProgressWithFallback(true, async () => cloud, () => local)
    expect(result.value).toBe(cloud)
  })
})
