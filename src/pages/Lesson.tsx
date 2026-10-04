import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Heart, Mic, Square, Volume2, X } from 'lucide-react'
import type { Question } from '@/types/game'
import { UNITS, LEVELS_PER_UNIT } from '@/data/words'
import { generateQuestions } from '@/lib/questions'
import { useGame } from '@/lib/store'
import { speak } from '@/lib/speech'
import { sfx } from '@/lib/sfx'
import { recordPcm, scoreSpeak, ensureMic, type SpeakResult } from '@/lib/speakcheck'
import { SpeakerButton, Confetti } from '@/components/common'
import { HINT_FIFTY_PRICE, HINT_LETTER_PRICE, HEART_REFILL_PRICE } from '@/lib/shop'

type Phase = 'question' | 'feedback' | 'done' | 'failed'

const HEARTS_MAX = 5

// ---------- 关卡内进度自动存档：中途退出后可继续 ----------
const LESSON_SAVE_KEY = 'wordquest-lesson-progress-v1'

interface LessonSave {
  levelKey: string
  qIndex: number
  hearts: number
  results: { wordId: string; correct: boolean }[]
}

function loadLessonSave(levelKey: string): LessonSave | null {
  try {
    const raw = localStorage.getItem(LESSON_SAVE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as LessonSave
    if (s.levelKey !== levelKey || !Array.isArray(s.results) || s.results.length === 0) return null
    return s
  } catch {
    return null
  }
}

function persistLessonSave(s: LessonSave) {
  try {
    localStorage.setItem(LESSON_SAVE_KEY, JSON.stringify(s))
  } catch {
    // 存储失败不阻塞游戏
  }
}

function clearLessonSave() {
  try {
    localStorage.removeItem(LESSON_SAVE_KEY)
  } catch {
    // ignore
  }
}

function OptionButton({
  label,
  kind,
  state,
  onClick,
}: {
  label: string
  kind: 'text' | 'emoji'
  state: 'idle' | 'selected' | 'correct' | 'wrong' | 'dim'
  onClick: () => void
}) {
  const base =
    kind === 'emoji'
      ? 'h-28 sm:h-32 text-6xl'
      : 'h-16 text-lg'
  const styles: Record<string, string> = {
    idle: 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700',
    selected: 'bg-[#ddf4ff] border-[#84d8ff] text-slate-700',
    correct: 'bg-[#d7ffb8] border-[#58cc02] text-slate-700',
    wrong: 'bg-[#ffdfe0] border-[#ff4b4b] text-slate-700 animate-shake',
    dim: 'bg-white border-slate-200 text-slate-300',
  }
  return (
    <button
      onClick={onClick}
      disabled={state === 'correct' || state === 'wrong' || state === 'dim'}
      className={`w-full rounded-2xl border-2 font-extrabold shadow-sm transition ${base} ${styles[state]}`}
    >
      {label}
    </button>
  )
}

export default function Lesson() {
  const { unitIndex = '0', levelIndex = '0' } = useParams()
  const navigate = useNavigate()
  const { completeLesson, state: saveState, spendGems } = useGame()

  const ui = Number(unitIndex)
  const li = Number(levelIndex)
  const unit = UNITS[ui]
  const levelKey = `${unit?.id}-L${li}`

  const questions = useMemo(
    () => (unit ? generateQuestions(unit.id, li) : []),
    [unit, li]
  )

  // 恢复上次进度（如果有有效存档）
  const [savedProgress] = useState(() => {
    if (!unit) return null
    const s = loadLessonSave(`${unit.id}-L${li}`)
    return s && s.qIndex < questions.length ? s : null
  })
  const [resume, setResume] = useState<'ask' | 'done'>(
    savedProgress && savedProgress.results.length > 0 ? 'ask' : 'done'
  )

  const [qIndex, setQIndex] = useState(savedProgress?.qIndex ?? 0)
  const [phase, setPhase] = useState<Phase>('question')
  const [selected, setSelected] = useState<string | null>(null)
  const [spelled, setSpelled] = useState<number[]>([])
  const [hearts, setHearts] = useState(savedProgress?.hearts ?? HEARTS_MAX)
  const [results, setResults] = useState<{ wordId: string; correct: boolean }[]>(savedProgress?.results ?? [])
  const [showExit, setShowExit] = useState(false)
  const [speakState, setSpeakState] = useState<'idle' | 'recording' | 'analyzing' | 'scored'>('idle')
  const [speakResult, setSpeakResult] = useState<SpeakResult | null>(null)
  // 提示道具状态
  const [eliminated, setEliminated] = useState<string[]>([])
  const [letterHintUsed, setLetterHintUsed] = useState(false)
  const [hintAsk, setHintAsk] = useState<'fifty' | 'letter' | null>(null)
  const summary = useRef<{ xpEarned: number; gemsEarned: number; correct: number; total: number } | null>(null)

  const q: Question | undefined = questions[qIndex]

  // 听音题/跟读题自动播放参考发音
  useEffect(() => {
    if (!q) return
    if (q.type === 'listen' || q.type === 'speak') {
      const t = setTimeout(() => speak(q.word.word), 350)
      return () => clearTimeout(t)
    }
  }, [q])

  // 每答完一题自动存档；通关/失败后清除
  useEffect(() => {
    if (!unit) return
    if (phase === 'done' || phase === 'failed') {
      clearLessonSave()
      return
    }
    if (results.length > 0) {
      persistLessonSave({ levelKey: `${unit.id}-L${li}`, qIndex, hearts, results })
    }
  }, [qIndex, hearts, results, phase, unit, li])

  if (!unit || !q) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f9fb]">
        <p className="font-bold text-slate-400">关卡不存在</p>
      </div>
    )
  }

  const lastCorrect = results.length > 0 ? results[results.length - 1].correct : true

  function checkAnswer() {
    if (!q) return
    let correct: boolean
    if (q.type === 'spelling') {
      correct = spelled.map((i) => q.letters![i]).join('') === q.correct
    } else {
      correct = selected === q.correct
    }
    const nextResults = [...results, { wordId: q.word.id, correct }]
    setResults(nextResults)
    if (correct) {
      sfx.correct()
      speak(q.word.word)
    } else {
      sfx.wrong()
      sfx.heartLost()
    }
    const left = correct ? hearts : hearts - 1
    setHearts(left)
    setPhase('feedback')
    if (!correct && left <= 0) {
      // 体力耗尽：反馈条显示后直接判负
      setTimeout(() => setPhase('failed'), 50)
    }
  }

  function goNext() {
    if (qIndex + 1 >= questions.length) {
      summary.current = completeLesson(levelKey, results, isBoss ? 2 : 1)
      sfx.complete()
      setPhase('done')
    } else {
      setQIndex(qIndex + 1)
      setSelected(null)
      setSpelled([])
      setSpeakState('idle')
      setSpeakResult(null)
      setEliminated([])
      setLetterHintUsed(false)
      setHintAsk(null)
      setPhase('question')
    }
  }

  function continueNext() {
    if (phase !== 'feedback') return
    if (hearts <= 0 && !lastCorrect) {
      setPhase('failed')
      return
    }
    goNext()
  }

  function restart() {
    clearLessonSave()
    setResume('done')
    setQIndex(0)
    setPhase('question')
    setSelected(null)
    setSpelled([])
    setHearts(HEARTS_MAX)
    setResults([])
    setSpeakState('idle')
    setSpeakResult(null)
    setEliminated([])
    setLetterHintUsed(false)
    setHintAsk(null)
    summary.current = null
  }

  /** 提示道具：去两错 / 拼写首字母，花宝石购买 */
  function confirmHint(kind: 'fifty' | 'letter') {
    const price = kind === 'fifty' ? HINT_FIFTY_PRICE : HINT_LETTER_PRICE
    if (!spendGems(price)) {
      sfx.wrong()
      setHintAsk(null)
      return
    }
    sfx.complete()
    if (kind === 'fifty' && q && q.options.length > 0) {
      const wrong = q.options
        .filter((o) => o !== q.correct)
        .sort(() => Math.random() - 0.5)
        .slice(0, 2)
      setEliminated(wrong)
    }
    if (kind === 'letter' && q && q.type === 'spelling') {
      const idx = q.letters!.findIndex((ch, i) => ch === q.correct[0] && !spelled.includes(i))
      if (idx >= 0) setSpelled((prev) => [...prev, idx])
      setLetterHintUsed(true)
    }
    setHintAsk(null)
  }

  /** 爱心补给：失败界面花宝石满血复活，保留本关进度 */
  function refillHearts() {
    if (!spendGems(HEART_REFILL_PRICE)) {
      sfx.wrong()
      return
    }
    sfx.complete()
    setHearts(HEARTS_MAX)
    setPhase('question')
  }

  /** 跟读：录音 → 评分（联网走语音识别比对，离线走音频特征启发式） */
  async function startSpeak() {
    if (!q || q.type !== 'speak') return
    if (speakState === 'recording' || speakState === 'analyzing') return
    sfx.click()
    setSpeakState('recording')
    setSpeakResult(null)
    try {
      await ensureMic()
      const { pcm } = await recordPcm(4.5)
      setSpeakState('analyzing')
      const result = await scoreSpeak(q.word.word, pcm)
      setSpeakResult(result)
      // 跟读永远鼓励：记为答对，星星数代表发音质量
      setResults((r) => [...r, { wordId: q.word.id, correct: true }])
      if (result.stars === 3) sfx.complete()
      else sfx.correct()
    } catch {
      // 没有麦克风/被拒绝：保底 1 星，不阻塞闯关
      setSpeakResult({ stars: 1, recognized: null, mode: 'heuristic' })
      setResults((r) => [...r, { wordId: q.word.id, correct: true }])
    }
    setSpeakState('scored')
  }

  function nextLevelPath(): string | null {
    if (li + 1 < LEVELS_PER_UNIT) return `/lesson/${ui}/${li + 1}`
    if (ui + 1 < UNITS.length) return `/lesson/${ui + 1}/0`
    return null
  }

  const answered = phase === 'feedback'
  const canCheck = q.type === 'spelling' ? spelled.length === q.correct.length : selected !== null
  const isBoss = li === LEVELS_PER_UNIT - 1

  /** 提示道具按钮 / 二次确认条 */
  function hintControl(kind: 'fifty' | 'letter', label: string, price: number) {
    if (hintAsk === kind) {
      return (
        <div className="mx-auto mb-3 flex w-full max-w-md items-center gap-2 rounded-2xl bg-[#fff4d6] p-3 ring-2 ring-[#ffc800]/50">
          <span className="flex-1 text-sm font-black text-slate-600">
            花 {price} 宝石{label}？
          </span>
          <button
            onClick={() => confirmHint(kind)}
            className="rounded-xl bg-[#58cc02] px-4 py-2 text-sm font-black text-white shadow-[0_3px_0_#46a302]"
          >
            确定
          </button>
          <button onClick={() => setHintAsk(null)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-500">
            取消
          </button>
        </div>
      )
    }
    return (
      <button
        onClick={() => setHintAsk(kind)}
        className="mx-auto mb-3 flex items-center gap-1.5 rounded-full bg-[#fff4d6] px-4 py-2 text-sm font-black text-[#b8860b] ring-2 ring-[#ffc800]/50 transition hover:bg-[#ffe9a8]"
      >
        💡 {label} · {price}💎
      </button>
    )
  }

  const praise = ['太棒了！', '你真厉害！', '好样的！', '答对啦！', '完美！']
  const praiseText = praise[(qIndex + q.word.word.length) % praise.length]

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f9fb]">
      {phase === 'done' && <Confetti />}
      {/* 退出确认 */}
      {showExit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#131f24]/60 p-4" onClick={() => setShowExit(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 text-5xl">🦉</div>
            <h3 className="mb-1 text-xl font-black text-slate-800">现在离开吗？</h3>
            <p className="mb-5 text-sm font-bold text-slate-400">放心，进度已自动保存，回来可以继续</p>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/')}
                className="flex-1 rounded-2xl bg-[#ff4b4b] py-3 font-black text-white shadow-[0_4px_0_#d33131]"
              >
                离开
              </button>
              <button
                onClick={() => setShowExit(false)}
                className="flex-1 rounded-2xl bg-slate-100 py-3 font-black text-slate-500"
              >
                继续学习
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 恢复上次进度 */}
      {resume === 'ask' && savedProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#131f24]/60 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="mb-2 text-5xl">📍</div>
            <h3 className="mb-1 text-xl font-black text-slate-800">接着上次继续！</h3>
            <p className="mb-5 text-sm font-bold text-slate-400">
              这关已经做到第 {Math.min(savedProgress.qIndex + 1, questions.length)}/{questions.length} 题
            </p>
            <div className="flex gap-3">
              <button
                onClick={restart}
                className="flex-1 rounded-2xl bg-slate-100 py-3 font-black text-slate-500"
              >
                重新开始
              </button>
              <button
                onClick={() => {
                  sfx.click()
                  setResume('done')
                }}
                className="flex-1 rounded-2xl bg-[#58cc02] py-3 font-black text-white shadow-[0_4px_0_#46a302]"
              >
                继续学习 ▶
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 顶栏 */}
      <header className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
        <button onClick={() => setShowExit(true)} className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100" aria-label="退出">
          <X size={26} strokeWidth={3} />
        </button>
        <div className="flex flex-1 gap-1.5">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`h-4 flex-1 rounded-full transition-colors duration-300 ${
                i < qIndex || phase === 'done' ? 'bg-[#58cc02]' : i === qIndex ? 'bg-[#ffc800]' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Heart size={24} fill={hearts > 0 ? '#ff4b4b' : '#e5e5e5'} color={hearts > 0 ? '#ff4b4b' : '#e5e5e5'} />
          <span className="w-4 text-base font-black tabular-nums text-[#ff4b4b]">{hearts}</span>
        </div>
      </header>

      {/* 题目区 */}
      {phase !== 'done' && phase !== 'failed' && (
        <>
          <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-40 pt-2">
            <p className="mb-6 text-center text-lg font-black text-slate-500">
              {isBoss ? `👑 单元测验 · ${unit.icon} ${unit.title}` : `第 ${qIndex + 1} 题 · ${unit.icon} ${unit.title}`}
            </p>
            <h2 className="mb-6 text-center text-2xl font-black text-slate-800">{q.prompt}</h2>

            {/* 题面 */}
            {q.type === 'image-pick-zh' && (
              <div className="mb-8 flex flex-col items-center gap-3">
                <div className="flex h-36 w-36 items-center justify-center rounded-3xl border-2 border-slate-100 bg-white text-8xl shadow-sm">
                  {q.word.emoji}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-black tracking-wide text-slate-800">{q.word.word}</span>
                  <SpeakerButton text={q.word.word} />
                </div>
                <span className="text-sm font-bold text-slate-400">{q.word.phonetic}</span>
              </div>
            )}

            {q.type === 'image-pick-en' && (
              <div className="mb-8 flex justify-center">
                <div className="rounded-3xl border-2 border-slate-100 bg-white px-10 py-6 shadow-sm">
                  <span className="text-5xl font-black text-slate-800">{q.word.meaning}</span>
                </div>
              </div>
            )}

            {q.type === 'listen' && (
              <div className="mb-8 flex flex-col items-center gap-3">
                <button
                  onClick={() => {
                    sfx.click()
                    speak(q.word.word)
                  }}
                  className="flex h-28 w-28 items-center justify-center rounded-full bg-[#1cb0f6] text-white shadow-[0_6px_0_#1899d6] transition hover:brightness-105 active:translate-y-1 active:shadow-none"
                  aria-label="播放"
                >
                  <Volume2 size={44} fill="currentColor" />
                </button>
                <p className="text-sm font-bold text-slate-400">点喇叭再听一遍</p>
              </div>
            )}

            {q.type === 'translate-en' && (
              <div className="mb-8 flex justify-center">
                <div className="rounded-3xl border-2 border-slate-100 bg-white px-10 py-6 shadow-sm">
                  <span className="text-5xl font-black text-slate-800">{q.word.meaning}</span>
                </div>
              </div>
            )}

            {q.type === 'spelling' && (
              <div className="mb-8 flex flex-col items-center gap-3">
                <div className="flex h-28 w-28 items-center justify-center rounded-3xl border-2 border-slate-100 bg-white text-6xl shadow-sm">
                  {q.word.emoji}
                </div>
                <span className="text-xl font-black text-slate-600">{q.word.meaning}</span>
                <SpeakerButton text={q.word.word} />
                {/* 答案槽 */}
                <div className="mt-2 flex min-h-14 flex-wrap justify-center gap-2">
                  {q.correct.split('').map((_, i) => {
                    const poolIdx = spelled[i]
                    const ch = poolIdx !== undefined ? q.letters![poolIdx] : undefined
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          if (ch !== undefined && !answered) {
                            sfx.click()
                            setSpelled(spelled.slice(0, i))
                          }
                        }}
                        className={`flex h-13 w-11 items-center justify-center rounded-xl border-b-4 text-2xl font-black uppercase transition ${
                          ch !== undefined ? 'border-[#84d8ff] bg-white text-slate-800' : 'border-slate-200 bg-slate-100 text-transparent'
                        } ${answered ? 'pointer-events-none' : ''}`}
                        style={{ height: 52 }}
                      >
                        {ch ?? '·'}
                      </button>
                    )
                  })}
                </div>
                {/* 字母池 */}
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {q.letters!.map((ch, i) => {
                    const usedIdx = spelled.indexOf(i)
                    const used = usedIdx !== -1
                    return (
                      <button
                        key={i}
                        disabled={used || answered}
                        onClick={() => {
                          sfx.click()
                          setSpelled([...spelled, i])
                        }}
                        className={`flex h-12 w-11 items-center justify-center rounded-xl border-b-4 text-2xl font-black uppercase transition ${
                          used
                            ? 'border-slate-100 bg-slate-100 text-transparent'
                            : 'border-[#84d8ff] bg-white text-slate-800 hover:bg-[#ddf4ff] active:translate-y-0.5 active:border-b-2'
                        }`}
                      >
                        {ch}
                      </button>
                    )
                  })}
                </div>
                {!answered && !letterHintUsed && hintControl('letter', '显示第一个字母', HINT_LETTER_PRICE)}
              </div>
            )}

            {q.type === 'fill-blank' && (
              <div className="mb-8 flex flex-col items-center gap-4">
                <div className="rounded-3xl border-2 border-slate-100 bg-white px-8 py-6 text-center shadow-sm">
                  <p className="text-2xl font-black tracking-wide text-slate-800">{q.sentence}</p>
                </div>
                <SpeakerButton text={q.word.example} size="sm" />
              </div>
            )}

            {q.type === 'fact' && (
              <div className="mb-8 flex justify-center">
                <div className="animate-pop flex w-full max-w-lg flex-col items-center gap-4 rounded-3xl border-2 border-[#ffd580] bg-[#fff8e6] p-8 text-center shadow-sm">
                  <span className="text-6xl">🌍</span>
                  <div className="flex items-center gap-3">
                    <span className="text-5xl">{q.word.emoji}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-3xl font-black tracking-wide text-slate-800">{q.word.word}</span>
                      <SpeakerButton text={q.word.word} size="sm" />
                    </div>
                  </div>
                  <p className="text-lg font-bold leading-relaxed text-slate-600">{q.factText}</p>
                </div>
              </div>
            )}

            {q.type === 'speak' && (
              <div className="mb-8 flex flex-col items-center gap-3">
                <div className="flex h-32 w-32 items-center justify-center rounded-3xl border-2 border-slate-100 bg-white text-7xl shadow-sm">
                  {q.word.emoji}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-black tracking-wide text-slate-800">{q.word.word}</span>
                  <SpeakerButton text={q.word.word} />
                </div>
                <span className="text-sm font-bold text-slate-400">{q.word.phonetic}</span>
                <button
                  onClick={startSpeak}
                  disabled={speakState === 'recording' || speakState === 'analyzing'}
                  className={`mt-3 flex h-24 w-24 items-center justify-center rounded-full text-white shadow-[0_6px_0_rgba(0,0,0,0.18)] transition enabled:hover:brightness-105 enabled:active:translate-y-1 enabled:active:shadow-none ${
                    speakState === 'recording' ? 'animate-pulse bg-[#ff4b4b]' : 'bg-[#58cc02]'
                  } ${speakState === 'scored' ? 'opacity-60' : ''}`}
                  aria-label="跟读录音"
                >
                  {speakState === 'recording' ? <Square size={34} fill="currentColor" /> : <Mic size={40} />}
                </button>
                <p className="text-sm font-bold text-slate-400">
                  {speakState === 'idle' && '点麦克风，大声跟读这个单词！'}
                  {speakState === 'recording' && '正在听…说完稍等自动评分'}
                  {speakState === 'analyzing' && '评分中…'}
                  {speakState === 'scored' &&
                    (speakResult?.mode === 'recognition' && speakResult.recognized
                      ? `我听到你说："${speakResult.recognized}"`
                      : '离线评分模式')}
                </p>
                {speakState === 'scored' && speakResult && (
                  <div className="animate-pop mt-1 flex items-center gap-2 text-4xl">
                    {[1, 2, 3].map((s) => (
                      <span key={s} className={s <= speakResult.stars ? '' : 'opacity-20 grayscale'}>
                        ⭐
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 选项 */}
            {q.options.length > 0 && (
              <>
                {!answered && q.options.length >= 4 && eliminated.length === 0 && hintControl('fifty', '去掉两个错误选项', HINT_FIFTY_PRICE)}
                <div className={`grid gap-3 ${q.optionKind === 'emoji' ? 'grid-cols-2' : 'grid-cols-2'}`}>
                  {q.options.map((opt) => {
                    let st: 'idle' | 'selected' | 'correct' | 'wrong' | 'dim' = 'idle'
                    if (answered) {
                      if (opt === q.correct) st = 'correct'
                      else if (opt === selected) st = 'wrong'
                      else st = 'dim'
                    } else if (eliminated.includes(opt)) {
                      st = 'dim'
                    } else if (opt === selected) {
                      st = 'selected'
                    }
                  return (
                    <OptionButton
                      key={opt}
                      label={opt}
                      kind={q.optionKind}
                      state={st}
                      onClick={() => {
                        if (answered) return
                        sfx.click()
                        setSelected(opt)
                      }}
                    />
                  )
                  })}
                </div>
              </>
            )}
          </main>

          {/* 底部操作条 */}
          <footer
            className={`fixed inset-x-0 bottom-0 z-40 border-t-2 transition-colors duration-300 ${
              answered ? (lastCorrect ? 'border-[#58cc02] bg-[#d7ffb8]' : 'border-[#ff4b4b] bg-[#ffdfe0]') : 'border-slate-200 bg-white'
            }`}
          >
            <div className="mx-auto flex min-h-24 w-full max-w-2xl items-center justify-between gap-4 px-4 py-4">
              {!answered ? (
                q.type === 'fact' ? (
                  <>
                    <div />
                    <button
                      onClick={goNext}
                      className="rounded-2xl bg-[#1cb0f6] px-10 py-3.5 text-lg font-black uppercase tracking-wide text-white shadow-[0_4px_0_#1899d6] transition hover:brightness-105"
                    >
                      继续
                    </button>
                  </>
                ) : q.type === 'speak' ? (
                  <>
                    <div />
                    <button
                      onClick={goNext}
                      disabled={speakState !== 'scored'}
                      className="rounded-2xl bg-[#1cb0f6] px-10 py-3.5 text-lg font-black uppercase tracking-wide text-white shadow-[0_4px_0_#1899d6] transition enabled:hover:brightness-105 disabled:opacity-40"
                    >
                      继续
                    </button>
                  </>
                ) : (
                  <>
                    <div />
                    <button
                      onClick={checkAnswer}
                      disabled={!canCheck}
                      className="rounded-2xl bg-[#58cc02] px-10 py-3.5 text-lg font-black uppercase tracking-wide text-white shadow-[0_4px_0_#46a302] transition enabled:hover:brightness-105 disabled:opacity-40"
                    >
                      检查
                    </button>
                  </>
                )
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    {lastCorrect ? (
                      <p className="text-xl font-black text-[#58a700]">{praiseText}</p>
                    ) : (
                      <div>
                        <p className="text-lg font-black text-[#ea2b2b]">正确答案：</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-black text-[#ea2b2b]">
                            {q.type === 'spelling' ? q.correct : q.correct}
                          </span>
                          <SpeakerButton text={q.word.word} size="sm" />
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={continueNext}
                    className={`rounded-2xl px-10 py-3.5 text-lg font-black uppercase tracking-wide text-white shadow-[0_4px_0_rgba(0,0,0,0.2)] transition hover:brightness-105 ${
                      lastCorrect ? 'bg-[#58cc02]' : 'bg-[#ff4b4b]'
                    }`}
                  >
                    继续
                  </button>
                </>
              )}
            </div>
          </footer>
        </>
      )}

      {/* 体力耗尽 */}
      {phase === 'failed' && (
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 text-center">
          <div className="mb-4 text-8xl">💔</div>
          <h2 className="mb-2 text-3xl font-black text-slate-800">爱心用完了</h2>
          <p className="mb-8 font-bold text-slate-400">别灰心，休息一会儿再挑战！</p>
          {saveState.gems >= HEART_REFILL_PRICE ? (
            <button
              onClick={refillHearts}
              className="mb-3 w-full rounded-2xl bg-[#ffc800] py-4 text-lg font-black text-white shadow-[0_4px_0_#e0a500] transition hover:brightness-105"
            >
              花 {HEART_REFILL_PRICE} 宝石补满爱心，继续闯关 💎
            </button>
          ) : (
            <p className="mb-3 text-sm font-bold text-slate-300">
              宝石不够补爱心（需要 {HEART_REFILL_PRICE}，你有 {saveState.gems}）
            </p>
          )}
          <button
            onClick={restart}
            className="mb-3 w-full rounded-2xl bg-[#58cc02] py-4 text-lg font-black text-white shadow-[0_4px_0_#46a302]"
          >
            重新开始本关
          </button>
          <button onClick={() => navigate('/')} className="w-full rounded-2xl bg-slate-100 py-4 text-lg font-black text-slate-500">
            回主页
          </button>
        </main>
      )}

      {/* 通关结算 */}
      {phase === 'done' && summary.current && (
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 text-center">
          <div className="mb-3 text-8xl">🏆</div>
          <h2 className="mb-1 text-3xl font-black text-slate-800">关卡完成！</h2>
          <p className="mb-8 font-bold text-slate-400">
            答对 {summary.current.correct}/{summary.current.total} 题
          </p>
          <div className="mb-8 grid w-full grid-cols-2 gap-3">
            <div className="rounded-2xl bg-[#fff4d6] p-4 ring-2 ring-[#ffc800]/40">
              <p className="text-3xl font-black text-[#ffc800]">+{summary.current.xpEarned}</p>
              <p className="text-sm font-bold text-slate-500">经验值 XP</p>
            </div>
            <div className="rounded-2xl bg-[#ddf4ff] p-4 ring-2 ring-[#1cb0f6]/30">
              <p className="text-3xl font-black text-[#1cb0f6]">+{summary.current.gemsEarned}</p>
              <p className="text-sm font-bold text-slate-500">宝石 💎</p>
            </div>
          </div>
          {nextLevelPath() ? (
            <button
              onClick={() => navigate(nextLevelPath()!)}
              className="mb-3 w-full rounded-2xl bg-[#58cc02] py-4 text-lg font-black text-white shadow-[0_4px_0_#46a302]"
            >
              继续下一关 ▶
            </button>
          ) : (
            <p className="mb-3 font-black text-[#58cc02]">🎉 全部关卡完成，你太了不起了！</p>
          )}
          <button onClick={() => navigate('/')} className="w-full rounded-2xl bg-slate-100 py-4 text-lg font-black text-slate-500">
            回主页
          </button>
          <p className="mt-6 text-xs font-bold text-slate-300">
            当前等级 Lv.{xpLevelShow(saveState.xp).level} · 连胜 {saveState.streak} 天 🔥
          </p>
        </main>
      )}
    </div>
  )
}

function xpLevelShow(xp: number) {
  return { level: Math.floor(xp / 100) + 1 }
}
