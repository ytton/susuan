import { History, Play, Settings } from 'lucide-react'
import IconButton from './ui/IconButton.jsx'
import StatPill from './ui/StatPill.jsx'

function InfoCell({ label, value }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
      <dt className="text-xs font-medium text-zinc-500">{label}</dt>
      <dd className="mt-0.5 truncate font-black text-zinc-900">{value}</dd>
    </div>
  )
}

function ModeCard({
  mode,
  settings,
  onOpenHistory,
  onOpenSettings,
  onStart,
  getAccentClasses,
}) {
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
        <InfoCell label="进退位" value={settings.onlyCarry ? '开启' : '关闭'} />
        <InfoCell
          label="免确认"
          value={settings.autoNextOnCorrect ? '开启' : '关闭'}
        />
        <InfoCell
          label="错题停留"
          value={settings.stayOnWrongAnswer ? '开启' : '关闭'}
        />
        <InfoCell
          label="屏蔽项"
          value={`${firstBlockedText} / ${secondBlockedText}`}
        />
        {mode.id === 'borrow' && (
          <InfoCell
            label="显示 1"
            value={settings.showLeadingOne ? '开启' : '关闭'}
          />
        )}
      </dl>

      <button
        type="button"
        onClick={onStart}
        className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 text-base font-black text-white shadow-sm transition active:scale-[0.98]"
      >
        <Play size={20} fill="currentColor" />
        开始练习
      </button>
    </article>
  )
}

export default function HomeView({
  modes,
  settingsByMode,
  onOpenHistory,
  onOpenSettings,
  onStart,
  getAccentClasses,
}) {
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
          <StatPill label="题型" value={modes.length} />
          <StatPill label="默认" value="20题" />
          <StatPill label="模式" value="快练" />
        </div>
      </header>

      <section className="grid flex-1 gap-3 py-5 sm:grid-cols-2 lg:grid-cols-3">
        {modes.map((mode) => (
          <ModeCard
            key={mode.id}
            mode={mode}
            settings={settingsByMode[mode.id]}
            onOpenHistory={() => onOpenHistory(mode.id)}
            onOpenSettings={() => onOpenSettings(mode.id)}
            onStart={() => onStart(mode.id)}
            getAccentClasses={getAccentClasses}
          />
        ))}
      </section>
    </div>
  )
}
