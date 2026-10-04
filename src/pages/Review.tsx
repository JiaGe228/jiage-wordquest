import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Lightbulb, Mic, Square, Volume2 } from 'lucide-react'
import { ALL_WORDS, getWord } from '@/data/words'
import { useGame, todayStr } from '@/lib/store'
import { speak } from '@/lib/speech'
import { sfx } from '@/lib/sfx'
import { ensureMic, recordPcm, scoreSpeak, type SpeakResult } from '@/lib/speakcheck'
import { Confetti } from '@/components/common'

// 复习三步：想一想（看中文读英语）→ 朗读评分 → 翻译检验
type Step = 'recall' | 'translate'

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
  const [done, setDone] = useState(false)

  // 朗读评分状态
  const [speakState, setSpeakState] = useState<'idle' | 'recording' | 'analyzing' | 'scored'>('idle')
  const [speakResult, setSpeakResult] = useState<SpeakResult | null>(null)
  const [micError, setMicError] = useState(false)

  // 翻译检验状态
  const [picked, setPicked] = useState<string | null>(null)

  // 本词成绩
  const [speakOK, setSpeakOK] = useState(false)
  const [usedReveal, setUsedReveal] = useState(false)

  // 统计
  const [knownCount, setKnownCount] = useState(0)
  const [speakStarsSum, setSpeakStarsSum] = useState(0)
  const [speakScoredCount, setSpeakScoredCount] = useState(0)
  const [translateCorrectCount, setTranslateCorrectCount] = useState(0)
  const [xpEarned, setXpEarned] = useState(0)

  const wordId = queue[idx]
  const word = useMemo(() => (wordId ? getWord(wordId) : undefined), [wordId])

  // 翻译干扰项：同单元优先，凑满 3 个不同义项
  const options = useMemo(() => {
    if (!word) return []
    const sameUnit = ALL_WORDS.filter((w) => w.id !== word.id && w.meaning !== word.meaning)
    const shuffled = [...sameUnit].sort(() => Math.random() - 0.5)
    const picks: string[] = []
    for (const w of shuffled) {
      if (picks.length >= 3) break
      if (!picks.includes(w.meaning)) picks.push(w.meaning)
    }
    return [...picks, word.meaning].sort(() => Math.random() - 0.5)
  }, [word])

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

  /** 朗读：录音 → 评分。麦克风不可用时不惩罚，跳过朗读环节 */
  async function startSpeak() {
    if (speakState === 'recording' || speakState === 'analyzing') return
    sfx.click()
    setSpeakState('recording')
    setSpeakResult(null)
    setMicError(false)
    try {
      await ensureMic()
      const { pcm } = await recordPcm(4.5)
      setSpeakState('analyzing')
      const result = await scoreSpeak(word!.word, pcm)
      setSpeakResult(result)
      setSpeakScoredCount((c) => c + 1)
      setSpeakStarsSum((s) => s + result.stars)
      setSpeakOK(result.stars >= 2)
      if (result.stars === 3) sfx.complete()
      else sfx.correct()
    } catch {
      // 没有麦克风/被拒绝：不卡孩子，视为通过
      setMicError(true)
      setSpeakOK(true)
      sfx.click()
    }
    setSpeakState('scored')
  }

  function passSpeak() {
    // 跳过朗读（不进统计），进入翻译
    sfx.click()
    setSpeakState('idle')
    setSpeakResult(null)
    setSpeakOK(true)
    setStep('translate')
  }

  function retrySpeak() {
    setSpeakState('idle')
    setSpeakResult(null)
    startSpeak()
  }

  function goTranslate() {
    sfx.click()
    setStep('translate')
  }

  function pickAnswer(meaning: string) {
    if (picked) return
    sfx.click()
    setPicked(meaning)
    const correct = meaning === word!.meaning
    if (correct) sfx.correct()
    else sfx.wrong()
    setTranslateCorrectCount((c) => c + (correct ? 1 : 0))
  }

  function finishWord() {
    const translateCorrect = picked === word!.meaning
    const knew = !usedReveal && speakOK && translateCorrect
    setKnownCount((c) => c + (knew ? 1 : 0))
    setXpEarned((x) => x + recordReview(word!.id, knew))
    if (idx + 1 >= queue.length) {
      sfx.complete()
      setDone(true)
    } else {
      setIdx(idx + 1)
      setStep('recall')
      setSpeakState('idle')
      setSpeakResult(null)
      setMicError(false)
      setPicked(null)
      setSpeakOK(false)
      setUsedReveal(false)
    }
  }

  function reveal() {
    // 看答案：直接判为不熟，进入翻译页看完整释义
    sfx.click()
    setUsedReveal(true)
    setSpeakState('idle')
    setStep('translate')
  }

  if (done) {
    const speakAvg = speakScoredCount > 0 ? (speakStarsSum / speakScoredCount).toFixed(1) : null
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#f7f9fb] px-4 text-center">
        <Confetti />
        <div className="mb-3 text-8xl">🌟</div>
        <h2 className="mb-1 text-3xl font-black text-slate-800">复习完成！</h2>
        <p className="mb-8 font-bold text-slate-400">
          复习 {queue.length} 个单词 · 掌握 {knownCount} 个 · 翻译答对 {translateCorrectCount} 个
          {speakAvg ? ` · 朗读平均 ${speakAvg} ⭐` : ''}
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

  const answered = picked !== null
  const translateCorrect = picked === word.meaning

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
          {step === 'recall' ? '看到中文，大声读出英语单词！' : `${word.word} 是什么意思？`}
        </p>

        <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-4">
          <div className="flex h-32 w-32 items-center justify-center rounded-3xl border-2 border-slate-100 bg-white text-8xl shadow-sm">
            {word.emoji}
          </div>

          {step === 'recall' ? (
            <>
              <span className="text-4xl font-black text-slate-800">{word.meaning}</span>
              <span className="text-sm font-bold text-slate-400">{word.phonetic}</span>

              {/* 朗读按钮 */}
              <button
                onClick={startSpeak}
                disabled={speakState === 'recording' || speakState === 'analyzing'}
                className={`mt-2 flex h-24 w-24 items-center justify-center rounded-full text-white shadow-[0_6px_0_rgba(0,0,0,0.18)] transition enabled:hover:brightness-105 enabled:active:translate-y-1 enabled:active:shadow-none ${
                  speakState === 'recording' ? 'animate-pulse bg-[#ff4b4b]' : 'bg-[#58cc02]'
                }`}
                aria-label="朗读录音"
              >
                {speakState === 'recording' ? <Square size={34} fill="currentColor" /> : <Mic size={40} />}
              </button>
              <p className="text-sm font-bold text-slate-400">
                {speakState === 'idle' && '点麦克风，大声读出这个单词！'}
                {speakState === 'recording' && '正在听…读完稍等自动评分'}
                {speakState === 'analyzing' && '评分中…'}
                {speakState === 'scored' &&
                  (micError
                    ? '麦克风打不开，先跳过朗读吧'
                    : speakResult?.mode === 'recognition' && speakResult.recognized
                      ? `我听到你说："${speakResult.recognized}"`
                      : '离线评分模式')}
              </p>

              {speakState === 'scored' && !micError && speakResult && (
                <div className="animate-pop flex items-center gap-2 text-4xl">
                  {[1, 2, 3].map((s) => (
                    <span key={s} className={s <= speakResult.stars ? '' : 'opacity-20 grayscale'}>
                      ⭐
                    </span>
                  ))}
                </div>
              )}

              {/* 操作区 */}
              {speakState === 'scored' ? (
                <div className="mt-2 flex w-full flex-col gap-3">
                  {!micError && speakResult && speakResult.stars < 3 && (
                    <button
                      onClick={retrySpeak}
                      className="w-full rounded-2xl bg-white py-3.5 text-lg font-black text-[#1cb0f6] ring-2 ring-[#84d8ff] transition hover:bg-[#ddf4ff]"
                    >
                      再读一次 🎤
                    </button>
                  )}
                  <button
                    onClick={goTranslate}
                    className="w-full rounded-2xl bg-[#1cb0f6] py-4 text-lg font-black uppercase tracking-wide text-white shadow-[0_4px_0_#1899d6] transition hover:brightness-105"
                  >
                    继续 ➡
                  </button>
                </div>
              ) : speakState === 'idle' ? (
                <div className="mt-2 flex w-full items-center justify-between gap-3">
                  <button
                    onClick={() => {
                      sfx.click()
                      speak(word.word)
                    }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white py-3 text-base font-black text-slate-500 shadow-sm transition hover:bg-slate-50"
                  >
                    <Lightbulb size={20} strokeWidth={2.5} /> 听提示
                  </button>
                  <button
                    onClick={passSpeak}
                    className="flex-1 rounded-2xl bg-white py-3 text-base font-black text-slate-400 ring-2 ring-slate-200 transition hover:bg-slate-50"
                  >
                    跳过朗读 ➡
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <>
              {/* 翻译检验：单词已揭晓，选正确中文 */}
              <div className="flex items-center gap-3">
                <span className="text-4xl font-black tracking-wide text-slate-800">{word.word}</span>
                <button
                  onClick={() => {
                    sfx.click()
                    speak(word.word)
                  }}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1cb0f6] text-white shadow-[0_4px_0_#1899d6] transition hover:brightness-105 active:translate-y-0.5 active:shadow-none"
                  aria-label="播放读音"
                >
                  <Volume2 size={22} fill="currentColor" />
                </button>
              </div>
              <span className="text-sm font-bold text-slate-400">{word.phonetic}</span>

              <div className="mt-2 grid w-full grid-cols-2 gap-3">
                {options.map((m) => {
                  let cls = 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  if (answered) {
                    if (m === word.meaning) cls = 'bg-[#d7ffb8] border-[#58cc02] text-slate-700'
                    else if (m === picked) cls = 'bg-[#ffdfe0] border-[#ff4b4b] text-slate-700 animate-shake'
                    else cls = 'bg-white border-slate-200 text-slate-300'
                  }
                  return (
                    <button
                      key={m}
                      onClick={() => pickAnswer(m)}
                      disabled={answered}
                      className={`rounded-2xl border-2 py-5 text-xl font-extrabold shadow-sm transition ${cls}`}
                    >
                      {m}
                    </button>
                  )
                })}
              </div>

              {answered && (
                <div className="animate-pop flex w-full flex-col items-center gap-2 rounded-3xl border-2 border-[#84d8ff] bg-[#ddf4ff] p-5 text-center">
                  <p className={`text-lg font-black ${translateCorrect ? 'text-[#58a700]' : 'text-[#ea2b2b]'}`}>
                    {translateCorrect ? '答对啦！' : `正确答案：${word.meaning}`}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        sfx.click()
                        speak(word.example)
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1cb0f6] text-white transition hover:brightness-105"
                      aria-label="播放例句"
                    >
                      <Volume2 size={18} fill="currentColor" />
                    </button>
                    <span className="font-bold text-slate-600">{word.example}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-400">{word.exampleCn}</span>
                  <button
                    onClick={finishWord}
                    className="mt-2 w-full rounded-2xl bg-[#58cc02] py-3.5 text-lg font-black text-white shadow-[0_4px_0_#46a302] transition hover:brightness-105"
                  >
                    {idx + 1 >= queue.length ? '完成复习 🎉' : '下一个 ➡'}
                  </button>
                </div>
              )}
            </>
          )}

          {/* 第一步的兜底入口：看答案 */}
          {step === 'recall' && speakState === 'idle' && (
            <button onClick={reveal} className="text-sm font-bold text-slate-300 underline transition hover:text-slate-400">
              想不起来了，看答案
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
