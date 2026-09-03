import { useEffect, useMemo, useRef, useState } from 'react'
import { chapters as defaultChapters } from './data/chapters'
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
import { clearTestStorage, loadTestProgress, loadTestSession, saveTestProgress, saveTestSession, type TestScenario, type TestSession } from './lib/testMode'
import { activeBank, createBuiltinBank, deleteImportedImages, loadBankStore, prepareAnnualBankZip, resolveBankImageUrl, saveBankStore, saveImportedImages, type PreparedAnnualBank } from './lib/annualBanks'
import { loadActivityProgress, resetActivityProgress, saveActivityProgress, type ActivityProgressDocument } from './lib/activityProgress'
import { observeTeacherAuth, signInTeacher, signOutTeacher, type TeacherAuthSnapshot } from './lib/teacherAuth'
import { canUseCloudProgress, loadProgressWithFallback } from './lib/cloudAccess'

type DialogStep = 'librarian' | 'ability'
type ResultKind = 'first' | 'duplicate' | 'off-route' | 'wrong' | 'no-group'
type Result = { kind: ResultKind; chapter?: Chapter }
type MainView = 'wall' | 'collective' | 'directions' | 'abilities'

const normalize = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase('en-US')

function TestModeChrome({ onTools, onRestore, compact = false }: { onTools: () => void; onRestore: () => void; compact?: boolean }) {
  return <aside className={`test-mode-chrome${compact ? ' preview-open' : ''}`} aria-label="流程測試模式">
    <strong>TEST｜測試模式</strong>
    {!compact && <><span>目前為測試模式，不會修改正式活動進度。</span>
      <button onClick={onTools}>返回流程測試</button>
      <button onClick={onRestore}>結束測試並恢復</button></>}
  </aside>
}

export default function App() {
  const initialTestSession = useRef<TestSession | null>(loadTestSession())
  const [isTestMode, setIsTestMode] = useState(() => initialTestSession.current !== null)
  const [testSession, setTestSession] = useState<TestSession | null>(() => initialTestSession.current)
  const [progress, setProgress] = useState<ProgressState>(() => initialTestSession.current ? (loadTestProgress() ?? initialTestSession.current.backupProgress) : loadProgress(''))
  const [bankStore, setBankStore] = useState(() => loadBankStore(createBuiltinBank(defaultChapters, progress.acceptedAnswersByChapter)))
  const bank = activeBank(bankStore)
  const chapters = bank.chapters
  const [step, setStep] = useState<DialogStep | null>(null)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const closeTimer = useRef<number | null>(null)
  const revealTimers = useRef<number[]>([])
  const pendingChapterId = useRef<ChapterId | null>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const annualImportRef = useRef<HTMLInputElement>(null)
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
  const [mainView, setMainView] = useState<MainView>(() => initialTestSession.current?.currentView ?? 'wall')
  const [revealReady, setRevealReady] = useState(false)
  const [collectiveChapterIds, setCollectiveChapterIds] = useState<ChapterId[]>([])
  const [collectiveChapterId, setCollectiveChapterId] = useState<ChapterId | null>(null)
  const [collectiveAnswer, setCollectiveAnswer] = useState('')
  const [collectiveMessage, setCollectiveMessage] = useState('')
  const [chapterPreviewId, setChapterPreviewId] = useState<ChapterId | null>(null)
  const collectiveInputRef = useRef<HTMLInputElement>(null)
  const [testUnresolvedCount, setTestUnresolvedCount] = useState<1 | 3 | 5>(3)
  const [testChapterIds, setTestChapterIds] = useState<ChapterId[]>(['Chapter 18', 'Chapter 19', 'Chapter 20'])
  const [chapterImageUrls, setChapterImageUrls] = useState<Record<number, string>>({})
  const [preparedBank, setPreparedBank] = useState<PreparedAnnualBank | null>(null)
  const [bankError, setBankError] = useState('')
  const [classId, setClassId] = useState('')
  const [classDraft, setClassDraft] = useState(() => localStorage.getItem('shuxin-last-class-id') ?? '701')
  const [sessionReady, setSessionReady] = useState(false)
  const [resumeCandidate, setResumeCandidate] = useState<ActivityProgressDocument | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'local' | 'error'>('idle')
  const [teacherAuth, setTeacherAuth] = useState<TeacherAuthSnapshot>({ status: 'loading', teacher: null, error: null })
  const [authActionPending, setAuthActionPending] = useState(false)
  const [cloudSessionReady, setCloudSessionReady] = useState(false)
  const [uidCopied, setUidCopied] = useState(false)

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

  useEffect(() => observeTeacherAuth((snapshot) => {
    setTeacherAuth(snapshot)
    if (snapshot.status !== 'authorized') setCloudSessionReady(false)
  }), [])
  useEffect(() => {
    if (isTestMode) { saveTestProgress(progress); return }
    saveProgress(progress)
    if (!sessionReady || !classId) return
    const timer = window.setTimeout(async () => {
      const updatedAt = new Date().toISOString()
      const document: ActivityProgressDocument = { version: 1, academicYear: bank.academicYear, classId, progress: { ...progress, updatedAt }, mainView, collectiveChapterIds, revealStarted: revealAnimating || mainView === 'directions' || mainView === 'abilities' || progress.revealState === 'revealed', revealCompleted: progress.revealState === 'revealed', updatedAt }
      localStorage.setItem(`shuxin-class-progress:${bank.academicYear}:${classId}`, JSON.stringify(document))
      if (!canUseCloudProgress(teacherAuth.status, cloudSessionReady, isTestMode)) { setSaveStatus('local'); return }
      setSaveStatus('saving')
      try { await saveActivityProgress(document); setSaveStatus('saved') }
      catch { setSaveStatus('error') }
    }, 700)
    return () => window.clearTimeout(timer)
  }, [isTestMode, progress, sessionReady, classId, bank.academicYear, mainView, collectiveChapterIds, revealAnimating, teacherAuth.status, cloudSessionReady])
  useEffect(() => {
    let disposed = false
    const objectUrls: string[] = []
    Promise.all(bank.chapters.map(async (chapter) => {
      const url = await resolveBankImageUrl(bank, chapter.number)
      if (url.startsWith('blob:')) objectUrls.push(url)
      return [chapter.number, url] as const
    })).then((entries) => { if (!disposed) setChapterImageUrls(Object.fromEntries(entries)) })
    return () => { disposed = true; objectUrls.forEach((url) => URL.revokeObjectURL(url)) }
  }, [bank])
  useEffect(() => {
    if (!isTestMode || !testSession || testSession.currentView === mainView) return
    const nextSession = { ...testSession, currentView: mainView }
    setTestSession(nextSession)
    saveTestSession(nextSession)
  }, [isTestMode, mainView, testSession])
  useEffect(() => {
    if (!initialTestSession.current) return
    initialTestSession.current = null
    if (!window.confirm('上次停留在測試模式。按「確定」繼續測試；按「取消」恢復正式進度。')) {
      const session = loadTestSession()
      clearTestStorage()
      setIsTestMode(false)
      setTestSession(null)
      setProgress(session?.backupProgress ?? loadProgress(''))
      setMainView(session?.backupView ?? 'wall')
      setStep('librarian')
    }
  }, [])
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

  const openClassSession = async () => {
    const nextClassId = classDraft.trim()
    if (!nextClassId) return
    setSaveStatus('idle')
    const loadLocal = () => {
      try { return JSON.parse(localStorage.getItem(`shuxin-class-progress:${bank.academicYear}:${nextClassId}`) ?? 'null') as ActivityProgressDocument | null }
      catch { return null }
    }
    const loaded = await loadProgressWithFallback(
      canUseCloudProgress(teacherAuth.status, true, isTestMode),
      () => loadActivityProgress(bank.academicYear, nextClassId),
      loadLocal,
    )
    setCloudSessionReady(loaded.cloudLoaded)
    if (loaded.cloudError) setSaveStatus('error')
    setClassId(nextClassId)
    localStorage.setItem('shuxin-last-class-id', nextClassId)
    const existing = loaded.value
    if (existing?.version === 1 && existing.progress && Array.isArray(existing.progress.completedChapters)) setResumeCandidate(existing)
    else { setProgress(createInitialProgress('')); setMainView('wall'); setCollectiveChapterIds([]); setSessionReady(true) }
  }

  const continueClassSession = () => {
    if (!resumeCandidate) return
    const validChapterIds = new Set(chapters.map((chapter) => chapter.id))
    const restored = { ...createInitialProgress(''), ...resumeCandidate.progress, completedByRoute: resumeCandidate.progress.completedByRoute ?? {}, answeredGroupsByChapter: resumeCandidate.progress.answeredGroupsByChapter ?? {}, acceptedAnswersByChapter: resumeCandidate.progress.acceptedAnswersByChapter ?? {}, attemptedByRoute: resumeCandidate.progress.attemptedByRoute ?? {}, attemptedInputsByRoute: resumeCandidate.progress.attemptedInputsByRoute ?? {} }
    setProgress({ ...restored, completedChapters: restored.completedChapters.filter((id) => validChapterIds.has(id)), updatedAt: new Date().toISOString() })
    setMainView(resumeCandidate.mainView ?? 'wall')
    setCollectiveChapterIds((resumeCandidate.collectiveChapterIds ?? []).filter((id) => validChapterIds.has(id)))
    setResumeCandidate(null)
    setSessionReady(true)
  }

  const restartCandidate = async () => {
    if (!classId || !window.confirm(`確定要清除 ${classId} 的探索進度嗎？\n此操作會清除本班目前已解鎖的鑰匙與組別進度。`)) return
    try { if (canUseCloudProgress(teacherAuth.status, cloudSessionReady, isTestMode)) await resetActivityProgress(bank.academicYear, classId) } catch { setSaveStatus('error'); return }
    localStorage.removeItem(`shuxin-class-progress:${bank.academicYear}:${classId}`)
    setResumeCandidate(null); setProgress(createInitialProgress('')); setMainView('wall'); setCollectiveChapterIds([]); setSessionReady(true)
  }
  const loginTeacher = async () => {
    setAuthActionPending(true)
    try { await signInTeacher() }
    catch (error) {
      console.error('[SHUXIN Auth] Google sign-in failed', error)
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : 'unknown'
      setTeacherAuth({ status: 'error', teacher: null, error: import.meta.env.DEV ? `Google 登入失敗：${code}` : 'Google 登入失敗或已取消，請再試一次。' })
    }
    finally { setAuthActionPending(false) }
  }

  const logoutTeacher = async () => {
    setAuthActionPending(true)
    try { await signOutTeacher(); setCloudSessionReady(false); setSaveStatus('local') }
    catch { setTeacherAuth((current) => ({ status: 'error', teacher: current.teacher, error: '登出失敗，請再試一次。' })) }
    finally { setAuthActionPending(false) }
  }

  const copyTeacherUid = async () => {
    if (!teacherAuth.teacher) return
    try { await navigator.clipboard.writeText(teacherAuth.teacher.uid); setUidCopied(true); window.setTimeout(() => setUidCopied(false), 1600) }
    catch { setUidCopied(false) }
  }
  const closeDialog = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    closeTimer.current = null
    setStep(null)
  }

  const resolveTestUnsolved = (count: 1 | 3 | 5) => {
    const selected = testChapterIds.slice(0, count)
    if (selected.length === count) return selected
    const defaults = ['Chapter 16', 'Chapter 17', 'Chapter 18', 'Chapter 19', 'Chapter 20'] as ChapterId[]
    return [...new Set([...selected, ...defaults])].slice(-count)
  }

  const createScenarioProgress = (scenario: TestScenario, unresolvedIds: ChapterId[]): ProgressState => {
    const base = createInitialProgress(routes[0]?.id ?? '')
    const exploredCount = scenario === 'waiting' ? 5 : 7
    const unsolved = new Set(scenario === 'waiting' ? chapters.slice(12).map((chapter) => chapter.id) : unresolvedIds)
    const solved = chapters.filter((chapter) => !unsolved.has(chapter.id)).map((chapter) => chapter.id)
    const attemptedByRoute = Object.fromEntries(routes.slice(0, exploredCount).map((route) => [route.id, [...route.chapters]]))
    const answeredGroupsByChapter = Object.fromEntries(solved.map((id) => [id, ['flow-test']]))
    return {
      ...base,
      completedChapters: solved,
      answeredGroupsByChapter,
      attemptedByRoute,
      attemptedInputsByRoute: Object.fromEntries(routes.slice(0, exploredCount).map((route) => [route.id, route.chapters.map((id) => `test-${id}`)])),
      revealState: scenario === 'directions' ? 'revealed' : 'locked',
      updatedAt: new Date().toISOString(),
    }
  }

  const applyTestScenario = (scenario: TestScenario) => {
    const count = scenario === 'last' ? 1 : testUnresolvedCount
    const unresolved = scenario === 'reveal' || scenario === 'directions' ? [] : scenario === 'waiting' ? chapters.slice(12).map((chapter) => chapter.id) : resolveTestUnsolved(count)
    const nextProgress = createScenarioProgress(scenario, unresolved)
    const session = testSession ?? {
      version: 1 as const,
      backupProgress: progress,
      backupView: mainView,
      currentView: scenario === 'directions' ? 'directions' : 'wall',
      scenario,
      unresolvedChapterIds: unresolved,
      startedAt: new Date().toISOString(),
    }
    const nextSession = { ...session, scenario, unresolvedChapterIds: unresolved, currentView: scenario === 'directions' ? 'directions' as const : 'wall' as const }
    setTestSession(nextSession)
    saveTestSession(nextSession)
    saveTestProgress(nextProgress)
    setIsTestMode(true)
    setProgress(nextProgress)
    setStep(null)
    setCollectiveChapterIds([])
    setCollectiveChapterId(null)
    setMainView(scenario === 'directions' ? 'directions' : 'wall')
  }

  const finishTestMode = () => {
    const backup = testSession?.backupProgress ?? loadTestSession()?.backupProgress ?? loadProgress('')
    clearRevealTimers()
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    closeTimer.current = null
    audioManager.finishRevealMusic()
    audioManager.restoreMusic()
    clearTestStorage()
    setIsTestMode(false)
    setTestSession(null)
    setProgress(backup)
    setRevealAnimating(false)
    setRevealReady(false)
    setAwakening(null)
    setResult(null)
    setChapterPreviewId(null)
    setMainView(testSession?.backupView ?? 'wall')
    setStep('librarian')
  }

  const returnToTestTools = () => {
    clearRevealTimers()
    setRevealAnimating(false)
    setRevealReady(false)
    audioManager.finishRevealMusic()
    setMainView('wall')
    setStep('librarian')
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
    const chapter = chapters.find((item) => [item.answer, ...item.acceptedAnswers].some((candidate) => normalize(candidate) === normalize(answer)))
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

  const resetAll = async () => {
    if (!window.confirm('第一次確認：確定要重設整場活動嗎？')) return
    if (!window.confirm('第二次確認：所有進度、答案設定與揭曉狀態都會清除。')) return
    try { if (classId && canUseCloudProgress(teacherAuth.status, cloudSessionReady, isTestMode)) await resetActivityProgress(bank.academicYear, classId) } catch { setSaveStatus('error'); return }
    localStorage.removeItem(`shuxin-class-progress:${bank.academicYear}:${classId}`)
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
    const nextBanks = bankStore.banks.map((item) => item.id === bank.id ? { ...item, chapters: item.chapters.map((chapter) => chapter.id === chapterId ? { ...chapter, acceptedAnswers: answers } : chapter) } : item)
    const nextStore = { ...bankStore, banks: nextBanks }
    setBankStore(nextStore)
    saveBankStore(nextStore)
  }

  const importAnnualBank = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setBankError('')
    setPreparedBank(null)
    try { setPreparedBank(await prepareAnnualBankZip(file, bank)) }
    catch (error) { setBankError(error instanceof Error ? error.message : '年度包驗證失敗') }
    event.target.value = ''
  }

  const activatePreparedBank = async () => {
    if (!preparedBank) return
    try {
      await saveImportedImages(preparedBank.bank.id, preparedBank.images)
      const banks = [...bankStore.banks.filter((item) => item.id !== preparedBank.bank.id), preparedBank.bank]
      const nextStore = { ...bankStore, previousActiveBankId: bankStore.activeBankId, activeBankId: preparedBank.bank.id, banks }
      saveBankStore(nextStore)
      setBankStore(nextStore)
      setPreparedBank(null)
      setBankError('')
    } catch { setBankError('圖片儲存失敗，年度包未啟用') }
  }

  const switchAnnualBank = (bankId: string) => {
    if (bankId === bankStore.activeBankId) return
    const nextStore = { ...bankStore, previousActiveBankId: bankStore.activeBankId, activeBankId: bankId }
    saveBankStore(nextStore)
    setBankStore(nextStore)
  }

  const restorePreviousBank = () => {
    const previous = bankStore.previousActiveBankId
    if (!previous || !bankStore.banks.some((item) => item.id === previous)) return
    const nextStore = { ...bankStore, activeBankId: previous, previousActiveBankId: bankStore.activeBankId }
    saveBankStore(nextStore)
    setBankStore(nextStore)
  }

  const removeAnnualBank = async (bankId: string) => {
    const target = bankStore.banks.find((item) => item.id === bankId)
    if (!target || target.source !== 'imported' || bankId === bankStore.activeBankId) return
    if (!window.confirm(`確定刪除「${target.academicYear}｜${target.name}」？`)) return
    await deleteImportedImages(bankId)
    const nextStore = { ...bankStore, previousActiveBankId: bankStore.previousActiveBankId === bankId ? null : bankStore.previousActiveBankId, banks: bankStore.banks.filter((item) => item.id !== bankId) }
    saveBankStore(nextStore)
    setBankStore(nextStore)
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
    const correct = [chapter.answer, ...chapter.acceptedAnswers].some((candidate) => normalize(candidate) === normalize(collectiveAnswer))
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

  if (!sessionReady || resumeCandidate) return <main className="class-session-page"><section className="class-session-card">
    <p>SHUXIN CLASS SESSION</p><h1>{bank.academicYear}｜班級探索進度</h1>
    {!resumeCandidate ? <><label>班級<input value={classDraft} onChange={(event) => setClassDraft(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void openClassSession()} placeholder="例如 701" autoFocus /></label><button onClick={() => void openClassSession()}>檢查班級進度</button>{saveStatus === 'error' && <small className="save-error">無法連線 Firestore；請確認 Firebase 設定與網路連線。</small>}</> : <>
      <div className="resume-summary"><strong>{classId} {resumeCandidate.progress.completedChapters.length >= chapters.length ? '已完成本次探索' : `上次探索進度：${resumeCandidate.progress.completedChapters.length} / ${chapters.length}`}</strong><span>最後更新：{new Date(resumeCandidate.updatedAt).toLocaleString('zh-TW')}</span></div>
      <button onClick={continueClassSession}>{resumeCandidate.progress.completedChapters.length >= chapters.length ? '查看完成狀態' : '繼續上次進度'}</button><button className="secondary-action" onClick={() => void restartCandidate()}>重新開始</button>
    </>}
  </section></main>
  if (mainView === 'directions') return <><CapabilityDirections onFinish={() => setMainView('abilities')} />{isTestMode && <TestModeChrome onTools={returnToTestTools} onRestore={finishTestMode} />}</>
  if (mainView === 'abilities') return <><AbilitiesOverview onBack={() => setMainView('wall')} />{isTestMode && <TestModeChrome onTools={returnToTestTools} onRestore={finishTestMode} />}</>

  if (mainView === 'collective') return <><main className="collective-page">
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
          <img src={chapterImageUrls[chapter.number]} alt={`${chapter.id} ${chapter.keyword} 完整題目`} />
        </section>
      </div>
    })()}
  </main>{isTestMode && <TestModeChrome compact={!!chapterPreviewId} onTools={returnToTestTools} onRestore={finishTestMode} />}</>

  return (
    <main className="key-wall">
      <div className="leather-frame" aria-hidden="true" />
      {isTestMode && <TestModeChrome onTools={returnToTestTools} onRestore={finishTestMode} />}
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
        <div className="header-actions"><span className={`save-indicator ${saveStatus}`}>{saveStatus === 'saving' ? '正在儲存…' : saveStatus === 'saved' ? `✓ ${classId} 雲端進度已儲存` : saveStatus === 'local' ? `${classId} 僅儲存於本機` : saveStatus === 'error' ? '雲端進度儲存失敗，本機進度仍保留' : `${bank.academicYear}｜${classId}`}</span>
          <button className="class-switch" onClick={() => { setSessionReady(false); setClassId(''); setCloudSessionReady(false); setSaveStatus('idle') }}>切換班級</button><button className="music-toggle" aria-pressed={musicEnabled} onClick={() => { const next = !musicEnabled; audioManager.setMusicEnabled(next); setMusicEnabled(next) }}>音樂{musicEnabled ? '開' : '關'}</button>
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
              <section className={`teacher-auth-panel auth-${teacherAuth.status}`}>
                <h3>館員 Google 登入</h3>
                {teacherAuth.status === 'loading' && <p>正在恢復登入狀態…</p>}
                {teacherAuth.status === 'signed-out' && <><p>登入已授權的教師帳號，才能使用跨裝置班級進度。</p><button disabled={authActionPending} onClick={() => void loginTeacher()}>{authActionPending ? '登入中…' : '使用 Google 登入'}</button></>}
                {teacherAuth.status === 'checking' && <p>Google 登入成功，正在確認 SHUXIN 館員權限…</p>}
                {teacherAuth.teacher && <div className="teacher-identity">{teacherAuth.teacher.photoURL && <img src={teacherAuth.teacher.photoURL} alt="教師帳號頭像" referrerPolicy="no-referrer" />}<div><strong>{teacherAuth.teacher.displayName ?? 'Google 教師帳號'}</strong><span>{teacherAuth.teacher.email ?? '未提供電子郵件'}</span></div></div>}
                {teacherAuth.status === 'authorized' && <><p className="auth-success">館員權限已確認。跨裝置班級進度可用。</p>{!cloudSessionReady && classId && <p className="auth-guidance">請切換並重新開啟目前班級，以安全載入雲端進度後再啟用自動儲存。</p>}<button disabled={authActionPending} onClick={() => void logoutTeacher()}>登出</button></>}
                {teacherAuth.status === 'unauthorized' && <><p className="auth-warning">Google 登入成功，但此帳號尚未取得 SHUXIN 館員權限。</p><div className="teacher-uid"><span>UID</span><code>{teacherAuth.teacher.uid}</code><button onClick={() => void copyTeacherUid()}>{uidCopied ? '已複製' : '複製 UID'}</button></div><button disabled={authActionPending} onClick={() => void logoutTeacher()}>登出</button></>}
                {teacherAuth.status === 'error' && <><p className="auth-warning">{teacherAuth.error}</p>{teacherAuth.teacher && <div className="teacher-uid"><span>UID</span><code>{teacherAuth.teacher.uid}</code><button onClick={() => void copyTeacherUid()}>{uidCopied ? '已複製' : '複製 UID'}</button></div>}<button disabled={authActionPending} onClick={() => teacherAuth.teacher ? void logoutTeacher() : void loginTeacher()}>{teacherAuth.teacher ? '登出' : '重新登入'}</button></>}
              </section>
              <section className="flow-test-panel">
                <h3>流程測試</h3>
                <p className="test-safety-note">{isTestMode ? '目前為測試模式，不會修改正式活動進度。' : '選擇情境後將進入測試模式；正式活動進度會完整保留。'}</p>
                <div className="test-scenario-grid">
                  <button onClick={() => applyTestScenario('waiting')}>測試等待狀態<small>5／7組完成，部分鑰匙已找回</small></button>
                  <button onClick={() => applyTestScenario('unresolved')}>測試未解關卡<small>7／7組完成，保留指定未解關卡</small></button>
                  <button onClick={() => applyTestScenario('last')}>測試最後一關<small>19／20把鑰匙已找回</small></button>
                  <button onClick={() => applyTestScenario('reveal')}>測試完整揭曉<small>20／20把鑰匙已找回</small></button>
                  <button onClick={() => applyTestScenario('directions')}>測試關鍵力展示<small>從「看見更多」開始</small></button>
                </div>
                <fieldset className="test-unresolved-options">
                  <legend>未解關卡設定</legend>
                  <div className="test-count-options">{([1, 3, 5] as const).map((count) => <label key={count}><input type="radio" name="test-unresolved-count" checked={testUnresolvedCount === count} onChange={() => setTestUnresolvedCount(count)} />未解 {count} 關{count === 3 ? '（預設）' : ''}</label>)}</div>
                  <div className="test-chapter-picker">{chapters.map((chapter) => <label key={chapter.id}><input type="checkbox" checked={testChapterIds.includes(chapter.id)} onChange={() => setTestChapterIds((current) => current.includes(chapter.id) ? current.filter((id) => id !== chapter.id) : [...current, chapter.id])} />{chapter.id.replace('Chapter ', '')}</label>)}</div>
                  <small>勾選時優先使用指定 Chapter；不足時以固定關卡補足，不會隨機變動。</small>
                </fieldset>
                {isTestMode && <div className="test-active-actions"><strong>目前情境：{testSession?.scenario ?? '測試中'}</strong><button onClick={() => applyTestScenario(testSession?.scenario ?? 'unresolved')}>重新套用目前情境</button><button className="test-restore" onClick={finishTestMode}>結束測試並恢復</button></div>}
              </section>
              <section className="class-progress-panel"><h3>班級探索進度</h3><div className="admin-routes"><div><strong>{classId}</strong><span>{completed.size}／{chapters.length}</span><button onClick={() => { closeDialog(); setSessionReady(false); setClassId('') }}>切換班級</button></div></div><small>{bank.academicYear}｜{saveStatus === 'saved' ? '雲端已儲存' : saveStatus === 'error' ? '雲端失敗，本機已保留' : saveStatus === 'local' ? '僅本機續存' : '目前活動'}</small></section><section><h3>七組完成進度</h3><div className="admin-routes">{routes.map((route) => <div key={route.id}><strong>{route.name}</strong><span>{route.chapters.filter((id) => (progress.completedByRoute[route.id] ?? []).includes(id)).length}／5</span><button onClick={() => resetRoute(route.id)}>重設此組</button></div>)}</div></section>
              <section className="annual-bank-panel"><h3>年度題庫管理</h3>
                <div className="annual-bank-toolbar"><label>目前啟用題庫<select value={bankStore.activeBankId} onChange={(event) => switchAnnualBank(event.target.value)}>{bankStore.banks.map((item) => <option key={item.id} value={item.id}>{item.academicYear}｜{item.name}{item.id === bankStore.activeBankId ? '（啟用中）' : ''}</option>)}</select></label><button disabled={!bankStore.previousActiveBankId} onClick={restorePreviousBank}>恢復上一版</button><button onClick={() => annualImportRef.current?.click()}>匯入年度題庫 ZIP</button><input ref={annualImportRef} type="file" accept=".zip,application/zip" hidden onChange={importAnnualBank} /></div>
                <p>目前啟用：<strong>{bank.academicYear}｜{bank.name}</strong>，共 {bank.chapters.length} 關。</p>
                <div className="annual-bank-list">{bankStore.banks.map((item) => <div key={item.id}><span>{item.academicYear}｜{item.name}</span><small>{item.id === bankStore.activeBankId ? '啟用中' : '未啟用'}</small>{item.source === 'imported' && item.id !== bankStore.activeBankId && <button onClick={() => removeAnnualBank(item.id)}>刪除此題庫</button>}</div>)}</div>
                {bankError && <p className="annual-bank-error" role="alert">驗證失敗：{bankError}。未匯入任何資料。</p>}
                {preparedBank && <div className="annual-bank-preview"><h4>匯入驗證通過：{preparedBank.bank.academicYear}</h4><p>20關與20張圖片完整。與目前題庫相比，共 {preparedBank.differences.length} 關有差異。</p>{preparedBank.differences.length > 0 && <ul>{preparedBank.differences.map((difference) => <li key={difference.chapterId}>{difference.chapterId}：{difference.fields.join('、')}</li>)}</ul>}<div><button onClick={activatePreparedBank}>確認匯入並啟用</button><button className="secondary-action" onClick={() => setPreparedBank(null)}>取消</button></div></div>}
                <div className="annual-bank-chapters">{bank.chapters.map((chapter) => <details key={chapter.id}><summary><b>{chapter.id}｜{chapter.keyword}</b><span>{chapter.answer}</span></summary><div><img src={chapterImageUrls[chapter.number]} alt={`${chapter.id} ${chapter.keyword} 題目預覽`} /><p><strong>正式答案：</strong>{chapter.answer}</p><label>可接受答案<input value={chapter.acceptedAnswers.join('，')} onChange={(event) => setAcceptedAnswers(chapter.id, event.target.value)} /></label><small>{chapter.imageFile}</small></div></details>)}</div>
              </section>
              <section><h3>20 關答對組別／手動紀錄</h3><div className="admin-chapters">{chapters.map((chapter) => <details key={chapter.id}><summary><b>{chapter.id}｜{chapter.keyword}</b><span>{(progress.answeredGroupsByChapter[chapter.id] ?? []).length} 組</span></summary><div className="record-grid">{routes.map((route) => <label key={route.id}><input type="checkbox" checked={(progress.completedByRoute[route.id] ?? []).includes(chapter.id)} onChange={() => toggleRecord(route.id, chapter.id)} />{route.name}</label>)}</div></details>)}</div></section>
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
