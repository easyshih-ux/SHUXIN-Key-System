import type { TeacherAuthSnapshot } from './teacherAuth'

export const NO_CLASS_SELECTED = ''

export function canUseCloudProgress(authStatus: TeacherAuthSnapshot['status'], cloudSessionReady: boolean, isTestMode: boolean) {
  return authStatus === 'authorized' && cloudSessionReady && !isTestMode
}

export function cloudClassSessionKey(academicYear: string, classId: string) {
  return academicYear.trim() && classId.trim() ? `${academicYear.trim()}::${classId.trim()}` : ''
}

export function hasCompletedCloudReadForClass(academicYear: string, classId: string, loadedClassKey: string | null) {
  const requestedKey = cloudClassSessionKey(academicYear, classId)
  return !!requestedKey && loadedClassKey === requestedKey
}

export function confirmClassProgressReset(confirmReset: (message: string) => boolean, academicYear: string, classId: string) {
  return confirmReset(`確定要清除 ${academicYear} ${classId} 班目前的雲端探索進度嗎？\n此操作會清除本班目前已解鎖的鑰匙與組別進度。`)
}

export function canWriteCloudProgress(authStatus: TeacherAuthSnapshot['status'], academicYear: string, classId: string, initialReadComplete: boolean, isTestMode: boolean) {
  return !!cloudClassSessionKey(academicYear, classId) && canUseCloudProgress(authStatus, initialReadComplete, isTestMode)
}

export async function loadProgressWithFallback<T>(cloudAllowed: boolean, loadCloud: () => Promise<T | null>, loadLocal: () => T | null) {
  if (!cloudAllowed) return { value: loadLocal(), cloudLoaded: false, cloudError: false }
  try {
    return { value: await loadCloud(), cloudLoaded: true, cloudError: false }
  } catch {
    return { value: loadLocal(), cloudLoaded: false, cloudError: true }
  }
}
