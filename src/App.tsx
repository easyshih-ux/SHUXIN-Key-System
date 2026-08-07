import { useEffect, useMemo, useRef, useState } from 'react'
import { chapters } from './data/chapters'
import { routes } from './data/routes'
import { abilityByChapter } from './data/abilities'
import type { Chapter, ChapterId, Route } from './data/types'
import { getKeyLevel, hasReachedCollectedLevel } from './config/keyLevels'
import { createInitialProgress, isProgressState, loadProgress, saveProgress, type ProgressState } from './lib/progress'
import { KeyImage } from './components/KeyImage'
import { AwakeningOverlay, type AwakeningState } from './components/AwakeningOverlay'
import { audioManager } from './lib/audioManager'
import { FinalRevealOverlay } from './components/FinalRevealOverlay'
import { CapabilityDirections } from './components/CapabilityDirections'
import { AbilitiesOverview } from './components/AbilitiesOverview'

type DialogStep = 'librarian' | 'ability'
type ResultKind = 'first' | 'duplicate' | 'off-route' | 'wrong' | 'no-group'
type Result = { kind: ResultKind; chapter?: Chapter }
type MainView = 'wall' | 'collective' | 'directions' | 'abilities'

const normalize = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase('en-US')

export default function App() {
  const [progress, setProgress] = useState<ProgressState>(() => loadProgress(''))
  const [step, setStep] = useState<DialogStep | null>(null)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const closeTimer = useRef<number | null>(null)
  const revealTimers = useRef<number[]>([])
  const pendingChapterId = useRef<ChapterId | null>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const [abilityChapterId, setAbilityChapterId] = useState<ChapterId | null>(null)
  const [revealIndex, setRevealIndex] = useState(-1)
  const [revealAnimating, setRevealAnimating] = useState(false)
  const answerRef = useRef<HTMLInputElement>(null)
  const [awakening, setAwakening] = useState<AwakeningState | null>(null)
  const [highlightedChapter, setHighlightedChapter] = useState<ChapterId | null>(null)
  const [inputError, setInputError] = useState(false)
  const [dockCollapsed, setDockCollapsed] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(() => audioManager.getSettings().enabled)
  const [musicEnabled, setMusicEnabled] = useState(() => audioManager.getMusicSettings().enabled)
  const [mainView, setMainView] = useState<MainView>('wall')
  const [revealReady, setRevealReady] = useState(false)
  const [collectiveChapterIds, setCollectiveChapterIds] = useState<ChapterId[]>([])
  const [collectiveChapterId, setCollectiveChapterId] = useState<ChapterId | null>(null)
  const [collectiveAnswer, setCollectiveAnswer] = useState('')
  const [collectiveMessage, setCollectiveMessage] = useState('')
  const [chapterPreviewId, setChapterPreviewId] = useState<ChapterId | null>(null)
  const collectiveInputRef = useRef<HTMLInputElement>(null)

  const groupCounts = useMemo(() => Object.fromEntries(chapters.map((chapter) => [chapter.id, (progress.answeredGroupsByChapter[chapter.id] ?? []).length])), [progress.answeredGroupsByChapter])
  const completed = useMemo(() => new Set(chapters.filter((chapter) => hasReachedCollectedLevel(groupCounts[chapter.id])).map((chapter) => chapter.id)), [groupCounts])
  const allCollected = completed.size === chapters.length
  const selectedRoute = routes.find((route) => route.id === progress.selectedRouteId) ?? null
  const groupCompleted = selectedRoute ? new Set(progress.completedByRoute[selectedRoute.id] ?? []) : new Set<ChapterId>()
  const routeProgress = selectedRoute ? selectedRoute.chapters.filter((id) => groupCompleted.has(id)).length : 0
  const exploredRoutes = routes.filter((route) => route.chapters.every((id) => (progress.attemptedByRoute[route.id] ?? []).includes(id)))
  const allRoutesExplored = exploredRoutes.length === routes.length
  const canStartReveal = allCollected || allRoutesExplored
  const revealActionLabel = allCollected ? '開始揭曉' : allRoutesExplored ? '查看未解關卡' : '等待探索完成'

  useEffect(() => saveProgress(progress), [progress])
  useEffect(() => {
    if (!revealAnimating) return
    const previousOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => { document.documentElement.style.overflow = previousOverflow }
  }, [revealAnimating])
  useEffect(() => () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    revealTimers.current.forEach((timer) => window.clearTimeout(timer))
  }, [])
  useEffect(() => {
    const unlockAudio = () => audioManager.unlock()
    window.addEventListener('pointerdown', unlockAudio, { capture: true, once: true })
    window.addEventListener('keydown', unlockAudio, { capture: true, once: true })
    return () => {
      window.removeEventListener('pointerdown', unlockAudio, { capture: true })
      window.removeEventListener('keydown', unlockAudio, { capture: true })
    }
  }, [])

  const closeDialog = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    closeTimer.current = null
    setStep(null)
  }

  const registerChapter = (chapter: Chapter, route: Route) => {
    const routeEntries = progress.completedByRoute[route.id] ?? []
    const completedByRoute = { ...progress.completedByRoute, [route.id]: [...new Set([...routeEntries, chapter.id])] }
    const completedChapters = [...new Set([...progress.completedChapters, chapter.id])]
    const answeredGroups = progress.answeredGroupsByChapter[chapter.id] ?? []
    const answeredGroupsByChapter = {
      ...progress.answeredGroupsByChapter,
      [chapter.id]: [...new Set([...answeredGroups, route.id])],
    }
    setProgress({
      ...progress,
      selectedRouteId: route.id,
      completedByRoute,
      completedChapters,
      answeredGroupsByChapter,
      attemptedByRoute: { ...progress.attemptedByRoute, [route.id]: [...new Set([...(progress.attemptedByRoute[route.id] ?? []), chapter.id])] },
      updatedAt: new Date().toISOString(),
    })
  }

  const recordWrongAttempt = (route: Route) => {
    const attempted = progress.attemptedByRoute[route.id] ?? []
    const normalizedInput = normalize(answer)
    const attemptedInputs = progress.attemptedInputsByRoute[route.id] ?? []
    if (!normalizedInput || attemptedInputs.includes(normalizedInput)) return
    const nextChapter = route.chapters.find((id) => !attempted.includes(id))
    if (!nextChapter) return
    setProgress({ ...progress, attemptedByRoute: { ...progress.attemptedByRoute, [route.id]: [...attempted, nextChapter] }, attemptedInputsByRoute: { ...progress.attemptedInputsByRoute, [route.id]: [...attemptedInputs, normalizedInput] }, updatedAt: new Date().toISOString() })
  }

  const playAwakening = (chapter: Chapter, beforeCount: number, afterCount: number) => {
    const state: AwakeningState = { chapter, beforeLevel: getKeyLevel(beforeCount), afterLevel: getKeyLevel(afterCount), groupCount: afterCount }
    pendingChapterId.current = chapter.id
    setResult(null)
    setAwakening(state)
    audioManager.play(beforeCount === 0 ? 'keyAwakening' : 'resonanceUp')
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => {
      setAwakening(null)
      setAnswer('')
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        const targetChapterId = pendingChapterId.current
        const targetNumber = chapters.find((item) => item.id === targetChapterId)?.number
        const card = targetNumber ? document.getElementById(`chapter-${String(targetNumber).padStart(2, '0')}`) : null
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        card?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
        setHighlightedChapter(targetChapterId)
        window.setTimeout(() => setHighlightedChapter(null), 800)
        window.setTimeout(() => answerRef.current?.focus(), reduced ? 60 : 500)
        pendingChapterId.current = null
      }))
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 350 : 2000)
  }

  const submitAnswer = (event: React.FormEvent) => {
    event.preventDefault()
    audioManager.beginAnswerCheck()
    if (!selectedRoute) { audioManager.restoreMusic(); setResult({ kind: 'no-group' }); return }
    const chapter = chapters.find((item) => [item.answer, ...(progress.acceptedAnswersByChapter[item.id] ?? [])].some((candidate) => normalize(candidate) === normalize(answer)))
    if (!chapter) {
      recordWrongAttempt(selectedRoute)
      audioManager.play('answerWrong')
      setResult({ kind: 'wrong' })
      setInputError(true)
      if (closeTimer.current) window.clearTimeout(closeTimer.current)
      closeTimer.current = window.setTimeout(() => { setResult(null); setInputError(false); answerRef.current?.focus() }, 2000)
      return
    }
    const registered = (progress.completedByRoute[selectedRoute.id] ?? []).includes(chapter.id)
    if (registered) {
      audioManager.play('stampDuplicate')
      setResult({ kind: 'duplicate', chapter })
      if (closeTimer.current) window.clearTimeout(closeTimer.current)
      closeTimer.current = window.setTimeout(() => { setResult(null); answerRef.current?.focus() }, 1000)
      return
    }
    if (!selectedRoute.chapters.includes(chapter.id)) {
      audioManager.play('resonanceUp', 0.3)
      setResult({ kind: 'off-route', chapter })
      return
    }
    const beforeCount = progress.answeredGroupsByChapter[chapter.id]?.length ?? 0
    registerChapter(chapter, selectedRoute)
    playAwakening(chapter, beforeCount, beforeCount + 1)
  }

  const registerOffRoute = () => {
    if (!selectedRoute || !result?.chapter) return
    const chapter = result.chapter
    const beforeCount = progress.answeredGroupsByChapter[chapter.id]?.length ?? 0
    registerChapter(chapter, selectedRoute)
    playAwakening(chapter, beforeCount, beforeCount + 1)
  }

  const changeRoute = (routeId: string) => {
    if (answer.trim() && !window.confirm('輸入框仍有文字，確定要切換組別嗎？')) return
    setProgress({ ...progress, selectedRouteId: routeId, updatedAt: new Date().toISOString() })
    setResult(null)
    window.setTimeout(() => answerRef.current?.focus(), 0)
  }

  const rebuildProgress = (completedByRoute: Record<string, ChapterId[]>) => {
    const answeredGroupsByChapter: ProgressState['answeredGroupsByChapter'] = {}
    Object.entries(completedByRoute).forEach(([routeId, ids]) => ids.forEach((id) => {
      answeredGroupsByChapter[id] = [...new Set([...(answeredGroupsByChapter[id] ?? []), routeId])]
    }))
    const completedChapters = chapters.filter((chapter) => (answeredGroupsByChapter[chapter.id] ?? []).length > 0).map((chapter) => chapter.id)
    setProgress({ ...progress, completedByRoute, answeredGroupsByChapter, completedChapters, revealState: completedChapters.length === 20 ? progress.revealState : 'locked', updatedAt: new Date().toISOString() })
  }

  const toggleRecord = (routeId: string, chapterId: ChapterId) => {
    const current = progress.completedByRoute[routeId] ?? []
    rebuildProgress({ ...progress.completedByRoute, [routeId]: current.includes(chapterId) ? current.filter((id) => id !== chapterId) : [...current, chapterId] })
  }

  const resetRoute = (routeId: string) => {
    const completedByRoute = { ...progress.completedByRoute, [routeId]: [] }
    const answeredGroupsByChapter: ProgressState['answeredGroupsByChapter'] = {}
    Object.entries(completedByRoute).forEach(([id, ids]) => ids.forEach((chapterId) => {
      answeredGroupsByChapter[chapterId] = [...new Set([...(answeredGroupsByChapter[chapterId] ?? []), id])]
    }))
    const completedChapters = chapters.filter((chapter) => (answeredGroupsByChapter[chapter.id] ?? []).length > 0).map((chapter) => chapter.id)
    setProgress({ ...progress, completedByRoute, answeredGroupsByChapter, completedChapters, attemptedByRoute: { ...progress.attemptedByRoute, [routeId]: [] }, attemptedInputsByRoute: { ...progress.attemptedInputsByRoute, [routeId]: [] }, revealState: 'locked', updatedAt: new Date().toISOString() })
  }

  const resetAll = () => {
    if (!window.confirm('第一次確認：確定要重設整場活動嗎？')) return
    if (!window.confirm('第二次確認：所有進度、答案設定與揭曉狀態都會清除。')) return
    setProgress(createInitialProgress(''))
  }

  const exportProgress = () => {
    const blob = new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.href = url
    link.download = 'shuxin-progress.json'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const importProgress = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return
    try {
      const data: unknown = JSON.parse(await file.text())
      if (!isProgressState(data)) throw new Error()
      setProgress({ ...data, attemptedByRoute: data.attemptedByRoute ?? data.completedByRoute, attemptedInputsByRoute: data.attemptedInputsByRoute ?? {} })
    }
    catch { window.alert('無法匯入：檔案格式不正確。') }
    event.target.value = ''
  }

  const setAcceptedAnswers = (chapterId: ChapterId, value: string) => {
    const answers = value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean)
    setProgress({ ...progress, acceptedAnswersByChapter: { ...progress.acceptedAnswersByChapter, [chapterId]: answers }, updatedAt: new Date().toISOString() })
  }

  const clearRevealTimers = () => {
    revealTimers.current.forEach((timer) => window.clearTimeout(timer))
    revealTimers.current = []
  }

  const beginFormalReveal = () => {
    if (!allCollected || revealAnimating) return
    clearRevealTimers()
    setStep(null)
    setMainView('wall')
    setRevealAnimating(true)
    setRevealReady(false)
    setRevealIndex(0)
    audioManager.startRevealMusic()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRevealIndex(20)
      revealTimers.current.push(window.setTimeout(() => audioManager.finishRevealMusic(), 1000))
      revealTimers.current.push(window.setTimeout(() => setRevealReady(true), 2500))
      return
    }
    for (let chapterNumber = 1; chapterNumber <= 20; chapterNumber += 1) {
      const batchStart = chapterNumber <= 10 ? 3000 : 14000
      const withinBatch = chapterNumber <= 10 ? chapterNumber - 1 : chapterNumber - 11
      revealTimers.current.push(window.setTimeout(() => setRevealIndex(chapterNumber), batchStart + withinBatch * 450))
    }
    revealTimers.current.push(window.setTimeout(() => audioManager.finishRevealMusic(), 31000))
    revealTimers.current.push(window.setTimeout(() => setRevealReady(true), 33000))
  }

  const startReveal = () => {
    if (!canStartReveal || revealAnimating) return
    if (allCollected) { beginFormalReveal(); return }
    const unresolved = chapters.filter((chapter) => !hasReachedCollectedLevel(groupCounts[chapter.id])).map((chapter) => chapter.id)
    setCollectiveChapterIds(unresolved)
    setCollectiveChapterId(unresolved[0] ?? null)
    setCollectiveAnswer('')
    setCollectiveMessage('')
    setMainView('collective')
  }

  const skipReveal = () => {
    clearRevealTimers()
    setRevealIndex(20)
    setRevealReady(true)
    audioManager.finishRevealMusic()
  }

  const showDirections = () => {
    clearRevealTimers()
    setRevealAnimating(false)
    setRevealReady(false)
    setProgress((current) => ({ ...current, revealState: 'revealed', updatedAt: new Date().toISOString() }))
    audioManager.finishRevealMusic()
    audioManager.restoreMusic()
    setMainView('directions')
  }

  const submitCollectiveAnswer = (event: React.FormEvent) => {
    event.preventDefault()
    const chapter = chapters.find((item) => item.id === collectiveChapterId)
    if (!chapter || awakening) return
    const correct = [chapter.answer, ...(progress.acceptedAnswersByChapter[chapter.id] ?? [])].some((candidate) => normalize(candidate) === normalize(collectiveAnswer))
    if (!correct) {
      audioManager.play('answerWrong')
      setCollectiveMessage('謎底尚未產生共鳴，請再次確認')
      window.setTimeout(() => collectiveInputRef.current?.focus(), 50)
      return
    }
    const beforeCount = progress.answeredGroupsByChapter[chapter.id]?.length ?? 0
    const answeredGroupsByChapter = { ...progress.answeredGroupsByChapter, [chapter.id]: [...new Set([...(progress.answeredGroupsByChapter[chapter.id] ?? []), 'whole-class'])] }
    setProgress({ ...progress, answeredGroupsByChapter, completedChapters: [...new Set([...progress.completedChapters, chapter.id])], updatedAt: new Date().toISOString() })
    setAwakening({ chapter, beforeLevel: getKeyLevel(beforeCount), afterLevel: getKeyLevel(beforeCount + 1), groupCount: beforeCount + 1 })
    audioManager.play(beforeCount === 0 ? 'keyAwakening' : 'resonanceUp')
    setCollectiveMessage('')
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => {
      setAwakening(null)
      setCollectiveAnswer('')
      const nextChapter = collectiveChapterIds.find((id) => id !== chapter.id && !hasReachedCollectedLevel(groupCounts[id]))
      setCollectiveChapterId(nextChapter ?? chapter.id)
      window.setTimeout(() => collectiveInputRef.current?.focus(), 50)
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 350 : 2000)
  }

  const openAbility = (chapterId: ChapterId) => {
    if (progress.revealState !== 'revealed') return
    setAbilityChapterId(chapterId); setStep('ability')
  }

  if (mainView === 'directions') return <CapabilityDirections onFinish={() => setMainView('abilities')} />
  if (mainView === 'abilities') return <AbilitiesOverview onBack={() => setMainView('wall')} />

  if (mainView === 'collective') return <main className="collective-page">
    <header>
      <button onClick={() => setMainView('wall')}>返回鑰匙總覽</button>
      <div><h1>尚有幾把鑰匙等待全班一起找回</h1><p>探索者們，分享你們發現的線索，一起完成最後的解謎。</p></div>
      <strong>已找回 {completed.size}／20</strong>
    </header>
    <section className="collective-grid" aria-label="尚待共同解謎的關卡">
      {collectiveChapterIds.map((id) => {
        const chapter = chapters.find((item) => item.id === id)!
        const solved = hasReachedCollectedLevel(groupCounts[id])
        return <button key={id} disabled={!!awakening} className={`${collectiveChapterId === id ? 'selected ' : ''}${solved ? 'solved' : ''}`} onClick={() => { setCollectiveChapterId(id); setCollectiveMessage(''); if (!solved) setChapterPreviewId(id); window.setTimeout(() => collectiveInputRef.current?.focus(), 0) }}>
          <span>{chapter.id.toUpperCase()}</span><div><KeyImage level={solved ? getKeyLevel(groupCounts[id]) : 0} alt={`${chapter.keyword}鑰匙`} />{!solved && <i>?</i>}</div><strong>{chapter.keyword}</strong><small>{solved ? '鑰匙已找回' : '等待共同解謎'}</small>
        </button>
      })}
    </section>
    {allCollected ? <section className="collective-complete"><h2>二十把鑰匙已全數找回</h2><button onClick={beginFormalReveal}>開始正式揭曉</button></section> : <form className="collective-answer" onSubmit={submitCollectiveAnswer}>
      <label htmlFor="collective-answer">全班共同謎底</label>
      <input ref={collectiveInputRef} id="collective-answer" value={collectiveAnswer} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} onChange={(event) => { setCollectiveAnswer(event.target.value); setCollectiveMessage('') }} disabled={!collectiveChapterId || !!awakening} autoComplete="off" placeholder="選擇關卡後輸入全班討論出的答案" />
      <button disabled={!collectiveChapterId || !!awakening}>確認共同謎底</button>
      <p aria-live="polite">{collectiveMessage || `目前選擇：${collectiveChapterId ?? '尚未選擇關卡'}`}</p>
    </form>}
    {awakening && <AwakeningOverlay state={awakening} />}
    {chapterPreviewId && (() => {
      const chapter = chapters.find((item) => item.id === chapterPreviewId)!
      return <div className="chapter-lightbox" role="dialog" aria-modal="true" aria-label={`${chapter.id} ${chapter.keyword} 題目`} onMouseDown={(event) => event.target === event.currentTarget && setChapterPreviewId(null)}>
        <section>
          <header><strong>{chapter.id.toUpperCase()}｜{chapter.keyword}</strong><button onClick={() => setChapterPreviewId(null)} aria-label="關閉題目">關閉</button></header>
          <img src={`${import.meta.env.BASE_URL}assets/chapters/chapter-${String(chapter.number).padStart(2, '0')}.png`} alt={`${chapter.id} ${chapter.keyword} 完整題目`} />
        </section>
      </div>
    })()}
  </main>

  return (
    <main className="key-wall">
      <div className="leather-frame" aria-hidden="true" />
      <header className="wall-header">
        <div className="progress-reveal">
          <div className="found-count" aria-label={`已找回 ${completed.size} 把鑰匙，共 20 把`}>
            <span>已找回鑰匙</span><strong>{completed.size}<small>／20把</small></strong>
          </div>
          <span>已完成探索：{exploredRoutes.length}／7組</span>
          <button className="reveal-launch" disabled={!canStartReveal || revealAnimating} onClick={startReveal}>{revealActionLabel}</button>
          {!allCollected && !allRoutesExplored && <small>尚有 {routes.length - exploredRoutes.length} 組未完成</small>}
        </div>
        <div className="title-block">
          <h1>SHUXIN</h1>
          <span>散落的鑰匙，正等待探索者將它們一一找回</span>
        </div>
        <div className="header-actions">
          <button className="music-toggle" aria-pressed={musicEnabled} onClick={() => { const next = !musicEnabled; audioManager.setMusicEnabled(next); setMusicEnabled(next) }}>音樂{musicEnabled ? '開' : '關'}</button>
          <button className="sound-toggle" aria-pressed={audioEnabled} onClick={() => { const next = !audioEnabled; audioManager.setEnabled(next); setAudioEnabled(next) }}>音效{audioEnabled ? '開' : '關'}</button>
          <button className="librarian-entry" onClick={() => setStep('librarian')}>館員模式</button>
        </div>
      </header>

      <section className="keys-grid" aria-label="20 把鑰匙總覽">
        {chapters.map((chapter) => {
          const level = getKeyLevel(groupCounts[chapter.id])
          const resonating = revealAnimating && chapter.number <= revealIndex
          const seals = Math.min(groupCounts[chapter.id], 3)
          return <button key={chapter.id} id={`chapter-${String(chapter.number).padStart(2, '0')}`} disabled={progress.revealState !== 'revealed'} onClick={() => openAbility(chapter.id)} className={`key-card key-level-${level}${resonating ? ' resonating' : ''}${highlightedChapter === chapter.id ? ' answer-highlight' : ''}${progress.revealState === 'revealed' ? ' revealed-key' : ''}`} data-level={level} data-chapter-id={chapter.id} aria-label={`${chapter.id} ${chapter.keyword}，Level ${level}`}>
            <span>{chapter.id.toUpperCase()}</span>
            <KeyImage level={level} alt={`${chapter.keyword} Level ${level} 鑰匙`} />
            <strong>{chapter.keyword}</strong>
            <small className="collection-status">{seals === 0 ? '尚未獲得' : <>{Array.from({ length: seals }, (_, index) => <i key={index} aria-hidden="true" />)}<b>{groupCounts[chapter.id]} 組找回</b></>}</small>
          </button>
        })}
      </section>

      <footer className="wall-footer"><span className="status-dot">能力內容尚未揭曉</span><span>{allCollected ? '20 把鑰匙已全數找回' : allRoutesExplored ? '七組已完成探索，可開始最後的共同解謎' : '完成七組探索或找回20把鑰匙後，即可開始揭曉'}</span></footer>

      <aside className={`entry-dock${dockCollapsed ? ' collapsed' : ''}`} aria-label="謎底登記區">
        <button className="dock-toggle" onClick={() => setDockCollapsed((value) => !value)} aria-label={dockCollapsed ? '展開操作台' : '收合操作台'}>{dockCollapsed ? '展開' : '收合'}</button>
        <div className="group-select-wrap">
          <label htmlFor="current-route">目前組別</label>
          <select id="current-route" disabled={!!awakening} value={selectedRoute?.id ?? ''} onChange={(event) => changeRoute(event.target.value)}>
            <option value="">請選擇組別</option>
            {routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}
          </select>
          <strong>{selectedRoute ? `目前登記：${selectedRoute.name}｜已完成 ${routeProgress}／5` : '請先選擇目前組別'}</strong>
        </div>
        <form className="quick-answer-form" onSubmit={submitAnswer}>
          <label htmlFor="answer">謎底</label>
          <input ref={answerRef} id="answer" className={inputError ? 'answer-error' : ''} disabled={!!awakening} autoComplete="off" value={answer} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} onChange={(event) => { setAnswer(event.target.value); setInputError(false); if (result?.kind !== 'off-route') setResult(null) }} placeholder="輸入答案後按 Enter" />
          <button type={dockCollapsed ? 'button' : 'submit'} onClick={dockCollapsed ? () => setDockCollapsed(false) : undefined} disabled={!dockCollapsed && (!selectedRoute || !!awakening)}>{dockCollapsed ? '輸入謎底' : '確認謎底'}</button>
        </form>
        <div className={`inline-result ${result?.kind ?? ''}`} aria-live="polite">
          {!result && <span>等待輸入謎底</span>}
          {result?.kind === 'first' && result.chapter && <strong>{result.chapter.id}｜{result.chapter.keyword}　鑰匙已找回</strong>}
          {result?.kind === 'duplicate' && <strong className="duplicate-stamp">本組已經找回這把鑰匙</strong>}
          {result?.kind === 'wrong' && <strong>謎底尚未產生共鳴，請再次確認</strong>}
          {result?.kind === 'no-group' && <strong>請先選擇目前組別</strong>}
          {result?.kind === 'off-route' && <strong>等待館員確認是否登記</strong>}
        </div>
      </aside>

      {awakening && <AwakeningOverlay state={awakening} />}
      {result?.kind === 'off-route' && result.chapter && <div className="off-route-overlay" role="dialog" aria-modal="true">
        <section><p>{result.chapter.id}｜{result.chapter.keyword}</p><KeyImage level={getKeyLevel(groupCounts[result.chapter.id])} alt="對應鑰匙" /><h2>答案正確，但不在本組預定路線</h2><div><button onClick={registerOffRoute}>仍要登記</button><button onClick={() => { setResult(null); answerRef.current?.focus() }}>返回</button></div></section>
      </div>}

      {revealAnimating && <FinalRevealOverlay ready={revealReady} revealIndex={revealIndex} onSkip={skipReveal} onContinue={showDirections} />}

      {step && (
        <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeDialog()}>
          <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
            <button className="dialog-close" onClick={closeDialog} aria-label="關閉">×</button>

            {step === 'librarian' && <div className="admin-mode">
              <p>LIBRARIAN ACCESS</p><h2 id="dialog-title">館員模式</h2>
              <section><h3>七組完成進度</h3><div className="admin-routes">{routes.map((route) => <div key={route.id}><strong>{route.name}</strong><span>{route.chapters.filter((id) => (progress.completedByRoute[route.id] ?? []).includes(id)).length}／5</span><button onClick={() => resetRoute(route.id)}>重設此組</button></div>)}</div></section>
              <section><h3>20 關答對組別／手動紀錄</h3><div className="admin-chapters">{chapters.map((chapter) => <details key={chapter.id}><summary><b>{chapter.id}｜{chapter.keyword}</b><span>{(progress.answeredGroupsByChapter[chapter.id] ?? []).length} 組</span></summary><div className="record-grid">{routes.map((route) => <label key={route.id}><input type="checkbox" checked={(progress.completedByRoute[route.id] ?? []).includes(chapter.id)} onChange={() => toggleRecord(route.id, chapter.id)} />{route.name}</label>)}</div><label className="accepted-label">可接受答案（以逗號分隔）<input value={(progress.acceptedAnswersByChapter[chapter.id] ?? []).join('，')} onChange={(event) => setAcceptedAnswers(chapter.id, event.target.value)} /></label></details>)}</div></section>
              <section className="admin-actions"><button disabled={!canStartReveal || progress.revealState === 'revealed'} onClick={startReveal}>開始揭曉</button><button onClick={exportProgress}>匯出進度 JSON</button><button onClick={() => importRef.current?.click()}>匯入進度 JSON</button><input ref={importRef} type="file" accept="application/json,.json" hidden onChange={importProgress} /><button className="danger-admin" onClick={resetAll}>重設整場活動</button><button className="secondary-action" onClick={closeDialog}>返回大屏總覽</button></section>
            </div>}

            {step === 'ability' && abilityChapterId && <>
              <p>{abilityChapterId}</p><h2 id="dialog-title">{chapters.find((chapter) => chapter.id === abilityChapterId)?.keyword}</h2>
              <div className="ability-content"><strong>{abilityByChapter[abilityChapterId].name}</strong><p>{abilityByChapter[abilityChapterId].description}</p></div>
            </>}
          </section>
        </div>
      )}
    </main>
  )
}
