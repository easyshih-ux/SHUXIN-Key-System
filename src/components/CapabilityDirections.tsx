import { useState } from 'react'
import direction1 from '../../assets/01_看見更多_web.webp'
import direction2 from '../../assets/02_讀懂訊息_web.webp'
import direction3 from '../../assets/03_認識自己_web.webp'
import direction4 from '../../assets/04_開展可能_web.webp'

const directions = [
  { image: direction1, name: '看見更多', next: '下一個方向：讀懂訊息' },
  { image: direction2, name: '讀懂訊息', next: '下一個方向：認識自己' },
  { image: direction3, name: '認識自己', next: '下一個方向：開展可能' },
  { image: direction4, name: '開展可能', next: '查看完整20項關鍵力' },
]

interface Props { onFinish: () => void }

export function CapabilityDirections({ onFinish }: Props) {
  const [index, setIndex] = useState(0)
  const direction = directions[index]
  return <main className="directions-page">
    <header><span>書馨關鍵力</span><strong>{index + 1}／4</strong></header>
    <section className="direction-stage" key={direction.image}>
      <img src={direction.image} alt={`書馨關鍵力方向：${direction.name}`} />
    </section>
    <footer>
      <button className="direction-back" disabled={index === 0} onClick={() => setIndex((current) => Math.max(0, current - 1))}>上一張</button>
      <button className="direction-next" onClick={() => index === 3 ? onFinish() : setIndex((current) => Math.min(3, current + 1))}>{direction.next}</button>
    </footer>
  </main>
}
