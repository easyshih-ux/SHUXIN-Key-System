import type { Route } from '../data/types'

export function ScrollPerfectOverlay({ route }: { route: Route }) {
  return <div className="scroll-perfect-overlay" role="status" aria-live="assertive">
    <div className="awakening-vignette" />
    <i className="scroll-perfect-ring" aria-hidden="true" />
    <i className="scroll-perfect-dust" aria-hidden="true" />
    <section className="scroll-perfect-scene">
      <p>{route.name}</p>
      <div className="scroll-perfect-keys" aria-hidden="true">
        {route.chapters.map((chapterId) => <i key={chapterId}>◆</i>)}
      </div>
      <h2>卷軸共鳴</h2>
      <span>五把鑰匙，全數回應</span>
    </section>
  </div>
}
