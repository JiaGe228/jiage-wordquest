import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { BookOpenText, Flame, Gem, RefreshCcw, RotateCcw, Settings } from 'lucide-react'
import { UNITS, LEVELS_PER_UNIT } from '@/data/words'
import { useGame, xpLevel } from '@/lib/store'
import { sfx } from '@/lib/sfx'
import { StatPill, MascotHint } from '@/components/common'

/** 每个单元的蛇形路径坐标（viewBox 360×400） */
function pathPoints() {
  return [
    { x: 180, y: 70 },
    { x: 78, y: 200 },
    { x: 282, y: 330 },
  ]
}

function edgePath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const my = (a.y + b.y) / 2
  return `M ${a.x} ${a.y} C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`
}

function NameDialog({ onDone }: { onDone: (name: string) => void }) {
  const [name, setName] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#131f24]/80 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
        <div className="mb-2 text-7xl">🦉</div>
        <h2 className="mb-1 text-2xl font-black text-slate-800">欢迎来到迦哥闯天下！</h2>
        <p className="mb-6 text-sm font-bold text-slate-400">我是猫头鹰奥利，告诉我你的名字吧</p>
        <input
          autoFocus
          value={name}
          maxLength={12}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && onDone(name.trim())}
          placeholder="输入你的名字"
          className="mb-6 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-center text-lg font-extrabold text-slate-700 outline-none transition focus:border-[#84d8ff]"
        />
        <button
          onClick={() => name.trim() && onDone(name.trim())}
          disabled={!name.trim()}
          className="w-full rounded-2xl bg-[#58cc02] py-3.5 text-lg font-black uppercase tracking-wide text-white shadow-[0_4px_0_#46a302] transition enabled:hover:brightness-105 disabled:opacity-40"
        >
          开始冒险！
        </button>
      </div>
    </div>
  )
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { setName, resetAll, state } = useGame()
  const [name, setNameInput] = useState(state.name)
  const [confirmReset, setConfirmReset] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#131f24]/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-xl font-black text-slate-800">设置</h3>
        <label className="mb-1 block text-sm font-bold text-slate-500">孩子的名字</label>
        <div className="mb-4 flex gap-2">
          <input
            value={name}
            maxLength={12}
            onChange={(e) => setNameInput(e.target.value)}
            className="w-full rounded-xl border-2 border-slate-200 px-3 py-2 font-bold text-slate-700 outline-none focus:border-[#84d8ff]"
          />
          <button
            onClick={() => name.trim() && setName(name.trim())}
            className="shrink-0 rounded-xl bg-[#1cb0f6] px-4 py-2 text-sm font-black text-white shadow-[0_3px_0_#1899d6]"
          >
            保存
          </button>
        </div>
        <div className="mb-4 border-t-2 border-slate-100 pt-4">
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-50 py-2.5 text-sm font-black text-rose-500 ring-2 ring-rose-200"
            >
              <RotateCcw size={16} /> 清空全部学习记录
            </button>
          ) : (
            <div className="rounded-xl bg-rose-50 p-3 ring-2 ring-rose-300">
              <p className="mb-2 text-center text-sm font-bold text-rose-600">确定要清空吗？所有进度都会消失！</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    resetAll()
                    onClose()
                  }}
                  className="flex-1 rounded-xl bg-rose-500 py-2 text-sm font-black text-white"
                >
                  确定清空
                </button>
                <button onClick={() => setConfirmReset(false)} className="flex-1 rounded-xl bg-white py-2 text-sm font-black text-slate-500 ring-2 ring-slate-200">
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
        <button onClick={onClose} className="w-full rounded-xl bg-slate-100 py-2.5 font-black text-slate-500">
          关闭
        </button>
      </div>
    </div>
  )
}

function UnitPath({ unitIndex }: { unitIndex: number }) {
  const navigate = useNavigate()
  const { state, isLevelDone } = useGame()
  const unit = UNITS[unitIndex]

  // 全局线性关卡序号：按单元顺序逐个解锁
  const completedCount = Object.values(state.completed).filter(Boolean).length
  const globalBase = unitIndex * LEVELS_PER_UNIT

  const points = useMemo(pathPoints, [])
  const edges = [edgePath(points[0], points[1]), edgePath(points[1], points[2])]

  const doneLevels = Array.from({ length: LEVELS_PER_UNIT }, (_, i) => isLevelDone(`${unit.id}-L${i}`))

  return (
    <section className="mx-auto w-full max-w-md">
      <div
        className="mb-3 flex items-center gap-3 rounded-2xl px-5 py-4 text-white shadow-md"
        style={{ backgroundColor: unit.color }}
      >
        <span className="text-3xl">{unit.icon}</span>
        <div className="flex-1">
          <h2 className="text-lg font-black leading-tight">
            单元 {unitIndex + 1} · {unit.title}
          </h2>
          <p className="text-xs font-bold opacity-85">{unit.place ?? unit.subtitle}</p>
        </div>
        <div className="text-right text-xs font-black opacity-90">
          {doneLevels.filter(Boolean).length}/{LEVELS_PER_UNIT}
        </div>
      </div>

      <div className="relative mx-auto" style={{ height: 400, maxWidth: 360 }}>
        <svg viewBox="0 0 360 400" className="absolute inset-0 h-full w-full">
          {/* 轨道 */}
          {edges.map((d, i) => (
            <g key={i}>
              <path d={d} fill="none" stroke="#e5e5e5" strokeWidth={14} strokeLinecap="round" />
              {/* 已完成路段着色 */}
              {doneLevels[i + 1] && <path d={d} fill="none" stroke={unit.color} strokeWidth={14} strokeLinecap="round" opacity={0.35} />}
            </g>
          ))}
        </svg>

        {points.map((p, li) => {
          const gIndex = globalBase + li
          const done = doneLevels[li]
          const unlocked = gIndex <= completedCount
          const isCurrent = !done && unlocked
          const size = isCurrent ? 76 : 62
          const top = (p.y / 400) * 100
          const left = (p.x / 360) * 100
          return (
            <button
              key={li}
              disabled={!unlocked}
              onClick={() => {
                if (isCurrent) {
                  sfx.click()
                  navigate(`/lesson/${unitIndex}/${li}`)
                }
              }}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 font-black text-white transition"
              style={{
                top: `${top}%`,
                left: `${left}%`,
                width: size,
                height: size,
                fontSize: isCurrent ? 28 : 22,
                backgroundColor: done ? '#58cc02' : unlocked ? unit.color : '#e5e5e5',
                borderColor: done ? '#46a302' : unlocked ? 'rgba(0,0,0,0.15)' : '#d5d5d5',
                boxShadow: unlocked ? '0 5px 0 rgba(0,0,0,0.18)' : 'none',
                cursor: unlocked ? 'pointer' : 'not-allowed',
              }}
              aria-label={done ? `第 ${li + 1} 关已完成` : unlocked ? `开始第 ${li + 1} 关` : `第 ${li + 1} 关未解锁`}
            >
              {done ? '✓' : unlocked ? (isCurrent ? '▶' : li + 1) : '🔒'}
              {isCurrent && (
                <span className="absolute inset-0 -z-10 animate-ping rounded-full opacity-40" style={{ backgroundColor: unit.color }} />
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const { state, dueWords, learnedCount, masteredCount, totalXpToday } = useGame()
  const lv = xpLevel(state.xp)
  const [showSettings, setShowSettings] = useState(false)

  const DAILY_GOAL = 30
  const goalPct = Math.min(100, Math.round((totalXpToday / DAILY_GOAL) * 100))

  const hint = useMemo(() => {
    if (dueWords.length > 0) return `有 ${dueWords.length} 个单词该复习啦，记得去复习哦！`
    if (learnedCount === 0) return '点击彩色关卡按钮，开始你的第一节课吧！'
    if (totalXpToday >= DAILY_GOAL) return '今天的目标完成啦，真棒！明天见！'
    return `今天已赚 ${totalXpToday} XP，距离目标还差 ${Math.max(0, DAILY_GOAL - totalXpToday)} XP！`
  }, [dueWords.length, learnedCount, totalXpToday])

  return (
    <div className="min-h-screen bg-[#f7f9fb] pb-24">
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}

      {/* 顶部导航 */}
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <img src="/icon-192-v12.png" alt="迦哥闯天下" className="h-10 w-10 rounded-xl ring-1 ring-black/10" />
            <span className="hidden text-xl font-black tracking-tight text-[#58cc02] sm:block">迦哥闯天下</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <StatPill icon={<Flame size={18} fill="#ff9600" color="#ff9600" />} value={state.streak} color="#ff9600" />
            <StatPill icon={<Gem size={18} fill="#1cb0f6" color="#1cb0f6" />} value={state.gems} color="#1cb0f6" />
            <button
              onClick={() => setShowSettings(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm ring-1 ring-black/5 transition hover:text-slate-600"
              aria-label="设置"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
        {/* 经验条 */}
        <div className="mx-auto max-w-3xl px-4 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-[#ffc800]">Lv.{lv.level}</span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100 ring-1 ring-black/5">
              <div className="h-full rounded-full bg-[#ffc800] transition-all duration-500" style={{ width: `${lv.pct}%` }} />
            </div>
            <span className="text-xs font-bold text-slate-400">{lv.title}</span>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="mx-auto max-w-3xl px-4 pt-6">
        {/* 每日目标 + 统计 */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
            <svg viewBox="0 0 44 44" className="h-12 w-12 -rotate-90">
              <circle cx="22" cy="22" r="18" fill="none" stroke="#e5e5e5" strokeWidth="6" />
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                stroke={goalPct >= 100 ? '#58cc02' : '#1cb0f6'}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${(goalPct / 100) * 113} 113`}
              />
            </svg>
            <div>
              <p className="text-sm font-black text-slate-700">每日目标</p>
              <p className="text-xs font-bold text-slate-400">
                {totalXpToday}/{DAILY_GOAL} XP
              </p>
            </div>
          </div>
          <div className="flex flex-col justify-center rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
            <p className="text-lg font-black text-slate-700">{learnedCount}</p>
            <p className="text-xs font-bold text-slate-400">已学单词</p>
          </div>
          <div className="flex flex-col justify-center rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
            <p className="text-lg font-black text-[#58cc02]">{masteredCount}</p>
            <p className="text-xs font-bold text-slate-400">已掌握</p>
          </div>
        </div>

        {/* 功能入口 */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              sfx.click()
              navigate('/words')
            }}
            className="flex items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-black/5 transition hover:ring-2 hover:ring-[#1cb0f6]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ddf4ff] text-[#1cb0f6]">
              <BookOpenText size={22} />
            </span>
            <span>
              <span className="block font-black text-slate-700">单词本</span>
              <span className="block text-xs font-bold text-slate-400">看图学单词 · 跟读</span>
            </span>
          </button>
          <button
            onClick={() => {
              sfx.click()
              navigate('/review')
            }}
            className="relative flex items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-black/5 transition hover:ring-2 hover:ring-[#58cc02]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#d7ffb8] text-[#58cc02]">
              <RefreshCcw size={22} />
            </span>
            <span>
              <span className="block font-black text-slate-700">开始复习</span>
              <span className="block text-xs font-bold text-slate-400">
                {dueWords.length > 0 ? `${dueWords.length} 个单词待复习` : '记忆曲线 · 暂无到期'}
              </span>
            </span>
            {dueWords.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#ff4b4b] px-1.5 text-xs font-black text-white">
                {dueWords.length}
              </span>
            )}
          </button>
        </div>

        <div className="mb-8">
          <MascotHint text={hint} />
        </div>

        {/* 学习路径 */}
        {state.name ? (
          <p className="mb-4 text-center text-lg font-black text-slate-600">
            {state.name}，继续你的冒险吧！
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          {UNITS.map((_, i) => (
            <UnitPath key={i} unitIndex={i} />
          ))}
        </div>
      </main>
    </div>
  )
}

export { NameDialog }
