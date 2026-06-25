import {
  Check,
  ChevronLeft,
  Clock3,
  Delete,
  Eraser,
  Keyboard,
  RotateCcw,
  Settings,
  Target,
  Volume2,
  VolumeX,
} from 'lucide-react'
import IconButton from './ui/IconButton.jsx'
import { getShortcutLabel } from '../lib/shortcuts.js'

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

function KeyButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-[70px] rounded-lg border border-zinc-200 bg-white text-2xl font-black text-zinc-950 shadow-sm transition active:scale-[0.98] active:bg-emerald-50 sm:h-[78px]"
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
      className="inline-flex h-[70px] items-center justify-center gap-1 rounded-lg border border-zinc-200 bg-white text-sm font-black text-zinc-800 shadow-sm transition active:scale-[0.98] active:bg-zinc-50 sm:h-[78px]"
    >
      {children}
      <span>{label}</span>
    </button>
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
        className="col-span-2 inline-flex h-[70px] items-center justify-center gap-2 rounded-lg bg-zinc-950 text-lg font-black text-white shadow-sm transition active:scale-[0.98] sm:h-[78px]"
      >
        <Check size={24} />
        确定
      </button>
    </div>
  )
}

export default function PracticeView({
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
  onOpenShortcutMap,
  onRestart,
  onSubmit,
  onToggleDesktopKeypad,
  problem,
  quantity,
  shortcutBindings,
  showDesktopKeypad,
  soundEnabled,
  toggleSound,
  wrongFeedback,
  formatProblem,
  formatLiveDuration,
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
        <div className="hidden items-center gap-2 lg:flex">
          <button
            type="button"
            onClick={onOpenShortcutMap}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-black text-zinc-900 shadow-sm transition active:scale-[0.96] active:bg-zinc-50"
            title="快捷键映射"
          >
            <Keyboard size={18} />
            <span>快捷键</span>
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-black text-zinc-600">
              {getShortcutLabel(shortcutBindings.restart)}
            </span>
          </button>
        </div>
        <IconButton
          label={soundEnabled ? '关闭声音' : '开启声音'}
          onClick={toggleSound}
        >
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
            <Metric
              icon={<Target size={18} />}
              label="进度"
              value={`${currentIndex + 1}/${quantity}`}
            />
            <Metric
              icon={<Clock3 size={18} />}
              label="总时长"
              value={formatLiveDuration(elapsedMs)}
            />
            <Metric
              icon={<Clock3 size={18} />}
              label="本题"
              value={formatLiveDuration(currentElapsedMs)}
            />
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
              答案不对，修正后再提交
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
