import { describe, expect, it } from 'vitest'
import { normalizeAcademicYearKey, normalizeClassId, progressDocumentPath } from './activityProgress'
import { changeSelectedRoute, createInitialProgress, getRouteChapterState, partitionRoutesBySubmission, recordCorrectRouteAnswer, recordIncorrectRouteAnswer, submitSelectedRoute, submittedGroupsWithLegacyFallback, withoutLegacyCompletedGroups } from './progress'
import { getKeyLevel, hasReachedCollectedLevel } from '../config/keyLevels'
import { routes } from '../data/routes'

describe('activity progress isolation', () => {
  it.each([
    ['115學年度', '701', 'academicYears/115學年度/classes/701/activityProgress/current'],
    ['115學年度', '702', 'academicYears/115學年度/classes/702/activityProgress/current'],
    ['116學年度', '701', 'academicYears/116學年度/classes/701/activityProgress/current'],
  ])('builds an isolated path for %s / %s', (year, classId, expected) => expect(progressDocumentPath(year, classId)).toBe(expected))
  it('does not collide across classes', () => expect(progressDocumentPath('115學年度', '701')).not.toBe(progressDocumentPath('115學年度', '702')))
  it('does not collide across years', () => expect(progressDocumentPath('115學年度', '701')).not.toBe(progressDocumentPath('116學年度', '701')))
  it('normalizes an unsafe academic year', () => expect(normalizeAcademicYearKey('115 / 年度')).toBe('115---年度'))
  it('normalizes class whitespace', () => expect(normalizeClassId(' 701 ')).toBe('701'))
  it('normalizes embedded class whitespace', () => expect(normalizeClassId('七 年 一')).toBe('七-年-一'))
})

describe('existing progress and key rules remain intact', () => {
  it('creates a defensive empty activity', () => expect(createInitialProgress('')).toMatchObject({ version: 4, completedChapters: [], submittedGroups: [], revealState: 'locked' }))
  it.each([[0, 0], [1, 1], [2, 2], [3, 3], [8, 3]])('maps %i groups to level %i', (groups, level) => expect(getKeyLevel(groups)).toBe(level))
  it('keeps the existing collected threshold', () => { expect(hasReachedCollectedLevel(0)).toBe(false); expect(hasReachedCollectedLevel(1)).toBe(true) })
})

describe('group submission is independent from answer correctness', () => {
  it('does not submit a group on the initial selection', () => {
    const next = changeSelectedRoute(createInitialProgress(''), 'route-1')
    expect(next.submittedGroups).toEqual([])
  })

  it.each([0, 3, 5])('does not submit the previous group when switching after %i correct answers', (correctAnswers) => {
    const current = createInitialProgress('route-1')
    current.completedByRoute['route-1'] = Array.from({ length: correctAnswers }, (_, index) => `Chapter ${index + 1}` as const)
    const next = changeSelectedRoute(current, 'route-2')
    expect(next.submittedGroups).toEqual([])
    expect(next.completedByRoute['route-1']).toHaveLength(correctAnswers)
  })

  it.each([0, 1, 3, 5])('submits the selected route with %i attempted answers', (attemptCount) => {
    const current = createInitialProgress('route-7')
    current.attemptedByRoute['route-7'] = Array.from({ length: attemptCount }, (_, index) => `Chapter ${index + 1}` as const)
    const next = submitSelectedRoute(current)
    expect(next.submittedGroups).toEqual(['route-7'])
    expect(next.selectedRouteId).toBe('route-7')
    expect(next.attemptedByRoute['route-7']).toHaveLength(attemptCount)
  })

  it('does not duplicate a completed group', () => {
    const current = { ...createInitialProgress('route-1'), submittedGroups: ['route-1'] }
    expect(submitSelectedRoute(current)).toBe(current)
  })

  it('adds a third submitted route to an existing unique set', () => {
    const current = { ...createInitialProgress('star-sea-scroll'), submittedGroups: ['dawn-scroll', 'forest-scroll'] }
    const next = submitSelectedRoute(current)
    expect(next.submittedGroups).toEqual(['dawn-scroll', 'forest-scroll', 'star-sea-scroll'])
    expect(7 - next.submittedGroups.length).toBe(4)
  })

  it('restores submitted routes and partial answers after serialization', () => {
    const current = createInitialProgress('dawn-scroll')
    current.attemptedByRoute['dawn-scroll'] = ['Chapter 08', 'Chapter 12']
    current.completedByRoute['dawn-scroll'] = ['Chapter 08']
    const saved = submitSelectedRoute(current)
    const restored = JSON.parse(JSON.stringify(saved)) as typeof saved
    expect(restored.submittedGroups).toEqual(['dawn-scroll'])
    expect(7 - restored.submittedGroups.length).toBe(6)
    expect(getRouteChapterState(restored, 'dawn-scroll', 'Chapter 08')).toBe('correct')
    expect(getRouteChapterState(restored, 'dawn-scroll', 'Chapter 12')).toBe('incorrect')
    expect(getRouteChapterState(restored, 'dawn-scroll', 'Chapter 01')).toBe('unattempted')
  })

  it('restores legacy completed groups once from five recorded attempts', () => {
    const legacy = { attemptedByRoute: { 'route-1': ['Chapter 1', 'Chapter 2', 'Chapter 3', 'Chapter 4', 'Chapter 5'], 'route-2': ['Chapter 6'] } }
    expect(submittedGroupsWithLegacyFallback(legacy as never)).toEqual(['route-1'])
  })

  it('migrates the temporary completedGroups field without persisting two sources of truth', () => {
    const legacy = { ...createInitialProgress('route-2'), completedGroups: ['route-1'], submittedGroups: ['route-1'] }
    const normalized = withoutLegacyCompletedGroups(legacy)
    expect(normalized.submittedGroups).toEqual(['route-1'])
    expect(normalized).not.toHaveProperty('completedGroups')
  })

  it('distinguishes unattempted, incorrect, and correct route chapters', () => {
    const progress = createInitialProgress('route-1')
    progress.attemptedByRoute['route-1'] = ['Chapter 01', 'Chapter 02']
    progress.completedByRoute['route-1'] = ['Chapter 01']
    expect(getRouteChapterState(progress, 'route-1', 'Chapter 01')).toBe('correct')
    expect(getRouteChapterState(progress, 'route-1', 'Chapter 02')).toBe('incorrect')
    expect(getRouteChapterState(progress, 'route-1', 'Chapter 03')).toBe('unattempted')
  })

  it('accumulates rapid answers and submissions across three routes without dropping earlier state', () => {
    let progress = createInitialProgress('dawn-scroll')
    progress = recordCorrectRouteAnswer(progress, 'dawn-scroll', 'Chapter 08')
    progress = recordIncorrectRouteAnswer(progress, 'dawn-scroll', 'Chapter 12', 'wrong-dawn')
    progress = submitSelectedRoute(progress)
    progress = changeSelectedRoute(progress, 'stars-scroll')
    progress = recordCorrectRouteAnswer(progress, 'stars-scroll', 'Chapter 04')
    progress = submitSelectedRoute(progress)
    progress = changeSelectedRoute(progress, 'forest-scroll')
    progress = recordIncorrectRouteAnswer(progress, 'forest-scroll', 'Chapter 17', 'wrong-forest')
    progress = submitSelectedRoute(progress)

    expect(progress.submittedGroups).toEqual(['dawn-scroll', 'stars-scroll', 'forest-scroll'])
    expect(getRouteChapterState(progress, 'dawn-scroll', 'Chapter 08')).toBe('correct')
    expect(getRouteChapterState(progress, 'dawn-scroll', 'Chapter 12')).toBe('incorrect')
    expect(getRouteChapterState(progress, 'stars-scroll', 'Chapter 04')).toBe('correct')
    expect(getRouteChapterState(progress, 'forest-scroll', 'Chapter 17')).toBe('incorrect')
  })

  it('accumulates seven unique partial route submissions and survives serialization', () => {
    let progress = createInitialProgress('')
    routes.forEach((route) => {
      progress = changeSelectedRoute(progress, route.id)
      progress = recordIncorrectRouteAnswer(progress, route.id, route.chapters[0], `wrong-${route.id}`)
      progress = submitSelectedRoute(progress)
    })
    const restored = JSON.parse(JSON.stringify(progress)) as typeof progress
    expect(new Set(restored.submittedGroups).size).toBe(7)
    expect(7 - restored.submittedGroups.length).toBe(0)
    routes.forEach((route) => expect(getRouteChapterState(restored, route.id, route.chapters[0])).toBe('incorrect'))
  })

  it('keeps the same chapter attempts isolated across different routes', () => {
    let progress = createInitialProgress('dawn-scroll')
    progress = recordCorrectRouteAnswer(progress, 'dawn-scroll', 'Chapter 08')
    progress = recordIncorrectRouteAnswer(progress, 'stars-scroll', 'Chapter 08', 'wrong-stars')
    expect(getRouteChapterState(progress, 'dawn-scroll', 'Chapter 08')).toBe('correct')
    expect(getRouteChapterState(progress, 'stars-scroll', 'Chapter 08')).toBe('incorrect')
  })

  it('preserves an answer when submission immediately follows it', () => {
    const answered = recordIncorrectRouteAnswer(createInitialProgress('dawn-scroll'), 'dawn-scroll', 'Chapter 08', 'wrong')
    const submitted = submitSelectedRoute(answered)
    expect(submitted.submittedGroups).toEqual(['dawn-scroll'])
    expect(getRouteChapterState(submitted, 'dawn-scroll', 'Chapter 08')).toBe('incorrect')
  })

  it('shows all seven routes as pending before any submission', () => {
    const grouped = partitionRoutesBySubmission(routes, [])
    expect(grouped.pendingRoutes).toHaveLength(7)
    expect(grouped.submittedRoutes).toEqual([])
  })

  it('partitions three completed routes without hiding or duplicating them', () => {
    const submitted = ['dawn-scroll', 'forest-scroll', 'star-sea-scroll']
    const grouped = partitionRoutesBySubmission(routes, submitted)
    expect(grouped.pendingRoutes).toHaveLength(4)
    expect(grouped.submittedRoutes.map((route) => route.id)).toEqual(submitted)
    expect(new Set([...grouped.pendingRoutes, ...grouped.submittedRoutes].map((route) => route.id)).size).toBe(7)
  })
})
