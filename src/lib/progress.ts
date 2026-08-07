import type { ChapterId } from '../data/types'

export interface ProgressState {
  version: 4
  selectedRouteId: string
  completedChapters: ChapterId[]
  completedByRoute: Record<string, ChapterId[]>
  answeredGroupsByChapter: Partial<Record<ChapterId, string[]>>
  acceptedAnswersByChapter: Partial<Record<ChapterId, string[]>>
  attemptedByRoute: Record<string, ChapterId[]>
  attemptedInputsByRoute: Record<string, string[]>
  revealState: 'locked' | 'revealed'
  updatedAt: string
}

export const STORAGE_KEY = 'shuxin-key-system-progress-v1'

export const createInitialProgress = (routeId: string): ProgressState => ({
  version: 4,
  selectedRouteId: routeId,
  completedChapters: [],
  completedByRoute: {},
  answeredGroupsByChapter: {},
  acceptedAnswersByChapter: {},
  attemptedByRoute: {},
  attemptedInputsByRoute: {},
  revealState: 'locked',
  updatedAt: new Date().toISOString(),
})

const invertRouteProgress = (completedByRoute: Record<string, ChapterId[]>) => {
  const result: Partial<Record<ChapterId, string[]>> = {}
  Object.entries(completedByRoute).forEach(([routeId, chapterIds]) => {
    chapterIds.forEach((chapterId) => {
      result[chapterId] = [...new Set([...(result[chapterId] ?? []), routeId])]
    })
  })
  return result
}

export function loadProgress(routeId: string): ProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createInitialProgress(routeId)
    const parsed = JSON.parse(raw) as Partial<ProgressState> & { version?: number }
    if (!Array.isArray(parsed.completedChapters)) return createInitialProgress(routeId)
    const completedByRoute = parsed.completedByRoute && typeof parsed.completedByRoute === 'object' ? parsed.completedByRoute : {}
    return {
      version: 4,
      selectedRouteId: typeof parsed.selectedRouteId === 'string' ? parsed.selectedRouteId : routeId,
      completedChapters: parsed.completedChapters as ChapterId[],
      completedByRoute,
      answeredGroupsByChapter: parsed.version && parsed.version >= 3 && parsed.answeredGroupsByChapter
        ? parsed.answeredGroupsByChapter
        : invertRouteProgress(completedByRoute),
      acceptedAnswersByChapter: parsed.acceptedAnswersByChapter ?? {},
      attemptedByRoute: parsed.attemptedByRoute && typeof parsed.attemptedByRoute === 'object'
        ? parsed.attemptedByRoute
        : completedByRoute,
      attemptedInputsByRoute: parsed.attemptedInputsByRoute && typeof parsed.attemptedInputsByRoute === 'object'
        ? parsed.attemptedInputsByRoute
        : {},
      revealState: parsed.revealState === 'revealed' ? 'revealed' : 'locked',
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    }
  } catch {
    return createInitialProgress(routeId)
  }
}

export function saveProgress(progress: ProgressState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
}

export function isProgressState(value: unknown): value is ProgressState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ProgressState>
  return candidate.version === 4
    && typeof candidate.selectedRouteId === 'string'
    && Array.isArray(candidate.completedChapters)
    && !!candidate.completedByRoute
    && !!candidate.answeredGroupsByChapter
    && !!candidate.acceptedAnswersByChapter
    && (candidate.revealState === 'locked' || candidate.revealState === 'revealed')
}
