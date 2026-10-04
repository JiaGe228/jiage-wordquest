import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { LevelResult } from '@/types/game'
import { ALL_WORDS } from '@/data/words'

// ---------- 简化版间隔重复（记忆曲线） ----------
// mastery 0~4，对应复习间隔天数
const SRS_INTERVALS = [1, 2, 4, 7, 15]

export interface WordProgress {
  mastery: number // 0-4
  due: string // yyyy-mm-dd，下次复习日期
}

export interface SaveState {
  name: string
  xp: number
  gems: number
  streak: number
  lastStudy: string // yyyy-mm-dd
  today: string
  xpToday: number
  completed: Record<string, boolean> // `${unitId}-L${i}`
  wordProgress: Record<string, WordProgress>
  outfit: string // 当前穿戴的装扮 id，空为无
  ownedOutfits: string[] // 已拥有的装扮 id
}

const STORAGE_KEY = 'wordquest-save-v1'

function todayStr(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return todayStr(d)
}

function yesterdayStr(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return todayStr(d)
}

export const DEFAULT_STATE: SaveState = {
  name: '',
  xp: 0,
  gems: 0,
  streak: 0,
  lastStudy: '',
  today: todayStr(),
  xpToday: 0,
  completed: {},
  wordProgress: {},
  outfit: '',
  ownedOutfits: [],
}

function loadState(): SaveState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_STATE }
    const parsed = JSON.parse(raw) as Partial<SaveState>
    return { ...DEFAULT_STATE, ...parsed }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

// ---------- 经验等级 ----------
const LEVEL_TITLES = [
  '新手冒险家',
  '见习小学徒',
  '勇敢探险家',
  '词汇小达人',
  '英语小能手',
  '智慧小学霸',
  '闪耀英语星',
  '博学小博士',
  '传奇词勇士',
  '英语大英雄',
]

export function xpLevel(xp: number) {
  const level = Math.min(Math.floor(xp / 100) + 1, 99)
  const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)]
  const into = xp % 100
  return { level, title, into, pct: Math.round((into / 100) * 100) }
}

interface GameContextValue {
  state: SaveState
  setName: (name: string) => void
  completeLesson: (levelKey: string, results: LevelResult[], gemBonus?: number) => { xpEarned: number; gemsEarned: number; correct: number; total: number }
  recordReview: (wordId: string, known: boolean) => number // 返回获得 xp
  isLevelDone: (levelKey: string) => boolean
  dueWords: string[] // 今天到期待复习的 wordId
  learnedCount: number
  masteredCount: number // mastery >= 3
  totalXpToday: number
  resetAll: () => void
  spendGems: (n: number) => boolean // 扣宝石，不够返回 false
  buyOutfit: (id: string, price: number) => boolean // 买并自动穿上
  equipOutfit: (id: string) => void // 穿/脱（再点一次脱下）
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SaveState>(loadState)

  // 跨天时重置每日 XP
  useEffect(() => {
    const t = todayStr()
    if (state.today !== t) {
      setState((s) => ({ ...s, today: t, xpToday: 0 }))
    }
  }, [state.today])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // 存储失败不阻塞游戏
    }
  }, [state])

  const value = useMemo<GameContextValue>(() => {
    const bumpStudyDay = (s: SaveState): Pick<SaveState, 'streak' | 'lastStudy' | 'xpToday' | 'today'> => {
      const t = todayStr()
      const streak = s.lastStudy === t ? s.streak : s.lastStudy === yesterdayStr() ? s.streak + 1 : 1
      return { streak, lastStudy: t, xpToday: s.today === t ? s.xpToday : 0, today: t }
    }

    return {
      state,
      setName: (name) => setState((s) => ({ ...s, name })),

      completeLesson: (levelKey, results, gemBonus = 1) => {
        const correct = results.filter((r) => r.correct).length
        const total = results.length
        const perfect = correct === total
        const xpEarned = correct * 10 + (perfect ? 15 : 0)
        const gemsEarned = (5 + correct * 2) * gemBonus
        const t = todayStr()

        setState((s) => {
          const study = bumpStudyDay(s)
          const wordProgress = { ...s.wordProgress }
          for (const r of results) {
            const prev = wordProgress[r.wordId] ?? { mastery: 0, due: t }
            if (r.correct) {
              const mastery = Math.min(4, prev.mastery + 1)
              wordProgress[r.wordId] = { mastery, due: addDays(t, SRS_INTERVALS[mastery]) }
            } else {
              const mastery = Math.max(0, prev.mastery - 1)
              wordProgress[r.wordId] = { mastery, due: addDays(t, 1) }
            }
          }
          return {
            ...s,
            ...study,
            xp: s.xp + xpEarned,
            xpToday: study.xpToday + xpEarned,
            gems: s.gems + gemsEarned,
            completed: { ...s.completed, [levelKey]: true },
            wordProgress,
          }
        })
        return { xpEarned, gemsEarned, correct, total }
      },

      recordReview: (wordId, known) => {
        const xp = known ? 5 : 1
        const t = todayStr()
        setState((s) => {
          const study = bumpStudyDay(s)
          const prev = s.wordProgress[wordId] ?? { mastery: 0, due: t }
          const mastery = known ? Math.min(4, prev.mastery + 1) : 0
          return {
            ...s,
            ...study,
            xp: s.xp + xp,
            xpToday: study.xpToday + xp,
            gems: s.gems + (known ? 1 : 0),
            lastStudy: t,
            wordProgress: {
              ...s.wordProgress,
              [wordId]: { mastery, due: addDays(t, SRS_INTERVALS[mastery]) },
            },
          }
        })
        return xp
      },

      isLevelDone: (levelKey) => Boolean(state.completed[levelKey]),

      dueWords: (() => {
        const t = todayStr()
        return ALL_WORDS.filter((w) => {
          const p = state.wordProgress[w.id]
          return p && p.due <= t
        }).map((w) => w.id)
      })(),

      learnedCount: Object.keys(state.wordProgress).length,
      masteredCount: Object.values(state.wordProgress).filter((p) => p.mastery >= 3).length,
      totalXpToday: state.today === todayStr() ? state.xpToday : 0,

      resetAll: () => setState({ ...DEFAULT_STATE, today: todayStr() }),

      spendGems: (n) => {
        if (state.gems < n) return false
        setState((s) => (s.gems < n ? s : { ...s, gems: s.gems - n }))
        return true
      },

      buyOutfit: (id, price) => {
        if (state.ownedOutfits.includes(id) || state.gems < price) return false
        setState((s) =>
          s.ownedOutfits.includes(id) || s.gems < price
            ? s
            : { ...s, gems: s.gems - price, ownedOutfits: [...s.ownedOutfits, id], outfit: id }
        )
        return true
      },

      equipOutfit: (id) =>
        setState((s) => ({ ...s, outfit: s.outfit === id ? '' : id })),
    }
  }, [state])

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}

export { todayStr, addDays }
