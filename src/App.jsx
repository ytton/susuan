import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ResultsView from './components/ResultsView.jsx'
import HomeView from './components/HomeView.jsx'
import PracticeView from './components/PracticeView.jsx'
import SettingsDialog from './components/SettingsDialog.jsx'
import SummaryDialog from './components/SummaryDialog.jsx'
import {
  HISTORY_RANGES,
  DIGITS,
  MAX_ANSWER_LENGTH,
  MODE_MAP,
  MODES,
  STORAGE_SOUND,
  getAccentClasses,
  getCarryLabel,
} from './lib/modes.js'
import {
  buildSessionStats,
  clampQuantity,
  createInitialSettings,
  formatProblem,
  generateProblems,
  sanitizeSettings,
} from './lib/practice.js'
import {
  createEmptyHistoryByMode,
  readAllHistoryFromDb,
  writeModeHistoryToDb,
} from './lib/history.js'
import { formatDuration, formatLiveDuration } from './lib/format.js'
import {
  SOUND_SOURCES,
  createAudioEngine,
  preloadSoundBuffer,
} from './lib/audio.js'
const LazyHistoryDialog = lazy(() => import('./HistoryDialog.jsx'))

function App() {
  const [settingsByMode, setSettingsByMode] = useState(createInitialSettings)
  const [view, setView] = useState('home')
  const [activeModeId, setActiveModeId] = useState(null)
  const [settingsModeId, setSettingsModeId] = useState(null)
  const [problems, setProblems] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [records, setRecords] = useState([])
  const [sessionStartedAt, setSessionStartedAt] = useState(0)
  const [currentStartedAt, setCurrentStartedAt] = useState(0)
  const [now, setNow] = useState(() => performance.now())
  const [lastSession, setLastSession] = useState(null)
  const [practiceHistoryByMode, setPracticeHistoryByMode] =
    useState(createEmptyHistoryByMode)
  const [historyViewRange, setHistoryViewRange] = useState('day')
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [historyModeId, setHistoryModeId] = useState(null)
  const [toast, setToast] = useState('')
  const [showDesktopKeypad, setShowDesktopKeypad] = useState(false)
  const [wrongFeedback, setWrongFeedback] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') {
      return true
    }

    return localStorage.getItem(STORAGE_SOUND) !== 'off'
  })

  const audioEngineRef = useRef(createAudioEngine())

  const activeMode = activeModeId ? MODE_MAP[activeModeId] : null
  const currentProblem = problems[currentIndex]
  const activeSettings = activeModeId ? settingsByMode[activeModeId] : null
  const elapsedMs = view === 'practice' ? now - sessionStartedAt : 0
  const currentElapsedMs = view === 'practice' ? now - currentStartedAt : 0

  const playTone = useCallback(
    (type = 'tap') => {
      if (!soundEnabled || typeof window === 'undefined') {
        return
      }

      try {
        const sound = SOUND_SOURCES[type] || SOUND_SOURCES.tap
        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext

        if (!AudioContextClass) {
          return
        }

        const engine = audioEngineRef.current

        if (!engine.context) {
          engine.context = new AudioContextClass()
        }

        const context = engine.context

        if (context.state === 'suspended') {
          context.resume().catch(() => {})
        }

        const playBuffer = (buffer) => {
          const sourceNode = context.createBufferSource()
          sourceNode.buffer = buffer
          sourceNode.playbackRate.value = sound.rate || 1

          const gainNode = context.createGain()
          gainNode.gain.value = sound.gain

          sourceNode.connect(gainNode)
          gainNode.connect(context.destination)
          sourceNode.start(0)
        }

        preloadSoundBuffer(engine, context, sound)
          .then((buffer) => {
            playBuffer(buffer)
          })
          .catch(() => {
            // Audio feedback is optional and should never interrupt practice.
          })
      } catch {
        // Audio feedback is optional and should never interrupt practice.
      }
    },
    [soundEnabled],
  )

  useEffect(() => {
    if (!soundEnabled || typeof window === 'undefined') {
      return undefined
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext

    if (!AudioContextClass) {
      return undefined
    }

    const engine = audioEngineRef.current

    const warmup = () => {
      if (!engine.context) {
        engine.context = new AudioContextClass()
      }

      const context = engine.context

      if (context.state === 'suspended') {
        context.resume().catch(() => {})
      }

      Object.values(SOUND_SOURCES).forEach((sound) => {
        preloadSoundBuffer(engine, context, sound).catch(() => {})
      })
    }

    window.addEventListener('pointerdown', warmup, { once: true })
    window.addEventListener('keydown', warmup, { once: true })

    return () => {
      window.removeEventListener('pointerdown', warmup)
      window.removeEventListener('keydown', warmup)
    }
  }, [soundEnabled])

  useEffect(() => {
    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settingsByMode))
  }, [settingsByMode])

  useEffect(() => {
    localStorage.setItem(STORAGE_SOUND, soundEnabled ? 'on' : 'off')
  }, [soundEnabled])

  useEffect(() => {
    let cancelled = false

    readAllHistoryFromDb()
      .then((historyByMode) => {
        if (!cancelled) {
          setPracticeHistoryByMode(historyByMode)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setToast('历史记录读取失败')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (view !== 'practice') {
      return undefined
    }

    const timer = window.setInterval(() => {
      setNow(performance.now())
    }, 100)

    return () => window.clearInterval(timer)
  }, [view])

  useEffect(() => {
    if (!toast) {
      return undefined
    }

    const timer = window.setTimeout(() => setToast(''), 2200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const updateModeSettings = useCallback((modeId, patch) => {
    setSettingsByMode((current) => {
      const mode = MODE_MAP[modeId]
      const nextSettings =
        typeof patch === 'function'
          ? patch(current[modeId])
          : { ...current[modeId], ...patch }

      return {
        ...current,
        [modeId]: sanitizeSettings(mode, nextSettings),
      }
    })
  }, [])

  const startPractice = useCallback(
    (modeId) => {
      const settings = settingsByMode[modeId]
      const nextProblems = generateProblems(modeId, settings)

      if (!nextProblems.length) {
        setToast('当前设置没有可用题目')
        setSettingsModeId(modeId)
        return
      }

      const startedAt = performance.now()

      setActiveModeId(modeId)
      setProblems(nextProblems)
      setCurrentIndex(0)
      setAnswer('')
      setRecords([])
      setSessionStartedAt(startedAt)
      setCurrentStartedAt(startedAt)
      setNow(startedAt)
      setWrongFeedback(false)
      setSummaryOpen(false)
      setLastSession(null)
      setView('practice')
    },
    [settingsByMode],
  )

  const restartPractice = useCallback(() => {
    if (!activeModeId) {
      return
    }

    playTone('tap')
    startPractice(activeModeId)
  }, [activeModeId, playTone, startPractice])

  const goHome = useCallback(() => {
    setSummaryOpen(false)
    setShowDesktopKeypad(false)
    setView('home')
  }, [])

  const finishWithRecords = useCallback(
    (nextRecords) => {
      const totalMs = nextRecords.reduce(
        (sum, record) => sum + record.durationMs,
        0,
      )
      const finishedAt = Date.now()
      const nextSession = {
        id: `${activeModeId}-${finishedAt}-${Math.random().toString(36).slice(2)}`,
        modeId: activeModeId,
        modeTitle: MODE_MAP[activeModeId]?.title || '',
        finishedAt,
        totalMs,
        correctCount: nextRecords.filter((record) => record.correct).length,
        totalCount: nextRecords.length,
        records: nextRecords,
      }

      setLastSession({
        modeId: activeModeId,
        modeTitle: MODE_MAP[activeModeId]?.title || '',
        settings: activeSettings,
        records: nextRecords,
        totalMs,
        finishedAt,
      })
      setPracticeHistoryByMode((current) => {
        const nextModeHistory = [nextSession, ...(current[activeModeId] || [])]
        const nextHistoryByMode = {
          ...current,
          [activeModeId]: nextModeHistory,
        }

        writeModeHistoryToDb(activeModeId, nextModeHistory).catch(() => {
          setToast('历史记录保存失败')
        })

        return nextHistoryByMode
      })
      setView('results')
      setSummaryOpen(true)
      setAnswer('')
      setProblems([])
      setCurrentIndex(0)
      setRecords([])
    },
    [activeModeId, activeSettings],
  )

  const submitAnswer = useCallback(
    (value = answer) => {
      if (view !== 'practice' || !currentProblem || value === '') {
        return
      }

      const numericAnswer = Number(value)

      if (!Number.isFinite(numericAnswer)) {
        return
      }

      const finishedAt = performance.now()
      const correct = numericAnswer === currentProblem.answer
      const record = {
        ...currentProblem,
        index: currentIndex + 1,
        userAnswer: value,
        correct,
        durationMs: finishedAt - currentStartedAt,
        settings: activeSettings,
      }
      const nextRecords = [...records, record]

      playTone(correct ? 'ok' : 'error')

      if (!correct && activeSettings?.stayOnWrongAnswer) {
        setWrongFeedback(true)
        return
      }

      if (currentIndex + 1 >= problems.length) {
        finishWithRecords(nextRecords)
        return
      }

      setWrongFeedback(false)
      setRecords(nextRecords)
      setCurrentIndex((index) => index + 1)
      setAnswer('')
      setCurrentStartedAt(finishedAt)
      setNow(finishedAt)
    },
    [
      answer,
      activeSettings,
      currentIndex,
      currentProblem,
      currentStartedAt,
      finishWithRecords,
      playTone,
      problems.length,
      records,
      view,
    ],
  )

  const appendDigit = useCallback(
    (digit) => {
      if (view !== 'practice' || !currentProblem) {
        return
      }

      if (answer.length >= MAX_ANSWER_LENGTH) {
        playTone('error')
        return
      }

      const nextAnswer = `${answer}${digit}`
      playTone('tap')
      setWrongFeedback(false)

      if (
        activeSettings?.autoNextOnCorrect &&
        Number(nextAnswer) === currentProblem.answer
      ) {
        submitAnswer(nextAnswer)
        return
      }

      setAnswer(nextAnswer)
    },
    [activeSettings, answer, currentProblem, playTone, submitAnswer, view],
  )

  const deleteDigit = useCallback(() => {
    if (view !== 'practice') {
      return
    }

    playTone('tap')
    setWrongFeedback(false)
    setAnswer((current) => current.slice(0, -1))
  }, [playTone, view])

  const clearAnswer = useCallback(() => {
    if (view !== 'practice') {
      return
    }

    playTone('tap')
    setWrongFeedback(false)
    setAnswer('')
  }, [playTone, view])

  useEffect(() => {
    if (view !== 'practice' && view !== 'results') {
      return undefined
    }

    const onKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return
      }

      if (event.repeat) {
        return
      }

      if (view === 'practice' && /^\d$/.test(event.key)) {
        event.preventDefault()
        appendDigit(event.key)
        return
      }

      if (view === 'practice' && event.key === 'Backspace') {
        event.preventDefault()
        deleteDigit()
        return
      }

      if (view === 'practice' && (event.key === 'Delete' || event.key === 'Escape')) {
        event.preventDefault()
        clearAnswer()
        return
      }

      if (view === 'practice' && event.key === 'Enter') {
        event.preventDefault()
        submitAnswer()
        return
      }

      if (event.key.toLowerCase() === 'r') {
        event.preventDefault()
        restartPractice()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    appendDigit,
    clearAnswer,
    deleteDigit,
    restartPractice,
    submitAnswer,
    view,
  ])

  const sessionStats = useMemo(() => {
    return buildSessionStats(lastSession)
  }, [lastSession])

  return (
    <main className="min-h-svh bg-[#f6f8fb] text-zinc-950">
      {view === 'home' && (
        <HomeView
          modes={MODES}
          settingsByMode={settingsByMode}
          onOpenSettings={setSettingsModeId}
          onOpenHistory={setHistoryModeId}
          onStart={startPractice}
          getAccentClasses={getAccentClasses}
        />
      )}

      {view === 'practice' && activeMode && currentProblem && (
        <PracticeView
          answer={answer}
          currentElapsedMs={currentElapsedMs}
          currentIndex={currentIndex}
          elapsedMs={elapsedMs}
          mode={activeMode}
          settings={activeSettings}
          onAppendDigit={appendDigit}
          onClear={clearAnswer}
          onDelete={deleteDigit}
          onGoHome={goHome}
          onOpenSettings={() => setSettingsModeId(activeMode.id)}
          onRestart={restartPractice}
          onSubmit={() => submitAnswer()}
          onToggleDesktopKeypad={() =>
            setShowDesktopKeypad((current) => !current)
          }
          problem={currentProblem}
          quantity={problems.length}
          showDesktopKeypad={showDesktopKeypad}
          soundEnabled={soundEnabled}
          toggleSound={() => setSoundEnabled((current) => !current)}
          wrongFeedback={wrongFeedback}
          formatProblem={formatProblem}
          formatLiveDuration={formatLiveDuration}
        />
      )}

      {view === 'results' && lastSession && sessionStats && (
        <ResultsView
          modeTitle={lastSession.modeTitle}
          records={lastSession.records}
          stats={sessionStats}
          totalMs={lastSession.totalMs}
          onGoHome={goHome}
          onRestart={restartPractice}
          formatProblem={formatProblem}
          formatDuration={formatDuration}
        />
      )}

      {settingsModeId && (
        <SettingsDialog
          mode={MODE_MAP[settingsModeId]}
          settings={settingsByMode[settingsModeId]}
          digits={DIGITS}
          onClose={() => setSettingsModeId(null)}
          onStart={() => {
            const modeId = settingsModeId
            setSettingsModeId(null)
            startPractice(modeId)
          }}
          onUpdate={(patch) => updateModeSettings(settingsModeId, patch)}
          clampQuantity={clampQuantity}
          getCarryLabel={getCarryLabel}
        />
      )}

      {summaryOpen && lastSession && sessionStats && (
        <SummaryDialog
          modeTitle={lastSession.modeTitle}
          stats={sessionStats}
          totalMs={lastSession.totalMs}
          onGoHome={goHome}
          onClose={() => setSummaryOpen(false)}
          onRestart={restartPractice}
          formatDuration={formatDuration}
        />
      )}

      {historyModeId && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/40 p-4">
              <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4 text-sm font-semibold text-zinc-600 shadow-xl">
                正在加载历史图表...
              </div>
            </div>
          }
        >
          <LazyHistoryDialog
            history={practiceHistoryByMode[historyModeId] || []}
            mode={MODE_MAP[historyModeId]}
            range={historyViewRange}
            rangeOptions={HISTORY_RANGES}
            onClose={() => setHistoryModeId(null)}
            onRangeChange={setHistoryViewRange}
          />
        </Suspense>
      )}

      {toast && (
        <div className="fixed left-1/2 top-4 z-50 w-[calc(100%-32px)] max-w-sm -translate-x-1/2 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-semibold text-zinc-900 shadow-lg">
          {toast}
        </div>
      )}
    </main>
  )
}

export default App
