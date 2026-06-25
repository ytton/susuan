export const STORAGE_SHORTCUTS = 'gongkao-susuan-shortcuts-v1'

export const DEFAULT_SHORTCUT_BINDINGS = {
  restart: 'KeyR',
  delete: 'Backspace',
  submit: 'Enter',
  clear: null,
}

export const SHORTCUT_ACTIONS = [
  {
    id: 'restart',
    label: '重开',
    description: '重新生成当前练习',
    defaultCode: DEFAULT_SHORTCUT_BINDINGS.restart,
  },
  {
    id: 'delete',
    label: '退格',
    description: '删除已输入的最后一位',
    defaultCode: DEFAULT_SHORTCUT_BINDINGS.delete,
  },
  {
    id: 'submit',
    label: '确定',
    description: '提交当前答案',
    defaultCode: DEFAULT_SHORTCUT_BINDINGS.submit,
  },
  {
    id: 'clear',
    label: '清除',
    description: '不设置快捷键',
    defaultCode: null,
    locked: true,
  },
]

const SPECIAL_LABELS = {
  Backspace: 'Backspace',
  Delete: 'Delete',
  Enter: 'Enter',
  Escape: 'Esc',
  Space: 'Space',
  Tab: 'Tab',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
}

function isValidShortcutCode(code) {
  return typeof code === 'string' && code.length > 0
}

function sanitizeShortcutCode(code) {
  if (!isValidShortcutCode(code)) {
    return null
  }

  if (/^Digit\d$/.test(code) || /^Numpad\d$/.test(code)) {
    return null
  }

  return code
}

export function sanitizeShortcutBindings(bindings = {}) {
  const used = new Set()
  const nextBindings = {}

  for (const action of SHORTCUT_ACTIONS) {
    if (action.locked) {
      nextBindings[action.id] = null
      continue
    }

    const requestedCode = sanitizeShortcutCode(bindings[action.id])
    const fallbackCode = sanitizeShortcutCode(action.defaultCode)
    const code =
      requestedCode && !used.has(requestedCode) ? requestedCode : fallbackCode

    nextBindings[action.id] = code

    if (code) {
      used.add(code)
    }
  }

  nextBindings.clear = null
  return nextBindings
}

export function createInitialShortcutBindings() {
  if (typeof window === 'undefined') {
    return DEFAULT_SHORTCUT_BINDINGS
  }

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_SHORTCUTS) || '{}')
    return sanitizeShortcutBindings({
      ...DEFAULT_SHORTCUT_BINDINGS,
      ...stored,
    })
  } catch {
    return DEFAULT_SHORTCUT_BINDINGS
  }
}

export function normalizeShortcutEvent(event) {
  const code = event.code || event.key
  return sanitizeShortcutCode(code)
}

export function isModifierOnlyEvent(event) {
  return ['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)
}

export function isReservedAnswerKey(event) {
  return (
    /^\d$/.test(event.key) ||
    /^Digit\d$/.test(event.code) ||
    /^Numpad\d$/.test(event.code)
  )
}

export function matchesShortcut(event, shortcutCode) {
  if (!shortcutCode) {
    return false
  }

  return normalizeShortcutEvent(event) === shortcutCode
}

export function getShortcutLabel(code) {
  if (!code) {
    return '未设置'
  }

  if (SPECIAL_LABELS[code]) {
    return SPECIAL_LABELS[code]
  }

  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3)
  }

  if (/^Digit\d$/.test(code)) {
    return code.slice(5)
  }

  if (/^Numpad\d$/.test(code)) {
    return `小键盘 ${code.slice(6)}`
  }

  return code
}
