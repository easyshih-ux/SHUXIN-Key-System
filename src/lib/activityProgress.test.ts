import { describe, expect, it } from 'vitest'
import { normalizeAcademicYearKey, normalizeClassId, progressDocumentPath } from './activityProgress'
import { createInitialProgress } from './progress'
import { getKeyLevel, hasReachedCollectedLevel } from '../config/keyLevels'

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
  it('creates a defensive empty activity', () => expect(createInitialProgress('')).toMatchObject({ version: 4, completedChapters: [], revealState: 'locked' }))
  it.each([[0, 0], [1, 1], [2, 2], [3, 3], [8, 3]])('maps %i groups to level %i', (groups, level) => expect(getKeyLevel(groups)).toBe(level))
  it('keeps the existing collected threshold', () => { expect(hasReachedCollectedLevel(0)).toBe(false); expect(hasReachedCollectedLevel(1)).toBe(true) })
})
