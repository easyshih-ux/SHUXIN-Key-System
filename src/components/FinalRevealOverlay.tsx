import { chapters } from '../data/chapters'
import { KeyImage } from './KeyImage'

interface Props {
  ready: boolean
  revealIndex: number
  onSkip: () => void
  onContinue: () => void
}

export function FinalRevealOverlay({ ready, revealIndex, onSkip, onContinue }: Props) {
  return <div className="final-reveal" role="dialog" aria-modal="true" aria-label="SHUXIN正式揭曉">
    <button className="reveal-skip" onClick={onSkip}>略過動畫</button>
    <div className="reveal-keys" aria-hidden="true">
      {chapters.map((chapter) => <div key={chapter.id} className={chapter.number <= revealIndex ? 'awake' : ''}><KeyImage level={chapter.number <= revealIndex ? 3 : 1} alt="" /></div>)}
    </div>
    <div className="reveal-center-content">
      <div className="reveal-center-mark"><strong>SHUXIN</strong><span>二十把鑰匙，正在喚醒書馨的故事</span></div>
      <div className="reveal-words" aria-live="polite">
        <p>今天找回的，不只是二十把鑰匙。</p>
        <p>它們也是你們在這一年書馨課中，<br />將逐漸開啟的二十種能力。</p>
      </div>
      <div className="reveal-action-slot">
        {ready && <button className="reveal-continue" onClick={onContinue}>查看書馨關鍵力</button>}
      </div>
    </div>
  </div>
}
