import type { ChapterId } from '../data/types'
import type { ProgressState } from './progress'

export type TestScenario = 'waiting' | 'unresolved' | 'last' | 'reveal' | 'directions'
export type TestMainView = 'wall' | 'collective' | 'directions' | 'abilities'

export interface TestSession {
  version: 1
  backupProgress: ProgressState
  backupView: TestMainView
  currentView: TestMainView
  scenario: TestScenario
  unresolvedChapterIds: ChapterId[]
  startedAt: string
}

export const TEST_SESSION_STORAGE_KEY = 'shuxin-flow-test-session-v1'
export const TEST_PROGRESS_STORAGE_KEY = 'shuxin-flow-test-progress-v1'

export function loadTestSession(): TestSession | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(TEST_SESSION_STORAGE_KEY) ?? '') as TestSession
    return parsed?.version === 1 && parsed.backupProgress ? parsed : null
  } catch {
    return null
  }
}

export function saveTestSession(session: TestSession) {
  localStorage.setItem(TEST_SESSION_STORAGE_KEY, JSON.stringify(session))
}

export function loadTestProgress(): ProgressState | null {
  try {
    return JSON.parse(localStorage.getItem(TEST_PROGRESS_STORAGE_KEY) ?? '') as ProgressState
  } catch {
    return null
  }
}

export function saveTestProgress(progress: ProgressState) {
  localStorage.setItem(TEST_PROGRESS_STORAGE_KEY, JSON.stringify(progress))
}

export function clearTestStorage() {
  localStorage.removeItem(TEST_SESSION_STORAGE_KEY)
  localStorage.removeItem(TEST_PROGRESS_STORAGE_KEY)
}
