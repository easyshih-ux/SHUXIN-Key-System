import type { TeacherAuthSnapshot } from './teacherAuth'

export function canUseCloudProgress(authStatus: TeacherAuthSnapshot['status'], cloudSessionReady: boolean, isTestMode: boolean) {
  return authStatus === 'authorized' && cloudSessionReady && !isTestMode
}

export async function loadProgressWithFallback<T>(cloudAllowed: boolean, loadCloud: () => Promise<T | null>, loadLocal: () => T | null) {
  if (!cloudAllowed) return { value: loadLocal(), cloudLoaded: false, cloudError: false }
  try {
    const [cloud, local] = [await loadCloud(), loadLocal()]
    const cloudTime = Date.parse((cloud as { updatedAt?: string } | null)?.updatedAt ?? '')
    const localTime = Date.parse((local as { updatedAt?: string } | null)?.updatedAt ?? '')
    const value = local && (!cloud || (Number.isFinite(localTime) && (!Number.isFinite(cloudTime) || localTime > cloudTime))) ? local : cloud
    return { value, cloudLoaded: true, cloudError: false }
  } catch {
    return { value: loadLocal(), cloudLoaded: false, cloudError: true }
  }
}
