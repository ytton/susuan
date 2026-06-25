import { ChevronLeft, Home, RefreshCcw } from 'lucide-react'
import IconButton from './ui/IconButton.jsx'
import StatPill from './ui/StatPill.jsx'

function ResultRow({ record, formatProblem, formatDuration }) {
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

export default function ResultsView({
  modeTitle,
  records,
  stats,
  totalMs,
  onGoHome,
  onRestart,
  formatProblem,
  formatDuration,
}) {
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
          <StatPill label="平均" value={formatDuration(stats.averageMs)} />
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
              <ResultRow
                key={record.id}
                record={record}
                formatProblem={formatProblem}
                formatDuration={formatDuration}
              />
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
