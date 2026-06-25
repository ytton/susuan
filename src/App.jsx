import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  ChevronLeft,
  Clock3,
  Delete,
  Eraser,
  Home,
  History,
  Keyboard,
  Minus,
  Play,
  Plus,
  RefreshCcw,
  RotateCcw,
  Settings,
  Target,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'

const STORAGE_SETTINGS = 'gongkao-susuan-settings-v1'
const STORAGE_SOUND = 'gongkao-susuan-sound-v1'
const DIGITS = Array.from({ length: 10 }, (_, index) => index)
const MAX_ANSWER_LENGTH = 6
const HISTORY_DB_NAME = 'gongkao-susuan-db'
const HISTORY_STORE_NAME = 'practice-history'
const HISTORY_RANGES = [
  { id: 'today', label: '当日' },
  { id: 'day', label: '按天' },
  { id: 'week', label: '按周' },
  { id: 'month', label: '按月' },
]
const SOUND_SOURCES = {
  tap: {
    src: '/sounds/keyboard/tap.mp3',
    gain: 2.45,
    rate: 1,
  },
  ok: {
    src: '/sounds/ui/correct.wav',
    gain: 1.35,
  },
  error: {
    src: '/sounds/ui/error.wav',
    gain: 1.7,
  },
}
const LazyHistoryDialog = lazy(() => import('./HistoryDialog.jsx'))

function createAudioEngine() {
  return {
    context: null,
    buffers: {},
    pending: {},
  }
}

function loadSoundBuffer(context, source) {
  return fetch(source)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load audio: ${source}`)
      }

      return response.arrayBuffer()
    })
    .then((buffer) => context.decodeAudioData(buffer))
}

function preloadSoundBuffer(engine, context, sound) {
  if (engine.buffers[sound.src]) {
    return Promise.resolve(engine.buffers[sound.src])
  }

  if (!engine.pending[sound.src]) {
    engine.pending[sound.src] = loadSoundBuffer(context, sound.src)
      .then((buffer) => {
        engine.buffers[sound.src] = buffer
        return buffer
      })
      .finally(() => {
        delete engine.pending[sound.src]
      })
  }

  return engine.pending[sound.src]
}

const MODES = [
  {
    id: 'borrow',
    title: '退位计算',
    expression: '11-19 - 比个位大的数',
    accent: 'emerald',
    defaultOnlyCarry: true,
  },
  {
    id: 'mix',
    title: '2位数加减',
    expression: '2位数 + 2位数 / 2位数 - 2位数',
    accent: 'sky',
    defaultOnlyCarry: false,
  },
  {
    id: 'add',
    title: '2位数加',
    expression: '2位数 + 2位数',
    accent: 'amber',
    defaultOnlyCarry: false,
  },
  {
    id: 'sub',
    title: '2位数减',
    expression: '2位数 - 2位数',
    accent: 'rose',
    defaultOnlyCarry: false,
  },
  {
    id: 'multiply',
    title: '2位数乘1位数',
    expression: '2位数 × 1位数',
    accent: 'cyan',
    defaultOnlyCarry: false,
  },
]

const MODE_MAP = Object.fromEntries(MODES.map((mode) => [mode.id, mode]))

function getDefaultSettings(mode) {
  return {
    quantity: 20,
    blockedDigitsFirst: [],
    blockedDigitsSecond: [],
    onlyCarry: mode.defaultOnlyCarry,
    autoNextOnCorrect: true,
    stayOnWrongAnswer: false,
    showLeadingOne: mode.id === 'borrow',
  }
}

function normalizeDigitList(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(
    new Set(
      value
        .map((digit) => Number(digit))
        .filter((digit) => Number.isInteger(digit) && digit >= 0 && digit <= 9),
    ),
  ).sort((a, b) => a - b)
}

function sanitizeSettings(mode, settings = {}) {
  const defaults = getDefaultSettings(mode)
  const legacyBlockedDigits = normalizeDigitList(settings.blockedDigits)
  const blockedDigitsFirst = normalizeDigitList(settings.blockedDigitsFirst)
  const blockedDigitsSecond = normalizeDigitList(settings.blockedDigitsSecond)

  return {
    quantity: clampQuantity(settings.quantity ?? defaults.quantity),
    blockedDigitsFirst: blockedDigitsFirst.length
      ? blockedDigitsFirst
      : legacyBlockedDigits,
    blockedDigitsSecond: blockedDigitsSecond.length
      ? blockedDigitsSecond
      : legacyBlockedDigits,
    onlyCarry:
      typeof settings.onlyCarry === 'boolean'
        ? settings.onlyCarry
        : defaults.onlyCarry,
    autoNextOnCorrect:
      typeof settings.autoNextOnCorrect === 'boolean'
        ? settings.autoNextOnCorrect
        : defaults.autoNextOnCorrect,
    stayOnWrongAnswer:
      typeof settings.stayOnWrongAnswer === 'boolean'
        ? settings.stayOnWrongAnswer
        : defaults.stayOnWrongAnswer,
    showLeadingOne:
      mode.id === 'borrow'
        ? typeof settings.showLeadingOne === 'boolean'
          ? settings.showLeadingOne
          : defaults.showLeadingOne
        : false,
  }
}

function createInitialSettings() {
  const defaults = Object.fromEntries(
    MODES.map((mode) => [mode.id, getDefaultSettings(mode)]),
  )

  if (typeof window === 'undefined') {
    return defaults
  }

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_SETTINGS) || '{}')
    return Object.fromEntries(
      MODES.map((mode) => [
        mode.id,
        sanitizeSettings(mode, { ...defaults[mode.id], ...stored?.[mode.id] }),
      ]),
    )
  } catch {
    return defaults
  }
}

function createEmptyHistoryByMode() {
  return Object.fromEntries(MODES.map((mode) => [mode.id, []]))
}

function openHistoryDb() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB unavailable'))
      return
    }

    const request = window.indexedDB.open(HISTORY_DB_NAME, 1)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(HISTORY_STORE_NAME)) {
        db.createObjectStore(HISTORY_STORE_NAME, { keyPath: 'modeId' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function readAllHistoryFromDb() {
  return openHistoryDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(HISTORY_STORE_NAME, 'readonly')
        const store = transaction.objectStore(HISTORY_STORE_NAME)
        const request = store.getAll()

        request.onsuccess = () => {
          const historyByMode = createEmptyHistoryByMode()

          for (const item of request.result || []) {
            historyByMode[item.modeId] = Array.isArray(item.sessions)
              ? [...item.sessions].sort((a, b) => b.finishedAt - a.finishedAt)
              : []
          }

          resolve(historyByMode)
          db.close()
        }

        request.onerror = () => {
          reject(request.error)
          db.close()
        }
      }),
  )
}

function writeModeHistoryToDb(modeId, sessions) {
  return openHistoryDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(HISTORY_STORE_NAME, 'readwrite')
        const store = transaction.objectStore(HISTORY_STORE_NAME)
        const request = store.put({ modeId, sessions })

        request.onsuccess = () => {
          resolve()
          db.close()
        }

        request.onerror = () => {
          reject(request.error)
          db.close()
        }
      }),
  )
}

function clampQuantity(value) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return 20
  }

  return Math.min(200, Math.max(1, Math.round(number)))
}

function digitsForOperand(value) {
  return String(Math.abs(value))
    .split('')
    .map((digit) => Number(digit))
}

function createProblem(modeId, left, right, operator) {
  const answer =
    operator === '+'
      ? left + right
      : operator === '-'
        ? left - right
        : left * right

  const hasCarry =
    operator === '+'
      ? (left % 10) + (right % 10) >= 10
      : operator === '-'
        ? left % 10 < right % 10
        : (left % 10) * right >= 10

  return {
    modeId,
    left,
    right,
    operator,
    answer,
    hasCarry,
  }
}

function formatProblem(problem, settings) {
  if (problem.modeId === 'borrow') {
    const left = settings?.showLeadingOne
      ? `${problem.left}`
      : `${problem.left % 10}`
    return `${left} ${problem.operator} ${problem.right}`
  }

  return `${problem.left} ${problem.operator} ${problem.right}`
}

function problemFitsSettings(problem, settings) {
  if (!settings) {
    return true
  }

  const leftDigits = digitsForOperand(problem.left)
  const rightDigits = digitsForOperand(problem.right)

  const firstBlocked = new Set(settings.blockedDigitsFirst || [])
  const secondBlocked = new Set(settings.blockedDigitsSecond || [])

  const firstAllowed = leftDigits.every((digit) => !firstBlocked.has(digit))
  const secondAllowed = rightDigits.every((digit) => !secondBlocked.has(digit))

  if (!firstAllowed || !secondAllowed) {
    return false
  }

  return true
}

function buildCandidatePool(modeId, settings) {
  const pool = []

  const pushIfValid = (problem) => {
    if (!problemFitsSettings(problem, settings)) {
      return
    }

    if (settings.onlyCarry && !problem.hasCarry) {
      return
    }

    pool.push(problem)
  }

  if (modeId === 'borrow') {
    for (let left = 11; left <= 19; left += 1) {
      const ones = left % 10
      for (let right = ones + 1; right <= 9; right += 1) {
        pushIfValid(createProblem(modeId, left, right, '-'))
      }
    }
  }

  if (modeId === 'add' || modeId === 'mix') {
    for (let left = 10; left <= 99; left += 1) {
      for (let right = 10; right <= 99; right += 1) {
        pushIfValid(createProblem(modeId, left, right, '+'))
      }
    }
  }

  if (modeId === 'sub' || modeId === 'mix') {
    for (let left = 10; left <= 99; left += 1) {
      for (let right = 10; right <= left; right += 1) {
        pushIfValid(createProblem(modeId, left, right, '-'))
      }
    }
  }

  if (modeId === 'multiply') {
    for (let left = 10; left <= 99; left += 1) {
      for (let right = 2; right <= 9; right += 1) {
        pushIfValid(createProblem(modeId, left, right, '×'))
      }
    }
  }

  return pool
}

function shuffle(items) {
  const next = [...items]

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }

  return next
}

function generateProblems(modeId, settings) {
  const pool = buildCandidatePool(modeId, settings)

  if (!pool.length) {
    return []
  }

  const shuffled = shuffle(pool)
  return Array.from({ length: settings.quantity }, (_, index) => {
    const source =
      index < shuffled.length
        ? shuffled[index]
        : pool[Math.floor(Math.random() * pool.length)]

    return {
      ...source,
      id: `${modeId}-${Date.now()}-${index}-${Math.random()
        .toString(36)
        .slice(2)}`,
    }
  })
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) {
    return '0.0秒'
  }

  const seconds = Math.max(0, ms / 1000)

  if (seconds < 60) {
    return `${seconds.toFixed(seconds < 10 ? 2 : 1)}秒`
  }

  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60

  return `${minutes}分${rest.toFixed(1).padStart(4, '0')}秒`
}

function formatLiveDuration(ms) {
  const seconds = Math.max(0, ms / 1000)

  if (seconds < 60) {
    return `${seconds.toFixed(1)}秒`
  }

  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)

  return `${minutes}:${String(rest).padStart(2, '0')}`
}

function getCarryLabel(modeId) {
  if (modeId === 'mix') {
    return '只选进位/退位'
  }

  if (modeId === 'sub' || modeId === 'borrow') {
    return '只选退位'
  }

  return '只选进位'
}

function getAccentClasses(accent) {
  const accents = {
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-800',
    sky: 'border-sky-200 bg-sky-50 text-sky-800',
  }

  return accents[accent] || accents.sky
}

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
    if (!lastSession) {
      return null
    }

    const correctCount = lastSession.records.filter((record) => record.correct)
      .length
    const total = lastSession.records.length
    const averageMs = total ? lastSession.totalMs / total : 0

    return {
      correctCount,
      total,
      accuracy: total ? Math.round((correctCount / total) * 100) : 0,
      averageMs,
    }
  }, [lastSession])

  return (
    <main className="min-h-svh bg-[#f6f8fb] text-zinc-950">
      {view === 'home' && (
        <HomeView
          settingsByMode={settingsByMode}
          onOpenSettings={setSettingsModeId}
          onOpenHistory={setHistoryModeId}
          onStart={startPractice}
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
        />
      )}

      {settingsModeId && (
        <SettingsDialog
          mode={MODE_MAP[settingsModeId]}
          settings={settingsByMode[settingsModeId]}
          onClose={() => setSettingsModeId(null)}
          onStart={() => {
            const modeId = settingsModeId
            setSettingsModeId(null)
            startPractice(modeId)
          }}
          onUpdate={(patch) => updateModeSettings(settingsModeId, patch)}
        />
      )}

      {summaryOpen && lastSession && sessionStats && (
        <SummaryDialogCompact
          modeTitle={lastSession.modeTitle}
          stats={sessionStats}
          totalMs={lastSession.totalMs}
          onGoHome={goHome}
          onClose={() => setSummaryOpen(false)}
          onRestart={restartPractice}
        />
      )}

      {historyModeId && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/40 p-4">
              <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4 text-sm font-semibold text-zinc-600 shadow-xl">
                姝ｅ湪鍔犺浇鍘嗗彶鍥捐〃...
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

function HomeView({ settingsByMode, onOpenHistory, onOpenSettings, onStart }) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700">专项训练</p>
          <h1 className="mt-2 text-3xl font-black tracking-normal text-zinc-950 sm:text-5xl">
            公考速算
          </h1>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center sm:w-80">
          <StatPill label="题型" value={MODES.length} />
          <StatPill label="默认" value="20题" />
          <StatPill label="模式" value="快练" />
        </div>
      </header>

      <section className="grid flex-1 gap-3 py-5 sm:grid-cols-2 lg:grid-cols-3">
        {MODES.map((mode) => (
          <ModeCard
            key={mode.id}
            mode={mode}
            settings={settingsByMode[mode.id]}
            onOpenHistory={() => onOpenHistory(mode.id)}
            onOpenSettings={() => onOpenSettings(mode.id)}
            onStart={() => onStart(mode.id)}
          />
        ))}
      </section>
    </div>
  )
}

function StatPill({ label, value }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm">
      <div className="text-xs font-medium text-zinc-500">{label}</div>
      <div className="text-lg font-black text-zinc-950">{value}</div>
    </div>
  )
}

function ModeCard({ mode, settings, onOpenHistory, onOpenSettings, onStart }) {
  const firstBlockedText = settings.blockedDigitsFirst.length
    ? settings.blockedDigitsFirst.join(' ')
    : '无'
  const secondBlockedText = settings.blockedDigitsSecond.length
    ? settings.blockedDigitsSecond.join(' ')
    : '无'

  return (
    <article className="flex min-h-56 flex-col rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-black ${getAccentClasses(
              mode.accent,
            )}`}
          >
            {mode.expression}
          </div>
          <h2 className="mt-4 text-2xl font-black tracking-normal text-zinc-950">
            {mode.title}
          </h2>
        </div>
        <div className="flex gap-2">
          <IconButton label="历史" onClick={onOpenHistory}>
            <History size={20} />
          </IconButton>
          <IconButton label="设置" onClick={onOpenSettings}>
            <Settings size={20} />
          </IconButton>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-2 text-sm">
        <InfoCell label="数量" value={`${settings.quantity}题`} />
        <InfoCell label="筛选" value={settings.onlyCarry ? '开启' : '关闭'} />
        <InfoCell label="免确认" value={settings.autoNextOnCorrect ? '开' : '关'} />
        <InfoCell
          label="错题停留"
          value={settings.stayOnWrongAnswer ? '开' : '关'}
        />
        <InfoCell label="屏蔽" value={`${firstBlockedText} / ${secondBlockedText}`} />
      </dl>

      <button
        type="button"
        onClick={onStart}
        className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 text-base font-black text-white shadow-sm transition active:scale-[0.98]"
      >
        <Play size={20} fill="currentColor" />
        开始
      </button>
    </article>
  )
}

function InfoCell({ label, value }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
      <dt className="text-xs font-medium text-zinc-500">{label}</dt>
      <dd className="mt-0.5 truncate font-black text-zinc-900">{value}</dd>
    </div>
  )
}

function PracticeView({
  answer,
  currentElapsedMs,
  currentIndex,
  elapsedMs,
  mode,
  settings,
  onAppendDigit,
  onClear,
  onDelete,
  onGoHome,
  onOpenSettings,
  onRestart,
  onSubmit,
  onToggleDesktopKeypad,
  problem,
  quantity,
  showDesktopKeypad,
  soundEnabled,
  toggleSound,
  wrongFeedback,
}) {
  const progress = ((currentIndex + 1) / quantity) * 100

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-3 py-3 sm:px-6 lg:px-8">
      <header className="flex items-center gap-2 border-b border-zinc-200 pb-3">
        <IconButton label="回到首页" onClick={onGoHome}>
          <ChevronLeft size={22} />
        </IconButton>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-zinc-500">
            {mode.title}
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-200">
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <IconButton label={soundEnabled ? '关闭声音' : '开启声音'} onClick={toggleSound}>
          {soundEnabled ? <Volume2 size={21} /> : <VolumeX size={21} />}
        </IconButton>
        <IconButton label="屏幕键盘" onClick={onToggleDesktopKeypad}>
          <Keyboard size={21} />
        </IconButton>
        <IconButton label="设置" onClick={onOpenSettings}>
          <Settings size={21} />
        </IconButton>
      </header>

      <section
        className={`grid flex-1 gap-4 py-4 ${
          showDesktopKeypad ? 'lg:grid-cols-[1fr_320px]' : 'lg:grid-cols-1'
        }`}
      >
        <div className="flex min-h-[420px] flex-col justify-center rounded-lg border border-zinc-200 bg-white px-4 py-6 shadow-sm sm:px-8">
          <div className="mx-auto grid w-full max-w-2xl grid-cols-3 gap-2 text-center">
            <Metric icon={<Target size={18} />} label="进度" value={`${currentIndex + 1}/${quantity}`} />
            <Metric icon={<Clock3 size={18} />} label="总时长" value={formatLiveDuration(elapsedMs)} />
            <Metric icon={<Clock3 size={18} />} label="本题" value={formatLiveDuration(currentElapsedMs)} />
          </div>

          <div className="mt-10 text-center">
            <div className="text-[clamp(2.8rem,12vw,7rem)] font-black leading-none tracking-normal text-zinc-950">
              {formatProblem(problem, settings)}
            </div>
            <div className="mt-4 text-3xl font-black text-zinc-400 sm:text-5xl">
              =
            </div>
            <div
              className={`mx-auto mt-4 flex min-h-24 w-full max-w-md items-center justify-center rounded-lg border-2 px-4 text-center text-[clamp(2.8rem,12vw,6rem)] font-black leading-none tracking-normal transition-all ${
                wrongFeedback
                  ? 'animate-[shake_0.26s_ease-in-out] border-rose-500 bg-rose-50 text-rose-700 shadow-[0_0_0_4px_rgba(244,63,94,0.12)]'
                  : 'border-zinc-900 bg-zinc-50 text-zinc-950'
              }`}
            >
              {answer || <span className="text-zinc-300">?</span>}
            </div>
            <div
              className={`mt-3 min-h-6 text-sm font-black transition ${
                wrongFeedback ? 'text-rose-600' : 'text-transparent'
              }`}
            >
              答案不对，继续修正后再提交
            </div>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-2 sm:mx-auto sm:w-full sm:max-w-md">
            <button
              type="button"
              onClick={onRestart}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-black text-zinc-800 shadow-sm transition active:scale-[0.98]"
            >
              <RotateCcw size={18} />
              重开
            </button>
            <button
              type="button"
              onClick={onClear}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-black text-zinc-800 shadow-sm transition active:scale-[0.98]"
            >
              <Eraser size={18} />
              清除
            </button>
            <button
              type="button"
              onClick={onSubmit}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-3 text-sm font-black text-white shadow-sm transition active:scale-[0.98]"
            >
              <Check size={19} />
              确定
            </button>
          </div>
        </div>

        {showDesktopKeypad && (
          <aside className="hidden rounded-lg border border-zinc-200 bg-white p-3 shadow-sm lg:block">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-black text-zinc-950">数字键盘</div>
            <div className="text-sm font-semibold text-zinc-500">
              {showDesktopKeypad ? '显示' : '隐藏'}
            </div>
          </div>
          <ScreenKeypad
            onAppendDigit={onAppendDigit}
            onClear={onClear}
            onDelete={onDelete}
            onRestart={onRestart}
            onSubmit={onSubmit}
          />
        </aside>
        )}
      </section>

      <div className="sticky bottom-0 -mx-3 border-t border-zinc-200 bg-[#f6f8fb]/95 px-3 py-3 backdrop-blur lg:hidden">
        <ScreenKeypad
          onAppendDigit={onAppendDigit}
          onClear={onClear}
          onDelete={onDelete}
          onRestart={onRestart}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  )
}

function Metric({ icon, label, value }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-2 py-2">
      <div className="flex items-center justify-center gap-1 text-xs font-medium text-zinc-500">
        {icon}
        {label}
      </div>
      <div className="mt-1 truncate text-base font-black text-zinc-950 sm:text-lg">
        {value}
      </div>
    </div>
  )
}

function ScreenKeypad({
  onAppendDigit,
  onClear,
  onDelete,
  onRestart,
  onSubmit,
}) {
  return (
    <div className="grid w-full grid-cols-3 gap-2">
      {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((digit) => (
        <KeyButton key={digit} onClick={() => onAppendDigit(String(digit))}>
          {digit}
        </KeyButton>
      ))}
      <CommandButton label="清除" onClick={onClear}>
        <Eraser size={22} />
      </CommandButton>
      <KeyButton onClick={() => onAppendDigit('0')}>0</KeyButton>
      <CommandButton label="退格" onClick={onDelete}>
        <Delete size={23} />
      </CommandButton>
      <CommandButton label="重开" onClick={onRestart}>
        <RotateCcw size={22} />
      </CommandButton>
      <button
        type="button"
        onClick={onSubmit}
        className="col-span-2 inline-flex h-16 items-center justify-center gap-2 rounded-lg bg-zinc-950 text-lg font-black text-white shadow-sm transition active:scale-[0.98] sm:h-[72px]"
      >
        <Check size={24} />
        确定
      </button>
    </div>
  )
}

function KeyButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-16 rounded-lg border border-zinc-200 bg-white text-2xl font-black text-zinc-950 shadow-sm transition active:scale-[0.98] active:bg-emerald-50 sm:h-[72px]"
    >
      {children}
    </button>
  )
}

function CommandButton({ children, label, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-16 items-center justify-center gap-1 rounded-lg border border-zinc-200 bg-white text-sm font-black text-zinc-800 shadow-sm transition active:scale-[0.98] active:bg-zinc-50 sm:h-[72px]"
    >
      {children}
      <span>{label}</span>
    </button>
  )
}

function ResultsView({ modeTitle, records, stats, totalMs, onGoHome, onRestart }) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-5xl flex-col px-4 py-5 sm:px-6 lg:px-8">
      <header className="border-b border-zinc-200 pb-4">
        <div className="flex items-start gap-3">
          <IconButton label="回到首页" onClick={onGoHome}>
            <ChevronLeft size={22} />
          </IconButton>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-emerald-700">{modeTitle}</p>
            <h1 className="mt-2 text-3xl font-black tracking-normal text-zinc-950 sm:text-5xl">
              练习详情
            </h1>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center sm:w-[420px]">
          <StatPill label="正确" value={`${stats.correctCount}/${stats.total}`} />
          <StatPill label="用时" value={formatDuration(totalMs)} />
          <StatPill label="均速" value={formatDuration(stats.averageMs)} />
        </div>
      </header>

      <section className="flex-1 py-4">
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="grid grid-cols-[52px_1fr_84px_84px_82px] gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-3 text-xs font-black text-zinc-500 max-sm:hidden">
            <div>序号</div>
            <div>题目</div>
            <div>作答</div>
            <div>答案</div>
            <div>用时</div>
          </div>
          <div className="divide-y divide-zinc-100">
            {records.map((record) => (
              <ResultRow key={record.id} record={record} />
            ))}
          </div>
        </div>
      </section>

      <footer className="sticky bottom-0 -mx-4 flex gap-2 border-t border-zinc-200 bg-[#f6f8fb]/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:justify-end sm:border-0 sm:bg-transparent sm:px-0">
        <button
          type="button"
          onClick={onGoHome}
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 font-black text-zinc-900 shadow-sm sm:flex-none"
        >
          <Home size={19} />
          首页
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 font-black text-white shadow-sm sm:flex-none"
        >
          <RefreshCcw size={19} />
          再来一次
        </button>
      </footer>
    </div>
  )
}

function ResultRow({ record }) {
  return (
    <div className="grid gap-2 px-3 py-3 text-sm sm:grid-cols-[52px_1fr_84px_84px_82px] sm:items-center">
      <div className="flex items-center justify-between sm:block">
        <span className="font-black text-zinc-400">#{record.index}</span>
        <span
          className={`rounded-md px-2 py-1 text-xs font-black sm:hidden ${
            record.correct
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-rose-50 text-rose-700'
          }`}
        >
          {record.correct ? '正确' : '错误'}
        </span>
      </div>
      <div className="text-xl font-black text-zinc-950">
        {formatProblem(record, record.settings)} =
      </div>
      <div
        className={`font-black ${
          record.correct ? 'text-emerald-700' : 'text-rose-700'
        }`}
      >
        {record.userAnswer}
      </div>
      <div className="font-black text-zinc-950">{record.answer}</div>
      <div className="font-semibold text-zinc-500">
        {formatDuration(record.durationMs)}
      </div>
    </div>
  )
}

function SettingsDialog({ mode, settings, onClose, onStart, onUpdate }) {
  const firstBlockedDigits = new Set(settings.blockedDigitsFirst)
  const secondBlockedDigits = new Set(settings.blockedDigitsSecond)

  const toggleBlockedDigit = (field, digit) => {
    onUpdate((current) => {
      const nextDigits = new Set(current[field])

      if (nextDigits.has(digit)) {
        nextDigits.delete(digit)
      } else {
        nextDigits.add(digit)
      }

      return {
        ...current,
        [field]: Array.from(nextDigits),
      }
    })
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-zinc-950/35 p-0 sm:items-center sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        className="max-h-[92svh] w-full overflow-auto rounded-t-lg border border-zinc-200 bg-white shadow-xl sm:max-w-lg sm:rounded-lg"
      >
        <header className="sticky top-0 flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-zinc-500">{mode.expression}</div>
            <h2 className="text-xl font-black text-zinc-950">{mode.title}</h2>
          </div>
          <IconButton label="关闭" onClick={onClose}>
            <X size={21} />
          </IconButton>
        </header>

        <div className="space-y-5 px-4 py-4">
          <div>
            <SettingLabel>练习数量</SettingLabel>
            <div className="mt-2 grid grid-cols-[52px_1fr_52px] gap-2">
              <button
                type="button"
                onClick={() =>
                  onUpdate({ quantity: clampQuantity(settings.quantity - 5) })
                }
                className="inline-flex h-12 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-900 shadow-sm"
              >
                <Minus size={21} />
              </button>
              <input
                type="number"
                min="1"
                max="200"
                inputMode="numeric"
                value={settings.quantity}
                onChange={(event) =>
                  onUpdate({ quantity: clampQuantity(event.target.value) })
                }
                className="h-12 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-center text-xl font-black text-zinc-950 outline-none focus:border-zinc-500"
              />
              <button
                type="button"
                onClick={() =>
                  onUpdate({ quantity: clampQuantity(settings.quantity + 5) })
                }
                className="inline-flex h-12 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-900 shadow-sm"
              >
                <Plus size={21} />
              </button>
            </div>
          </div>

          <div>
            <SettingLabel>第一项屏蔽数字</SettingLabel>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {DIGITS.map((digit) => {
                const active = firstBlockedDigits.has(digit)

                return (
                  <button
                    type="button"
                    aria-pressed={active}
                    key={digit}
                    onClick={() => toggleBlockedDigit('blockedDigitsFirst', digit)}
                    className={`h-11 rounded-lg border text-lg font-black transition active:scale-[0.98] ${
                      active
                        ? 'border-rose-300 bg-rose-50 text-rose-700'
                        : 'border-zinc-200 bg-white text-zinc-950'
                    }`}
                  >
                    {digit}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <SettingLabel>第二项屏蔽数字</SettingLabel>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {DIGITS.map((digit) => {
                const active = secondBlockedDigits.has(digit)

                return (
                  <button
                    type="button"
                    aria-pressed={active}
                    key={`second-${digit}`}
                    onClick={() => toggleBlockedDigit('blockedDigitsSecond', digit)}
                    className={`h-11 rounded-lg border text-lg font-black transition active:scale-[0.98] ${
                      active
                        ? 'border-rose-300 bg-rose-50 text-rose-700'
                        : 'border-zinc-200 bg-white text-zinc-950'
                    }`}
                  >
                    {digit}
                  </button>
                )
              })}
            </div>
          </div>

          <SettingSwitch
            checked={settings.onlyCarry}
            label={getCarryLabel(mode.id)}
            onChange={() => onUpdate({ onlyCarry: !settings.onlyCarry })}
          />
          {mode.id === 'borrow' && (
            <SettingSwitch
              checked={settings.showLeadingOne}
              label="显示 1"
              onChange={() =>
                onUpdate({ showLeadingOne: !settings.showLeadingOne })
              }
            />
          )}
          <SettingSwitch
            checked={settings.autoNextOnCorrect}
            label="答对免确认"
            onChange={() =>
              onUpdate({ autoNextOnCorrect: !settings.autoNextOnCorrect })
            }
          />
          <SettingSwitch
            checked={settings.stayOnWrongAnswer}
            label="错误不跳过"
            onChange={() =>
              onUpdate({ stayOnWrongAnswer: !settings.stayOnWrongAnswer })
            }
          />
        </div>

        <footer className="sticky bottom-0 grid grid-cols-2 gap-2 border-t border-zinc-200 bg-white px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-lg border border-zinc-200 bg-white font-black text-zinc-900 shadow-sm"
          >
            确定
          </button>
          <button
            type="button"
            onClick={onStart}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-zinc-950 font-black text-white shadow-sm"
          >
            <Play size={19} fill="currentColor" />
            开始
          </button>
        </footer>
      </section>
    </div>
  )
}

function SettingLabel({ children }) {
  return <div className="text-sm font-black text-zinc-700">{children}</div>
}

function SettingSwitch({ checked, label, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-left"
    >
      <span className="font-black text-zinc-900">{label}</span>
      <span
        className={`flex h-7 w-12 items-center rounded-full p-1 transition ${
          checked ? 'bg-emerald-500' : 'bg-zinc-300'
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white shadow-sm transition ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  )
}

function _SummaryDialog({ modeTitle, stats, totalMs, onClose, onRestart }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4">
      <section
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-5 shadow-xl"
      >
        <div className="text-sm font-semibold text-emerald-700">{modeTitle}</div>
        <h2 className="mt-2 text-2xl font-black text-zinc-950">练习完成</h2>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          <StatPill label="正确" value={`${stats.correctCount}/${stats.total}`} />
          <StatPill label="正确率" value={`${stats.accuracy}%`} />
          <StatPill label="用时" value={formatDuration(totalMs)} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-lg border border-zinc-200 bg-white font-black text-zinc-900 shadow-sm"
          >
            确定
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-zinc-950 font-black text-white shadow-sm"
          >
            <RefreshCcw size={19} />
            再来一次
          </button>
        </div>
      </section>
    </div>
  )
}

function SummaryDialogCompact({
  modeTitle,
  stats,
  totalMs,
  onClose,
  onGoHome,
  onRestart,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4">
      <section
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-5 shadow-xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <button
            type="button"
            aria-label="回到首页"
            title="回到首页"
            onClick={onGoHome}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-900 shadow-sm transition active:scale-[0.96] active:bg-zinc-50"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="min-w-0 flex-1 text-right">
            <div className="truncate text-sm font-semibold text-emerald-700">
              {modeTitle}
            </div>
            <h2 className="mt-2 text-2xl font-black text-zinc-950">练习完成</h2>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          <StatPill label="正确" value={`${stats.correctCount}/${stats.total}`} />
          <StatPill label="速度" value={formatDuration(totalMs)} />
          <StatPill label="均速" value={formatDuration(stats.averageMs)} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-lg border border-zinc-200 bg-white font-black text-zinc-900 shadow-sm"
          >
            确定
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-zinc-950 font-black text-white shadow-sm"
          >
            <RefreshCcw size={19} />
            再来一次
          </button>
        </div>
      </section>
    </div>
  )
}

function IconButton({ children, label, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-900 shadow-sm transition active:scale-[0.96] active:bg-zinc-50"
    >
      {children}
    </button>
  )
}

export default App
