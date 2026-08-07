export type KeyLevel = 0 | 1 | 2 | 3

export const KEY_LEVEL_THRESHOLDS = {
  level1: 1,
  level2: 2,
  level3: 3,
} as const

export function getKeyLevel(answeredGroupCount: number): KeyLevel {
  if (answeredGroupCount >= KEY_LEVEL_THRESHOLDS.level3) return 3
  if (answeredGroupCount >= KEY_LEVEL_THRESHOLDS.level2) return 2
  if (answeredGroupCount >= KEY_LEVEL_THRESHOLDS.level1) return 1
  return 0
}

export function hasReachedCollectedLevel(answeredGroupCount: number) {
  return getKeyLevel(answeredGroupCount) >= 1
}
