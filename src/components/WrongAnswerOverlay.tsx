import type { Chapter } from '../data/types'
import { KeyImage } from './KeyImage'

export function WrongAnswerOverlay({ chapter }: { chapter: Chapter }) {
  return <div className="wrong-answer-overlay" role="status" aria-live="assertive">
    <div className="awakening-vignette" />
    <section className="awakening-scene wrong-answer-scene">
      <p>{chapter.id}｜{chapter.keyword}</p>
      <div className="wrong-answer-key-stage">
        <KeyImage level={0} className="wrong-answer-key" alt={`${chapter.keyword}未亮鑰匙`} />
      </div>
      <h2>答案錯誤</h2>
      <span>鑰匙未能點亮</span>
    </section>
  </div>
}
