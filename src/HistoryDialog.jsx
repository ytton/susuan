import { useMemo } from 'react'
import { CalendarDays, X } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import IconButton from './components/ui/IconButton.jsx'
import StatPill from './components/ui/StatPill.jsx'

const HISTORY_RANGE_LIMITS = {
  today: 30,
  day: 14,
  week: 12,
  month: 12,
}

function pad(value) {
  return String(value).padStart(2, '0')
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

function formatDateLabel(timestamp) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).format(new Date(timestamp))
}

function formatDateKey(timestamp) {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function getISOWeek(date) {
  const target = new Date(date.valueOf())
  const dayNr = (target.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNr + 3)
  const firstThursday = target.valueOf()
  target.setUTCMonth(0, 1)

  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7))
  }

  return 1 + Math.ceil((firstThursday - target) / 604800000)
}

function getWeekKey(timestamp) {
  const localDate = new Date(timestamp)
  const utcDate = new Date(
    Date.UTC(
      localDate.getFullYear(),
      localDate.getMonth(),
      localDate.getDate(),
    ),
  )
  const day = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day)
  return `${utcDate.getUTCFullYear()}-W${pad(getISOWeek(utcDate))}`
}

function getMonthKey(timestamp) {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

function getRangeKey(timestamp, range) {
  if (range === 'week') {
    return getWeekKey(timestamp)
  }

  if (range === 'month') {
    return getMonthKey(timestamp)
  }

  return formatDateKey(timestamp)
}

function getRangeLabel(key, range) {
  if (range === 'month') {
    const [year, month] = key.split('-')
    return `${year}.${month}`
  }

  if (range === 'week') {
    const [year, week] = key.split('-W')
    return `${year} 第${Number(week)}周`
  }

  return key.slice(5).replace('-', '/')
}

function HistoryItem({ mode, session }) {
  const avgPerQuestionMs = session.totalCount
    ? session.totalMs / session.totalCount
    : 0

  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-zinc-950">
            {mode?.title || session.modeTitle}
          </div>
          <div className="text-xs font-semibold text-zinc-500">
            {new Date(session.finishedAt).toLocaleString('zh-CN', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-black text-zinc-950">
            {session.correctCount}/{session.totalCount}
          </div>
          <div className="text-xs font-semibold text-zinc-500">
            {formatDuration(session.totalMs)}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs font-semibold text-zinc-500">
        <span>{session.records?.length || session.totalCount} 题</span>
        <span>平均每题 {formatDuration(avgPerQuestionMs)}</span>
      </div>
    </div>
  )
}

function buildHistoryView(history, range) {
  const sorted = [...history].sort((a, b) => b.finishedAt - a.finishedAt)
  const limit = HISTORY_RANGE_LIMITS[range] || 14
  const bucketsMap = new Map()
  const daysMap = new Map()
  const todayKey = formatDateKey(Date.now())

  if (range === 'today') {
    const todaySessions = [...history]
      .filter((session) => formatDateKey(session.finishedAt) === todayKey)
      .sort((a, b) => a.finishedAt - b.finishedAt)

    const buckets = todaySessions.slice(-limit).map((session, index) => ({
      key: session.id,
      label: `第${index + 1}次`,
      sessions: 1,
      totalMs: session.totalMs || 0,
      totalCount: session.totalCount || 0,
      avgPerQuestionMs: session.totalCount
        ? session.totalMs / session.totalCount
        : 0,
    }))

    const days = todaySessions.length
      ? [
          {
            key: todayKey,
            label: formatDateLabel(Date.now()),
            sessions: [...todaySessions].reverse(),
          },
        ]
      : []

    const totalQuestions = todaySessions.reduce(
      (sum, session) => sum + (session.totalCount || 0),
      0,
    )
    const totalMs = todaySessions.reduce(
      (sum, session) => sum + (session.totalMs || 0),
      0,
    )

    return {
      buckets,
      days,
      totalSessions: todaySessions.length,
      totalQuestions,
      totalMs,
      avgPerQuestionMs: totalQuestions ? totalMs / totalQuestions : 0,
    }
  }

  sorted.forEach((session) => {
    const bucketKey = getRangeKey(session.finishedAt, range)
    if (!bucketsMap.has(bucketKey)) {
      bucketsMap.set(bucketKey, {
        key: bucketKey,
        label: getRangeLabel(bucketKey, range),
        totalMs: 0,
        totalCount: 0,
        sessions: 0,
      })
    }

    const bucket = bucketsMap.get(bucketKey)
    bucket.totalMs += session.totalMs || 0
    bucket.totalCount += session.totalCount || 0
    bucket.sessions += 1

    const dayKey = formatDateKey(session.finishedAt)
    if (!daysMap.has(dayKey)) {
      daysMap.set(dayKey, {
        key: dayKey,
        label: formatDateLabel(session.finishedAt),
        sessions: [],
      })
    }

    daysMap.get(dayKey).sessions.push(session)
  })

  const buckets = Array.from(bucketsMap.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-limit)
    .map((bucket) => ({
      ...bucket,
      avgPerQuestionMs: bucket.totalCount
        ? bucket.totalMs / bucket.totalCount
        : 0,
    }))

  const days = Array.from(daysMap.values())
    .sort((a, b) => b.key.localeCompare(a.key))
    .slice(0, 10)

  const totalQuestions = sorted.reduce(
    (sum, session) => sum + (session.totalCount || 0),
    0,
  )
  const totalMs = sorted.reduce((sum, session) => sum + (session.totalMs || 0), 0)

  return {
    buckets,
    days,
    totalSessions: sorted.length,
    totalQuestions,
    totalMs,
    avgPerQuestionMs: totalQuestions ? totalMs / totalQuestions : 0,
  }
}

function GrowthChart({ buckets, range }) {
  if (!buckets.length) {
    return (
      <div className="mt-4 flex min-h-80 items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50 text-sm font-semibold text-zinc-500">
        先练几次，这里会显示速度趋势
      </div>
    )
  }

  const chartData = buckets.map((bucket) => ({
    label: bucket.label,
    sessions: bucket.sessions,
    avgPerQuestionMs: bucket.avgPerQuestionMs,
    avgPerQuestionText: formatDuration(bucket.avgPerQuestionMs),
  }))

  return (
    <div className="mt-4">
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 16, right: 12, bottom: 12, left: 4 }}
            >
              <CartesianGrid stroke="#e4e4e7" strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#52525b', fontSize: 11, fontWeight: 700 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(value) => formatDuration(value)}
                tick={{ fill: '#71717a', fontSize: 11, fontWeight: 600 }}
                tickLine={false}
                axisLine={false}
                width={68}
              />
              <Tooltip
                cursor={{ stroke: '#10b981', strokeOpacity: 0.18, strokeWidth: 2 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) {
                    return null
                  }

                  const item = payload[0]?.payload

                  return (
                    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-lg">
                      <div className="text-xs font-semibold text-zinc-500">
                        {range === 'today' ? `当日${label}` : label}
                      </div>
                      <div className="mt-1 text-sm font-black text-zinc-950">
                        平均每题 {item.avgPerQuestionText}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-zinc-500">
                        {item.sessions} 次练习
                      </div>
                    </div>
                  )
                }}
              />
              <Line
                type="monotone"
                dataKey="avgPerQuestionMs"
                stroke="#10b981"
                strokeWidth={4}
                dot={{ r: 5, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                activeDot={{ r: 7, fill: '#059669', stroke: '#ffffff', strokeWidth: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export default function HistoryDialog({
  history,
  mode,
  range,
  rangeOptions,
  onClose,
  onRangeChange,
}) {
  const grouped = useMemo(() => buildHistoryView(history, range), [history, range])

  return (
    <div className="fixed inset-0 z-[60] bg-zinc-950/40 p-0 sm:p-4">
      <section className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden bg-[#f6f8fb] shadow-2xl sm:rounded-lg">
        <header className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-zinc-500">{mode?.title}</div>
            <h2 className="text-xl font-black text-zinc-950">
              练习历史与成长曲线
            </h2>
          </div>
          <IconButton label="关闭" onClick={onClose}>
            <X size={21} />
          </IconButton>
        </header>

        <div className="flex-1 overflow-auto p-4">
          <div className="mb-4 grid gap-2 sm:grid-cols-4">
            <StatPill label="总练习" value={grouped.totalSessions} />
            <StatPill label="总题数" value={grouped.totalQuestions} />
            <StatPill
              label="平均每题"
              value={formatDuration(grouped.avgPerQuestionMs)}
            />
            <StatPill label="总用时" value={formatDuration(grouped.totalMs)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="font-black text-zinc-950">速度趋势</div>
                <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1">
                  {rangeOptions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onRangeChange(item.id)}
                      className={`h-9 rounded-md px-4 text-sm font-black ${
                        range === item.id ? 'bg-zinc-950 text-white' : 'text-zinc-600'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <GrowthChart buckets={grouped.buckets} range={range} />
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="font-black text-zinc-950">
                  {range === 'today' ? '当日记录' : '每日记录'}
                </div>
                <div className="text-sm font-semibold text-zinc-500">
                  {grouped.totalSessions} 次练习
                </div>
              </div>
              <div className="space-y-3">
                {grouped.days.length ? (
                  grouped.days.map((day) => (
                    <div
                      key={day.key}
                      className="rounded-lg border border-zinc-200 bg-zinc-50 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 font-black text-zinc-950">
                          <CalendarDays size={18} />
                          {day.label}
                        </div>
                        <div className="text-sm font-semibold text-zinc-500">
                          {day.sessions.length} 次
                        </div>
                      </div>
                      <div className="mt-2 space-y-2">
                        {day.sessions.map((session) => (
                          <HistoryItem key={session.id} mode={mode} session={session} />
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-8 text-center text-sm font-semibold text-zinc-500">
                    还没有历史记录
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </section>
    </div>
  )
}
