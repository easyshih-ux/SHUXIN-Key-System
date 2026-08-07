import { chapters } from '../data/chapters'
import { abilityByChapter } from '../data/abilities'

export function AbilitiesOverview({ onBack }: { onBack: () => void }) {
  return <main className="abilities-overview">
    <header><div><span>SHUXIN</span><h1>完整20項書馨關鍵力</h1><p>二十把鑰匙，開啟二十種逐漸長成的能力。</p></div><button onClick={onBack}>返回鑰匙總覽</button></header>
    <section>
      {chapters.map((chapter) => <article key={chapter.id}>
        <span>{chapter.id.toUpperCase()}｜{chapter.keyword}</span>
        <strong>{abilityByChapter[chapter.id].name}</strong>
        <p>{abilityByChapter[chapter.id].description}</p>
      </article>)}
    </section>
  </main>
}
