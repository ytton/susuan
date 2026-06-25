import { Minus, Play, Plus, X } from 'lucide-react'
import IconButton from './ui/IconButton.jsx'

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

export default function SettingsDialog({
  mode,
  settings,
  digits,
  onClose,
  onStart,
  onUpdate,
  clampQuantity,
  getCarryLabel,
}) {
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
            <div className="text-sm font-semibold text-zinc-500">
              {mode.expression}
            </div>
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
              {digits.map((digit) => {
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
              {digits.map((digit) => {
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
