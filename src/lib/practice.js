import { MODE_MAP, MODES, STORAGE_SETTINGS } from './modes.js'

export function clampQuantity(value) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return 20
  }

  return Math.min(200, Math.max(1, Math.round(number)))
}

export function getDefaultSettings(mode) {
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

export function sanitizeSettings(mode, settings = {}) {
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

export function createInitialSettings() {
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

export function formatProblem(problem, settings) {
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

  return firstAllowed && secondAllowed
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

export function generateProblems(modeId, settings) {
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

export function buildSessionStats(lastSession) {
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
}

export function getMode(modeId) {
  return MODE_MAP[modeId] || null
}
