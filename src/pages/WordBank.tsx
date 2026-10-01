import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, RefreshCcw } from 'lucide-react'
import { UNITS } from '@/data/words'
import { useGame } from '@/lib/store'
import { speak } from '@/lib/speech'
import { sfx } from '@/lib/sfx'
import { SpeakerButton, MasteryDots } from '@/components/common'

function WordCard({ wordId, emoji, word, phonetic, meaning, example, exampleCn, fact }: {
  wordId: string
  emoji: string
  word: string
  phonetic: string
  meaning: string
  example: string
  exampleCn: string
  fact?: string
}) {
  const [flipped, setFlipped] = useState(false)
  const { state } = useGame()
  const progress = state.wordProgress[wordId]

  return (
    <div className="h-64 [perspective:1200px]" onClick={() => { sfx.flip(); setFlipped(!flipped) }}>
      <div
        className={`relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] ${flipped ? '[transform:rotateY(180deg)]' : ''}`}
      >
        {/* 正面 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-3xl border-2 border-slate-100 bg-white p-4 shadow-sm [backface-visibility:hidden]">
          <span className="text-7xl">{emoji}</span>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-wide text-slate-800">{word}</span>
            <SpeakerButton text={word} size="sm" />
          </div>
          <span className="text-sm font-bold text-slate-400">{phonetic}</span>
          {progress ? (
            <div className="mt-1 flex flex-col items-center gap-1">
              <MasteryDots mastery={progress.mastery} due={progress.due <= new Date().toISOString().slice(0, 10)} />
            </div>
          ) : (
            <span className="mt-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-black text-slate-400">未学习</span>
          )}
          <span className="absolute bottom-3 text-xs font-bold text-slate-300">点击卡片查看释义</span>
        </div>
        {/* 背面 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-3xl bg-[#235390] p-4 text-center text-white shadow-sm [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <span className="text-3xl font-black">{meaning}</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              speak(example)
            }}
            className="mt-1 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/20"
          >
            <SpeakerButton text={example} size="sm" />
            <span className="max-w-56 text-left">{example}</span>
          </button>
          <span className="text-xs font-bold text-white/70">{exampleCn}</span>
          {fact && (
            <div className="mt-2 rounded-xl bg-white/10 px-3 py-2 text-left">
              <p className="text-xs font-black text-[#ffd580]">🌍 世界小知识</p>
              <p className="mt-0.5 text-xs font-bold leading-relaxed text-white/90">{fact}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function WordBank() {
  const navigate = useNavigate()
  const { dueWords, state } = useGame()
  const [activeUnit, setActiveUnit] = useState(0)
  const unit = UNITS[activeUnit]

  const learnedInUnit = unit.words.filter((w) => state.wordProgress[w.id]).length

  return (
    <div className="min-h-screen bg-[#f7f9fb] pb-16">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <button onClick={() => navigate('/')} className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100" aria-label="返回">
            <ArrowLeft size={24} strokeWidth={3} />
          </button>
          <h1 className="text-xl font-black text-slate-800">单词本</h1>
          <button
            onClick={() => navigate('/review')}
            className="ml-auto flex items-center gap-2 rounded-xl bg-[#58cc02] px-4 py-2 text-sm font-black text-white shadow-[0_3px_0_#46a302]"
          >
            <RefreshCcw size={16} />
            复习 {dueWords.length > 0 ? `(${dueWords.length})` : ''}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-5">
        {/* 单元切换 */}
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {UNITS.map((u, i) => (
            <button
              key={u.id}
              onClick={() => {
                sfx.click()
                setActiveUnit(i)
              }}
              className={`flex shrink-0 items-center gap-2 rounded-2xl border-2 px-4 py-2.5 text-sm font-black transition ${
                i === activeUnit ? 'text-white' : 'border-slate-200 bg-white text-slate-500'
              }`}
              style={i === activeUnit ? { backgroundColor: u.color, borderColor: u.color } : undefined}
            >
              <span>{u.icon}</span>
              {u.title}
            </button>
          ))}
        </div>

        <p className="mb-4 text-sm font-bold text-slate-400">
          {unit.title} · 已学 {learnedInUnit}/{unit.words.length} 个 · 点击卡片翻转看释义和例句
        </p>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {unit.words.map((w) => (
            <WordCard key={w.id} wordId={w.id} emoji={w.emoji} word={w.word} phonetic={w.phonetic} meaning={w.meaning} example={w.example} exampleCn={w.exampleCn} fact={w.fact} />
          ))}
        </div>
      </main>
    </div>
  )
}
