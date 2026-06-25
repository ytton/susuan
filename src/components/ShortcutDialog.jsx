import { Check, Eraser, Keyboard, RotateCcw, Undo2, X } from 'lucide-react'
import IconButton from './ui/IconButton.jsx'
import {
  SHORTCUT_ACTIONS,
  getShortcutLabel,
} from '../lib/shortcuts.js'

const ACTION_ICONS = {
  restart: RotateCcw,
  delete: Undo2,
  submit: Check,
  clear: Eraser,
}

function ShortcutRow({
  action,
  captureActionId,
  bindings,
  onStartCapture,
}) {
  const Icon = ACTION_ICONS[action.id] || Keyboard
  const currentLabel = action.locked
    ? '不设置快捷键'
    : getShortcutLabel(bindings[action.id])
  const capturing = captureActionId === action.id

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-900 shadow-sm">
              <Icon size={18} />
            </span>
            <div>
              <div className="font-black text-zinc-950">{action.label}</div>
              <div className="text-sm font-semibold text-zinc-500">
                {action.description}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="min-w-[88px] rounded-lg border border-zinc-200 bg-white px-3 py-2 text-center text-sm font-black text-zinc-950 shadow-sm">
            {capturing ? '按下按键...' : currentLabel}
          </div>
          {!action.locked && (
            <button
              type="button"
              onClick={() => onStartCapture(action.id)}
              className={`h-10 rounded-lg px-3 text-sm font-black shadow-sm transition ${
                capturing
                  ? 'bg-emerald-500 text-white'
                  : 'border border-zinc-200 bg-white text-zinc-900'
              }`}
            >
              {capturing ? '录入中' : '重新设置'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ShortcutDialog({
  bindings,
  captureActionId,
  onClose,
  onResetDefaults,
  onStartCapture,
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-zinc-950/40 p-0 sm:items-center sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        className="w-full max-w-2xl rounded-t-lg border border-zinc-200 bg-white shadow-xl sm:rounded-lg"
      >
        <header className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-zinc-500">仅桌面端生效</div>
            <h2 className="text-xl font-black text-zinc-950">快捷键映射</h2>
          </div>
          <IconButton label="关闭" onClick={onClose}>
            <X size={21} />
          </IconButton>
        </header>

        <div className="space-y-4 px-4 py-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
            数字键保留给答题输入。开始录入后，按下一个非数字键即可完成设置，按
            <span className="mx-1 rounded bg-white px-1.5 py-0.5 font-black text-zinc-950">
              Esc
            </span>
            可取消当前录入。
          </div>

          <div className="space-y-3">
            {SHORTCUT_ACTIONS.map((action) => (
              <ShortcutRow
                key={action.id}
                action={action}
                bindings={bindings}
                captureActionId={captureActionId}
                onStartCapture={onStartCapture}
              />
            ))}
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-zinc-200 px-4 py-3">
          <button
            type="button"
            onClick={onResetDefaults}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-black text-zinc-900 shadow-sm"
          >
            恢复默认
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-950 px-5 text-sm font-black text-white shadow-sm"
          >
            完成
          </button>
        </footer>
      </section>
    </div>
  )
}
