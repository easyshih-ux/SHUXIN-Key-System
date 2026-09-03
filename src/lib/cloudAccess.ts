import type { TeacherAuthSnapshot } from './teacherAuth'

export function canUseCloudProgress(authStatus: TeacherAuthSnapshot['status'], cloudSessionReady: boolean, isTestMode: boolean) {
  return authStatus === 'authorized' && cloudSessionReady && !isTestMode
}

export async function loadProgressWithFallback<T>(cloudAllowed: boolean, loadCloud: () => Promise<T | null>, loadLocal: () => T | null) {
  if (!cloudAllowed) return { value: loadLocal(), cloudLoaded: false, cloudError: false }
  try {
    return { value: (await loadCloud()) ?? loadLocal(), cloudLoaded: true, cloudError: false }
  } catch {
    return { value: loadLocal(), cloudLoaded: false, cloudError: true }
  }
}