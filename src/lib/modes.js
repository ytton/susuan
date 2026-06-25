export const STORAGE_SETTINGS = 'gongkao-susuan-settings-v1'
export const STORAGE_SOUND = 'gongkao-susuan-sound-v1'
export const DIGITS = Array.from({ length: 10 }, (_, index) => index)
export const MAX_ANSWER_LENGTH = 6

export const HISTORY_RANGES = [
  { id: 'today', label: '当日' },
  { id: 'day', label: '按天' },
  { id: 'week', label: '按周' },
  { id: 'month', label: '按月' },
]

export const MODES = [
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

export const MODE_MAP = Object.fromEntries(MODES.map((mode) => [mode.id, mode]))

export function getCarryLabel(modeId) {
  if (modeId === 'mix') {
    return '只选进位/退位'
  }

  if (modeId === 'sub' || modeId === 'borrow') {
    return '只选退位'
  }

  return '只选进位'
}

export function getAccentClasses(accent) {
  const accents = {
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-800',
    sky: 'border-sky-200 bg-sky-50 text-sky-800',
  }

  return accents[accent] || accents.sky
}
