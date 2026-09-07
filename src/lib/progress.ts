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
  submittedGroups: string[]
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
  submittedGroups: [],
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

export const submittedGroupsWithLegacyFallback = (progress: Partial<ProgressState> & { completedGroups?: unknown }) => Array.isArray(progress.submittedGroups)
  ? progress.submittedGroups.filter((id): id is string => typeof id === 'string')
  : Array.isArray(progress.completedGroups)
    ? progress.completedGroups.filter((id): id is string => typeof id === 'string')
    : Object.entries(progress.attemptedByRoute ?? {}).filter(([, chapterIds]) => Array.isArray(chapterIds) && chapterIds.length >= 5).map(([routeId]) => routeId)

export const withoutLegacyCompletedGroups = (progress: ProgressState): ProgressState => {
  const normalized = { ...progress } as ProgressState & { completedGroups?: unknown }
  delete normalized.completedGroups
  return normalized
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
      submittedGroups: submittedGroupsWithLegacyFallback(parsed),
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

export function changeSelectedRoute(progress: ProgressState, routeId: string): ProgressState {
  return { ...progress, selectedRouteId: routeId, updatedAt: new Date().toISOString() }
}

export function submitSelectedRoute(progress: ProgressState): ProgressState {
  if (!progress.selectedRouteId || (progress.submittedGroups ?? []).includes(progress.selectedRouteId)) return progress
  return { ...progress, submittedGroups: [...new Set([...(progress.submittedGroups ?? []), progress.selectedRouteId])], updatedAt: new Date().toISOString() }
}

export function recordCorrectRouteAnswer(progress: ProgressState, routeId: string, chapterId: ChapterId): ProgressState {
  return {
    ...progress,
    selectedRouteId: routeId,
    completedByRoute: { ...progress.completedByRoute, [routeId]: [...new Set([...(progress.completedByRoute[routeId] ?? []), chapterId])] },
    completedChapters: [...new Set([...progress.completedChapters, chapterId])],
    answeredGroupsByChapter: { ...progress.answeredGroupsByChapter, [chapterId]: [...new Set([...(progress.answeredGroupsByChapter[chapterId] ?? []), routeId])] },
    attemptedByRoute: { ...progress.attemptedByRoute, [routeId]: [...new Set([...(progress.attemptedByRoute[routeId] ?? []), chapterId])] },
    updatedAt: new Date().toISOString(),
  }
}

export function recordIncorrectRouteAnswer(progress: ProgressState, routeId: string, chapterId: ChapterId, normalizedInput: string): ProgressState {
  return {
    ...progress,
    attemptedByRoute: { ...progress.attemptedByRoute, [routeId]: [...new Set([...(progress.attemptedByRoute[routeId] ?? []), chapterId])] },
    attemptedInputsByRoute: { ...progress.attemptedInputsByRoute, [routeId]: [...new Set([...(progress.attemptedInputsByRoute[routeId] ?? []), normalizedInput])] },
    updatedAt: new Date().toISOString(),
  }
}

export type RouteChapterState = 'unattempted' | 'incorrect' | 'correct'

export function getRouteChapterState(progress: ProgressState, routeId: string, chapterId: ChapterId): RouteChapterState {
  if ((progress.completedByRoute[routeId] ?? []).includes(chapterId)) return 'correct'
  if ((progress.attemptedByRoute[routeId] ?? []).includes(chapterId)) return 'incorrect'
  return 'unattempted'
}

export function partitionRoutesBySubmission<T extends { id: string }>(routeList: T[], submittedGroups: string[]) {
  const submitted = new Set(submittedGroups)
  return {
    pendingRoutes: routeList.filter((route) => !submitted.has(route.id)),
    submittedRoutes: routeList.filter((route) => submitted.has(route.id)),
  }
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
