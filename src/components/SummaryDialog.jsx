import { ChevronLeft, RefreshCcw } from 'lucide-react'
import StatPill from './ui/StatPill.jsx'

export default function SummaryDialog({
  modeTitle,
  stats,
  totalMs,
  onClose,
  onGoHome,
  onRestart,
  formatDuration,
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
          <StatPill label="用时" value={formatDuration(totalMs)} />
          <StatPill label="平均" value={formatDuration(stats.averageMs)} />
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
