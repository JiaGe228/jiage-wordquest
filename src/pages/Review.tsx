import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Check, X } from 'lucide-react'
import { getWord } from '@/data/words'
import { useGame, todayStr } from '@/lib/store'
import { speak } from '@/lib/speech'
import { sfx } from '@/lib/sfx'
import { SpeakerButton, Confetti } from '@/components/common'

type Step = 'recall' | 'reveal'

export default function Review() {
  const navigate = useNavigate()
  const { state, dueWords, recordReview } = useGame()
  const [queue] = useState<string[]>(() => {
    // 到期单词优先，不足 10 个时补充未掌握的新词
    const t = todayStr()
    const due = [...dueWords]
    const extras = Object.entries(state.wordProgress)
      .filter(([id, p]) => !due.includes(id) && p.due > t && p.mastery < 3)
      .slice(0, 10 - due.length)
      .map(([id]) => id)
    return [...due, ...extras]
  })
  const [idx, setIdx] = useState(0)
  const [step, setStep] = useState<Step>('recall')
  const [known, setKnown] = useState(0)
  const [done, setDone] = useState(false)
  const [xpEarned, setXpEarned] = useState(0)

  const wordId = queue[idx]
  const word = useMemo(() => (wordId ? getWord(wordId) : undefined), [wordId])

  if (queue.length === 0 || !word) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f7f9fb] px-4 text-center">
        <div className="mb-4 text-8xl">🎉</div>
        <h2 className="mb-2 text-2xl font-black text-slate-800">全部掌握，太棒了！</h2>
        <p className="mb-8 font-bold text-slate-400">现在没有到期的单词，去闯几关学新词吧</p>
        <button
          onClick={() => navigate('/')}
          className="rounded-2xl bg-[#58cc02] px-10 py-3.5 font-black text-white shadow-[0_4px_0_#46a302]"
        >
          回主页
        </button>
      </div>
    )
  }

  function answer(knew: boolean) {
    sfx.click()
    speak(word!.word)
    setStep('reveal')
    setKnown(known + (knew ? 1 : 0))
    setXpEarned(xpEarned + recordReview(word!.id, knew))
  }

  function next() {
    sfx.click()
    if (idx + 1 >= queue.length) {
      sfx.complete()
      setDone(true)
    } else {
      setIdx(idx + 1)
      setStep('recall')
    }
  }

  if (done) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#f7f9fb] px-4 text-center">
        <Confetti />
        <div className="mb-3 text-8xl">🌟</div>
        <h2 className="mb-1 text-3xl font-black text-slate-800">复习完成！</h2>
        <p className="mb-8 font-bold text-slate-400">
          复习 {queue.length} 个单词 · 认识 {known} 个 · 不认识 {queue.length - known} 个
        </p>
        <div className="mb-8 rounded-2xl bg-[#fff4d6] px-8 py-4 ring-2 ring-[#ffc800]/40">
          <p className="text-3xl font-black text-[#ffc800]">+{xpEarned} XP</p>
          <p className="text-sm font-bold text-slate-500">复习奖励</p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="rounded-2xl bg-[#58cc02] px-12 py-4 font-black text-white shadow-[0_4px_0_#46a302]"
        >
          回主页
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f9fb]">
      <header className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-3">
        <button onClick={() => navigate('/')} className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100" aria-label="返回">
          <ArrowLeft size={24} strokeWidth={3} />
        </button>
        <div className="flex flex-1 gap-1.5">
          {queue.map((_, i) => (
            <div
              key={i}
              className={`h-4 flex-1 rounded-full transition-colors duration-300 ${
                i < idx ? 'bg-[#58cc02]' : i === idx ? 'bg-[#ffc800]' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
        <span className="text-sm font-black tabular-nums text-slate-400">
          {idx + 1}/{queue.length}
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pb-10">
        <p className="mb-2 mt-4 text-center text-lg font-black text-slate-500">
          {step === 'recall' ? '看到单词，想一想它的意思…' : '核对答案，加深记忆！'}
        </p>

        <div className="mt-6 flex flex-1 flex-col items-center justify-center gap-5">
          <div className="flex h-40 w-40 items-center justify-center rounded-3xl border-2 border-slate-100 bg-white text-9xl shadow-sm">
            {word.emoji}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-4xl font-black tracking-wide text-slate-800">{word.word}</span>
            <SpeakerButton text={word.word} />
          </div>
          <span className="text-sm font-bold text-slate-400">{word.phonetic}</span>

          {step === 'reveal' && (
            <div className="animate-pop flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-[#84d8ff] bg-[#ddf4ff] p-6 text-center">
              <span className="text-3xl font-black text-slate-800">{word.meaning}</span>
              <div className="flex items-center gap-2">
                <SpeakerButton text={word.example} size="sm" />
                <span className="font-bold text-slate-600">{word.example}</span>
              </div>
              <span className="text-sm font-bold text-slate-400">{word.exampleCn}</span>
            </div>
          )}
        </div>

        <div className="mt-8 flex gap-3">
          {step === 'recall' ? (
            <>
              <button
                onClick={() => answer(false)}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white py-4 text-lg font-black text-slate-500 shadow-sm transition hover:bg-slate-50"
              >
                <X size={22} strokeWidth={3} /> 还不熟
              </button>
              <button
                onClick={() => answer(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#58cc02] py-4 text-lg font-black text-white shadow-[0_4px_0_#46a302] transition hover:brightness-105"
              >
                <Check size={22} strokeWidth={3} /> 我认识
              </button>
            </>
          ) : (
            <button
              onClick={next}
              className="w-full rounded-2xl bg-[#58cc02] py-4 text-lg font-black text-white shadow-[0_4px_0_#46a302] transition hover:brightness-105"
            >
              {idx + 1 >= queue.length ? '完成复习 🎉' : '下一个'}
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
