import type { Chapter } from '../data/types'
import type { KeyLevel } from '../config/keyLevels'
import { KeyImage } from './KeyImage'

export interface AwakeningState {
  chapter: Chapter
  beforeLevel: KeyLevel
  afterLevel: KeyLevel
  groupCount: number
}

export function AwakeningOverlay({ state }: { state: AwakeningState }) {
  const upgraded = state.groupCount > 1
  return <div className="awakening-overlay" role="status" aria-live="assertive">
    <div className="awakening-vignette" />
    <section className="awakening-scene">
      <p>{state.chapter.id}｜{state.chapter.keyword}</p>
      <div className="awakening-key-stage">
        <KeyImage level={state.beforeLevel} className="awakening-key before" />
        <KeyImage level={state.afterLevel} className="awakening-key after" />
        <i className="awakening-dust" aria-hidden="true" />
      </div>
      <h2>{upgraded ? '共鳴提升' : '鑰匙已找回'}</h2>
      {upgraded && <span>已有 {state.groupCount} 組找回</span>}
    </section>
  </div>
}
